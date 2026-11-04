import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { z } from "zod";

export const Route = createFileRoute("/api/public/jobs/purchase-confirmations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const body = await request.json().catch(() => null);
        if (
          !z
            .object({ kind: z.literal("purchase-confirmations") })
            .strict()
            .safeParse(body).success
        )
          return Response.json({ error: "invalid_request" }, { status: 400 });
        try {
          const { paymentClient, reconcile } = await import("@/lib/licensing/payments.server");
          const { sendPurchaseConfirmations } = await import("@/lib/licensing/confirmation.server");
          const { stripe, environment } = paymentClient();
          // Recover payments even when the purchaser closes Stripe before
          // returning. Already-active jobs are retried independently below.
          let reconciled = true;
          try {
            await reconcile(stripe, environment);
          } catch {
            reconciled = false;
          }
          const result = await sendPurchaseConfirmations();
          return Response.json(
            { ...result, reconciled },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json({ error: "temporarily_unavailable" }, { status: 503 });
        }
      },
    },
  },
});
