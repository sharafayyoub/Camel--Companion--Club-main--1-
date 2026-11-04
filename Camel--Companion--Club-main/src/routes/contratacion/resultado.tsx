import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock, XCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { eduPageHead } from "@/lib/edu/meta";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/edu/ui";
import {
  verifyInstitutionalPayment,
  cancelInstitutionalCheckout,
} from "@/lib/licensing/payments.functions";
import type { Receipt } from "@/lib/licensing/rules";

export const Route = createFileRoute("/contratacion/resultado")({
  validateSearch: (search) => ({ order: z.string().uuid().catch("").parse(search["order"]) }),
  head: ({ match }) => ({
    meta: [
      ...eduPageHead("paymentResult", match.context.translations).meta,
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PaymentResult,
});
function PaymentResult() {
  const { order } = Route.useSearch();
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const verify = useServerFn(verifyInstitutionalPayment);
  const cancelFn = useServerFn(cancelInstitutionalCheckout);
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      setToken(window.sessionStorage.getItem(`institutional-receipt:${order}`));
    } catch {
      setToken(null);
    }
    setHydrated(true);
  }, [order]);
  const query = useQuery({
    queryKey: ["institutional", "receipt", order],
    queryFn: () => verify({ data: { order_id: order, access_token: token ?? "" } }),
    enabled: Boolean(token && order),
    retry: false,
    refetchInterval: (q) =>
      q.state.data &&
      "receipt" in q.state.data &&
      ["pending", "preparing"].includes(q.state.data.receipt.status)
        ? 8000
        : false,
  });
  const receipt: Receipt | null = query.data && "receipt" in query.data ? query.data.receipt : null;
  const cancel = useMutation({
    mutationFn: () => cancelFn({ data: { order_id: order, access_token: token ?? "" } }),
    onSuccess: (result) => {
      client.setQueryData(["institutional", "receipt", order], result);
      void client.invalidateQueries({ queryKey: ["institutional", "packages"] });
    },
  });
  useEffect(() => {
    if (receipt?.status === "active" || receipt?.status === "cancelled")
      void client.invalidateQueries({ queryKey: ["institutional", "packages"] });
  }, [receipt?.status, client]);
  const error =
    query.isError ||
    cancel.isError ||
    (query.data && "error" in query.data) ||
    (cancel.data && "error" in cancel.data);
  const active = receipt?.status === "active";
  const cancelled = receipt?.status === "cancelled";
  const Icon = active ? CheckCircle2 : cancelled ? XCircle : Clock;
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title={t("licensing.resultTitle")} />
      {!hydrated || (token && query.isPending) ? (
        <p role="status">{t("licensing.verifying")}</p>
      ) : !token || !order ? (
        <p role="alert">{t("licensing.invalidReceipt")}</p>
      ) : (
        <>
          {error && (
            <p role="alert" className="mb-4 text-destructive">
              {t(
                query.data && "error" in query.data && query.data.error === "invalid_receipt"
                  ? "licensing.invalidReceipt"
                  : "licensing.unavailable",
              )}
            </p>
          )}
          {receipt && (
            <>
              <div className="flex items-center gap-4 border-y-2 py-6">
                <Icon className="size-10 shrink-0 text-primary" aria-hidden />
                <h2 className="text-2xl">
                  {t(
                    active
                      ? "licensing.active"
                      : cancelled
                        ? "licensing.cancelled"
                        : "licensing.pending",
                  )}
                </h2>
              </div>
              {receipt.environment === "sandbox" && (
                <p className="mt-5 font-extrabold text-secondary">{t("licensing.test")}</p>
              )}
              {!active && (
                <p className="mt-4 text-muted-foreground">
                  {t(cancelled ? "licensing.cancelledNote" : "licensing.pendingNote")}
                </p>
              )}
              <dl className="mt-8 grid gap-x-6 gap-y-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                <dt className="font-bold">{t("licensing.institution")}</dt>
                <dd className="break-words">{receipt.institution_name}</dd>
                <dt className="font-bold">{t("licensing.email")}</dt>
                <dd className="break-all">{receipt.billing_email}</dd>
                <dt className="font-bold">{t("licensing.select")}</dt>
                <dd>{t(`licensing.packages.${receipt.package_id}.name`)}</dd>
                <dt className="font-bold">{t("licensing.centres")}</dt>
                <dd>{receipt.centre_count}</dd>
                {active && (
                  <>
                    <dt className="font-bold">{t("licensing.amount")}</dt>
                    <dd>
                      {new Intl.NumberFormat(i18n.language, {
                        style: "currency",
                        currency: "EUR",
                      }).format(receipt.amount_cents / 100)}
                    </dd>
                    <dt className="font-bold">{t("licensing.license")}</dt>
                    <dd className="break-all">{receipt.license_id}</dd>
                    <dt className="font-bold">{t("licensing.date")}</dt>
                    <dd>
                      {receipt.paid_at
                        ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(
                            new Date(receipt.paid_at),
                          )
                        : ""}
                    </dd>
                  </>
                )}
                <dt className="font-bold">{t("licensing.beneficiaries")}</dt>
                <dd>
                  {receipt.beneficiary_mode === "solidarity" ? (
                    t("licensing.assignment")
                  ) : (
                    <ul className="space-y-1">
                      {receipt.centres.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  )}
                </dd>
              </dl>
              {receipt.beneficiary_mode === "solidarity" && (
                <p className="mt-6 text-sm text-muted-foreground">
                  {t("licensing.solidarityNote")}
                </p>
              )}
            </>
          )}
          {(!receipt || (!active && !cancelled)) && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
                <RefreshCw />
                {t("licensing.retry")}
              </Button>
              {receipt?.status === "pending" && (
                <Button
                  variant="outline"
                  onClick={() => cancel.mutate()}
                  disabled={cancel.isPending}
                >
                  <XCircle />
                  {t("licensing.cancel")}
                </Button>
              )}
            </div>
          )}
        </>
      )}
      <Button asChild variant="ghost" className="mt-8">
        <Link to="/contratacion">
          <ArrowLeft />
          {t("licensing.back")}
        </Link>
      </Button>
    </div>
  );
}
