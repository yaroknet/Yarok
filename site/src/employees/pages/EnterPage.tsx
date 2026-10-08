import { Navigate } from "react-router-dom";
import { useAuth } from "@/employees/contexts/AuthContext";
import { NoAccess } from "@/employees/components/NoAccess";

/** Entry from the portal's "360" button: opens the user's Yarok 360 screen with their existing login */
export default function EnterPage() {
  const { user, loading, canEnter360, isAdmin, isTeamLeader, isContractor, isContractorWorker, isCustomer } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (!canEnter360) return <NoAccess />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (isTeamLeader || isContractor || isContractorWorker) return <Navigate to="/team" replace />;
  if (isCustomer) return <Navigate to="/customer" replace />;
  return <NoAccess message="לא הוגדר לך תפקיד ב-360 (מנהל משרד, ראש צוות או לקוח). ניתן לבקש ממנהל המערכת." />;
}
