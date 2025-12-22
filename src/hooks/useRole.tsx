import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "user";

interface UseRoleReturn {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isAdmin: boolean;
  isLoading: boolean;
  isActive: boolean;
}

export const useRole = (): UseRoleReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = useCallback(async (userId: string) => {
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (roleData) {
        setRole(roleData.role as AppRole);
      } else {
        setRole("user");
      }

      // Check if user is active
      const { data: profileData } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("user_id", userId)
        .single();

      if (profileData) {
        setIsActive(profileData.is_active ?? true);
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
      setRole("user");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setRole(null);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRole]);

  return {
    user,
    session,
    role,
    isAdmin: role === "admin",
    isLoading,
    isActive,
  };
};
