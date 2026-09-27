import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Button } from "@/components/ui/button";
import { RefreshCw, Cloud, CloudOff, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";

export const SyncStatus = () => {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    syncProgress,
    syncPendingOperations,
  } = useOfflineSync();

  // Don't show if online and nothing pending
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
        >
          {isSyncing ? (
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          ) : isOnline ? (
            <Cloud className="h-4 w-4 text-primary" />
          ) : (
            <CloudOff className="h-4 w-4 text-status-warning" />
          )}
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-status-warning text-[10px] font-bold text-primary-foreground">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Cloud className="h-4 w-4 text-status-success" />
                <span className="text-sm font-medium">מחובר לאינטרנט</span>
              </>
            ) : (
              <>
                <CloudOff className="h-4 w-4 text-status-warning" />
                <span className="text-sm font-medium">מצב אופליין</span>
              </>
            )}
          </div>

          {isSyncing && syncProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>מסנכרן נתונים...</span>
                <span>
                  {syncProgress.current}/{syncProgress.total}
                </span>
              </div>
              <Progress
                value={(syncProgress.current / syncProgress.total) * 100}
                className="h-2"
              />
            </div>
          )}

          {pendingCount > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {pendingCount} פעולות ממתינות לסנכרון
              </p>
              <Button
                size="sm"
                className="w-full"
                onClick={syncPendingOperations}
                disabled={!isOnline || isSyncing}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                    מסנכרן...
                  </>
                ) : (
                  <>
                    <RefreshCw className="ml-2 h-4 w-4" />
                    סנכרן עכשיו
                  </>
                )}
              </Button>
              {!isOnline && (
                <p className="text-xs text-muted-foreground text-center">
                  הסנכרון יתבצע אוטומטית כשתחזור לאינטרנט
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-status-success">
              <Check className="h-4 w-4" />
              <span>כל הנתונים מסונכרנים</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
