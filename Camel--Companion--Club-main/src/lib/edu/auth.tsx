import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { hasCloudConfiguration } from "./cloud-config";

const AuthContext = createContext<{
  user: User | null;
  ready: boolean;
  recovery: boolean;
  signOut: () => Promise<void>;
}>({ user: null, ready: false, recovery: false, signOut: async () => {} });
export const useEduAuth = () => useContext(AuthContext);

export function EduAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    if (!hasCloudConfiguration()) {
      setReady(true);
      return;
    }
    let authEventReceived = false;
    let currentId: string | null | undefined;
    setRecovery(new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery");
    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active && !authEventReceived) {
          currentId = data.user?.id ?? null;
          setUser(data.user);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setReady(true);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "PASSWORD_RECOVERY"].includes(event)) return;
      authEventReceived = true;
      const nextId = session?.user.id ?? null;
      if (currentId !== undefined && currentId !== nextId) queryClient.clear();
      currentId = nextId;
      setUser(session?.user ?? null);
      setReady(true);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
      if (event === "SIGNED_OUT") queryClient.clear();
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [queryClient, router]);
  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await navigate({ to: "/auth", replace: true });
  };
  return (
    <AuthContext.Provider value={{ user, ready, recovery, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
