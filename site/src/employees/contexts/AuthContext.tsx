import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/employees/integrations/supabase/client";
import type { Database } from "@/employees/integrations/supabase/types";

type AppRole = "super_admin" | "office_manager" | "team_leader" | "customer" | "contractor" | "contractor_worker";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  isAdmin: boolean;
  isTeamLeader: boolean;
  isCustomer: boolean;
  isContractor: boolean;
  isContractorWorker: boolean;
  /** Whether the user may enter Yarok 360 (the "360" module in the portal admin screen) */
  canEnter360: boolean;
  /** True until the session and, for a signed-in user, their roles and 360 access are known */
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [canEnter360, setCanEnter360] = useState(false);
  const [loading, setLoading] = useState(true);
  // User whose roles and access are loaded; token refreshes for the same user keep them
  const loadedUserId = useRef<string | null>(null);

  const applySession = async (session: Session | null) => {
    setSession(session);
    const userId = session?.user?.id ?? null;
    if (userId === loadedUserId.current) {
      // Same user (a token refresh, or the second of the two startup events): roles are loaded or loading
      setUser(session?.user ?? null);
      if (!userId) setLoading(false);
      return;
    }
    loadedUserId.current = userId;
    if (!userId) {
      setUser(null);
      setRoles([]);
      setCanEnter360(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setUser(session!.user);
    const [{ data: roleRows }, { data: allowed }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.rpc("can_enter_yarok360"),
    ]);
    if (loadedUserId.current !== userId) return;
    setRoles((roleRows ?? []).map((r: any) => r.role as AppRole));
    setCanEnter360(allowed === true);
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Use setTimeout to avoid Supabase client deadlock
        setTimeout(() => applySession(session), 0);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session));

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (identifier: string, password: string) => {
    // Detect if identifier is a phone number or email
    const isPhone = /^[\d\+\-\s\(\)]+$/.test(identifier.trim()) && identifier.trim().length >= 7;

    if (isPhone) {
      // Resolve phone to email via edge function
      const { data: resolveData, error: resolveError } = await supabase.functions.invoke(
        "login-with-phone",
        { body: { phone: identifier.trim(), password } }
      );

      if (resolveError || !resolveData?.ok) {
        return { error: resolveData?.error || resolveError?.message || "שגיאה בחיפוש משתמש" };
      }

      // Sign in with the resolved email
      const { error } = await supabase.auth.signInWithPassword({
        email: resolveData.email,
        password,
      });
      return { error: error?.message ?? null };
    }

    // Email login
    const { error } = await supabase.auth.signInWithPassword({
      email: identifier.trim(),
      password,
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    loadedUserId.current = null;
    setRoles([]);
    setCanEnter360(false);
  };

  const isAdmin = roles.includes("super_admin") || roles.includes("office_manager");
  const isTeamLeader = roles.includes("team_leader");
  const isCustomer = roles.includes("customer");
  const isContractor = roles.includes("contractor");
  const isContractorWorker = roles.includes("contractor_worker");

  return (
    <AuthContext.Provider value={{ session, user, roles, isAdmin, isTeamLeader, isCustomer, isContractor, isContractorWorker, canEnter360, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
