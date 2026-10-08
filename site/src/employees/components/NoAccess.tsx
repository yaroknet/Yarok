import { Button } from "@/employees/components/ui/button";

/** Shown to a signed-in user who may not enter Yarok 360, with the way back to the portal */
export function NoAccess({ message = "אין לך הרשאה להיכנס ל-360. ניתן לבקש הרשאה ממנהל המערכת." }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" dir="rtl">
      <div className="text-center max-w-sm">
        <h1 className="text-xl font-semibold text-foreground mb-2">אין גישה</h1>
        <p className="text-muted-foreground text-sm mb-6">{message}</p>
        <Button onClick={() => window.location.assign("/portal")}>חזרה לאזור האישי</Button>
      </div>
    </div>
  );
}
