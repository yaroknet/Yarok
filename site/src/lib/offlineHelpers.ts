import { addPendingOperation } from "@/lib/offlineStorage";
import { toast } from "sonner";

/**
 * Wrapper for database operations that handles offline mode
 * If offline, stores the operation for later sync
 */
export async function withOfflineSupport<T>(
  operation: () => Promise<T>,
  offlineData: {
    type: "create" | "update" | "delete";
    table: string;
    data: Record<string, unknown>;
  }
): Promise<{ data: T | null; offline: boolean }> {
  // If online, try the operation
  if (navigator.onLine) {
    try {
      const result = await operation();
      return { data: result, offline: false };
    } catch (error) {
      // If the operation fails due to network, store offline
      if (isNetworkError(error)) {
        await storeOffline(offlineData);
        return { data: null, offline: true };
      }
      throw error;
    }
  }

  // If offline, store the operation
  await storeOffline(offlineData);
  return { data: null, offline: true };
}

async function storeOffline(offlineData: {
  type: "create" | "update" | "delete";
  table: string;
  data: Record<string, unknown>;
}) {
  try {
    await addPendingOperation(offlineData.type, offlineData.table, offlineData.data);
    toast.info("הפעולה נשמרה ותסונכרן כשתחזור לאינטרנט", {
      duration: 4000,
    });
  } catch (error) {
    console.error("Failed to store offline operation:", error);
    toast.error("שגיאה בשמירת הפעולה אופליין");
    throw error;
  }
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("failed to fetch") ||
      message.includes("connection") ||
      message.includes("offline")
    );
  }
  return false;
}

/**
 * Creates a temporary ID for offline records
 */
export function createTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if an ID is a temporary offline ID
 */
export function isTempId(id: string): boolean {
  return id.startsWith("temp_");
}
