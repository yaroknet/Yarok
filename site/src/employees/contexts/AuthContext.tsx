import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (data) {
      setRoles(data.map((r: any) => r.role as AppRole));
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Use setTimeout to avoid Supabase client deadlock
          setTimeout(() => fetchRoles(session.user.id), 0);
        } else {
          setRoles([]);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRoles(session.user.id);
      }
      setLoading(false);
    });

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
    setRoles([]);
  };

  const isAdmin = roles.includes("super_admin") || roles.includes("office_manager");
  const isTeamLeader = roles.includes("team_leader");
  const isCustomer = roles.includes("customer");
  const isContractor = roles.includes("contractor");
  const isContractorWorker = roles.includes("contractor_worker");

  return (
    <AuthContext.Provider value={{ session, user, roles, isAdmin, isTeamLeader, isCustomer, isContractor, isContractorWorker, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
