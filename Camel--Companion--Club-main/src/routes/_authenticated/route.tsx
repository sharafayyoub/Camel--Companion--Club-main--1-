import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CloudError, CloudPending } from "@/components/edu/CloudFeedback";
import { accountOptions } from "@/lib/edu/store";
import { SchoolSetup } from "@/components/edu/SchoolSetup";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { authDestination } from "@/lib/edu/auth-destination";
import { hasCloudConfiguration } from "@/lib/edu/cloud-config";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (!hasCloudConfiguration())
      throw redirect({ to: "/auth", search: { next: authDestination(location.href) } });
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user)
      throw redirect({ to: "/auth", search: { next: authDestination(location.href) } });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(accountOptions),
  pendingComponent: CloudPending,
  errorComponent: CloudError,
  component: Authenticated,
});
function Authenticated() {
  const { data: account } = useSuspenseQuery(accountOptions);
  const client = useQueryClient();
  const schoolId = account.membership?.school_id;
  useEffect(() => {
    if (!schoolId) return;
    const channel = supabase
      .channel(`edupulse:${account.user.id}`, { config: { private: true } })
      .on("broadcast", { event: "changed" }, () => {
        void client.invalidateQueries({ queryKey: ["edu"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [account.user.id, schoolId, client]);
  if (!account.membership) return <SchoolSetup />;
  return <Outlet />;
}
