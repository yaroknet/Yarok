import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type AppRole = 'super_admin' | 'manager' | 'driver';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  driver_license_number: string | null;
  driver_license_expiry: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  roles: AppRole[];
  userRole: AppRole | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isManager: boolean;
  isDriver: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        // Profile fetch error (not "no rows found")
      }
      setProfile(profileData);

      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        // Roles fetch error
      }
      setRoles(rolesData?.map(r => r.role as AppRole) || []);
    } catch {
      // Error fetching user data - will retry on next auth state change
    }
  };

  const logSession = async (userId: string, type: 'login' | 'logout') => {
    try {
      if (type === 'login') {
        await supabase.from('session_logs').insert({
          user_id: userId,
          user_agent: navigator.userAgent,
          device_info: navigator.platform,
        });
      } else {
        // Update the most recent session with logout time
        const { data: sessions } = await supabase
          .from('session_logs')
          .select('id')
          .eq('user_id', userId)
          .is('logout_at', null)
          .order('login_at', { ascending: false })
          .limit(1);
        
        if (sessions && sessions.length > 0) {
          await supabase
            .from('session_logs')
            .update({ logout_at: new Date().toISOString() })
            .eq('id', sessions[0].id);
        }
      }
    } catch {
      // Session logging error - non-critical, continue
    }
  };

  useEffect(() => {
    let initialSessionResolved = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only update state from onAuthStateChange AFTER the initial session has been resolved
        // This prevents a race condition where this fires before getSession resolves,
        // briefly setting user=null and triggering a redirect
        if (!initialSessionResolved) return;

        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
            // Log session on sign in
            if (event === 'SIGNED_IN') {
              logSession(session.user.id, 'login');
            }
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
        setIsLoading(false);
      }
    );

    // THEN check for existing session - this is the authoritative initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialSessionResolved = true;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      toast.error('שגיאה בהתחברות: ' + error.message);
      return { error };
    }
    toast.success('התחברת בהצלחה!');
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    if (error) {
      toast.error('שגיאה בהרשמה: ' + error.message);
      return { error };
    }
    toast.success('נרשמת בהצלחה!');
    return { error: null };
  };

  const signOut = async () => {
    if (user) {
      await logSession(user.id, 'logout');
    }
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    toast.success('התנתקת בהצלחה');
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  const isSuperAdmin = roles.includes('super_admin');
  const isManager = roles.includes('manager') || isSuperAdmin;
  const isDriver = roles.includes('driver') || isManager;
  
  // Determine primary role (highest privilege)
  const userRole: AppRole | null = isSuperAdmin 
    ? 'super_admin' 
    : isManager 
      ? 'manager' 
      : roles.includes('driver') 
        ? 'driver' 
        : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        userRole,
        isLoading,
        isSuperAdmin,
        isManager,
        isDriver,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
