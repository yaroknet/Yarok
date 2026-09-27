import { Navigate } from "react-router-dom";
import { useAuth } from "@/employees/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<"super_admin" | "office_manager" | "team_leader" | "customer" | "contractor" | "contractor_worker">;
  allowedUserIds?: string[];
}

export function ProtectedRoute({ children, allowedRoles, allowedUserIds }: ProtectedRouteProps) {
  const { user, roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">טוען...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !roles.some((r) => allowedRoles.includes(r))) {
    return <Navigate to="/" replace />;
  }

  if (allowedUserIds && !allowedUserIds.includes(user.id)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
