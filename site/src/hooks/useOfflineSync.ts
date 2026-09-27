import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getPendingOperations,
  removePendingOperation,
  updateRetryCount,
  getPendingCount,
  type PendingOperation,
} from "@/lib/offlineStorage";

const MAX_RETRY_COUNT = 3;

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch (error) {
      console.error("Failed to get pending count:", error);
    }
  }, []);

  // Sync a single operation
  const syncOperation = async (operation: PendingOperation): Promise<boolean> => {
    try {
      const { type, table, data } = operation;

      // Type assertion for table names
      const validTables = [
        "fleet_incidents",
        "fleet_km_readings",
        "fleet_maintenance",
        "requests",
        "fleet_fines",
      ] as const;

      if (!validTables.includes(table as typeof validTables[number])) {
        console.warn(`Unknown table: ${table}`);
        return false;
      }

      const tableName = table as typeof validTables[number];

      switch (type) {
        case "create": {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await supabase.from(tableName).insert(data as any);
          if (error) throw error;
          break;
        }
        case "update": {
          const { id, ...updateData } = data;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await supabase
            .from(tableName)
            .update(updateData as any)
            .eq("id", id as string);
          if (error) throw error;
          break;
        }
        case "delete": {
          const { error } = await supabase
            .from(tableName)
            .delete()
            .eq("id", data.id as string);
          if (error) throw error;
          break;
        }
      }

      return true;
    } catch (error) {
      console.error("Failed to sync operation:", operation, error);
      return false;
    }
  };

  // Sync all pending operations
  const syncPendingOperations = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const operations = await getPendingOperations();
      
      if (operations.length === 0) {
        setIsSyncing(false);
        return;
      }

      setSyncProgress({ current: 0, total: operations.length });
      toast.info(`מסנכרן ${operations.length} פעולות...`);

      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        setSyncProgress({ current: i + 1, total: operations.length });

        // Skip operations that have failed too many times
        if (operation.retryCount >= MAX_RETRY_COUNT) {
          console.warn("Operation exceeded max retries:", operation);
          failCount++;
          continue;
        }

        const success = await syncOperation(operation);

        if (success) {
          await removePendingOperation(operation.id);
          successCount++;
        } else {
          await updateRetryCount(operation.id);
          failCount++;
        }
      }

      await updatePendingCount();

      if (successCount > 0) {
        toast.success(`${successCount} פעולות סונכרנו בהצלחה`);
      }

      if (failCount > 0) {
        toast.warning(`${failCount} פעולות נכשלו בסנכרון`);
      }
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("שגיאה בסנכרון הנתונים");
    } finally {
      setIsSyncing(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  }, [isSyncing, updatePendingCount]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      syncPendingOperations();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial pending count
    updatePendingCount();

    // Try to sync on mount if online
    if (navigator.onLine) {
      syncPendingOperations();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncPendingOperations, updatePendingCount]);

  // Register for background sync if supported
  useEffect(() => {
    if ("serviceWorker" in navigator && "sync" in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        // Request background sync
        (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
          .sync.register("sync-data")
          .catch((error: Error) => {
            // Background sync not available in this browser
          });
      });
    }
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    syncProgress,
    syncPendingOperations,
    updatePendingCount,
  };
}
