import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, LockKeyhole, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EduSelect } from "@/components/edu/EduSelect";
import { createInstitutionalCheckout } from "@/lib/licensing/payments.functions";
import { canContract, contractingSchema, type PackageAvailability } from "@/lib/licensing/rules";

export function ContractForm({ item, onBack }: { item: PackageAvailability; onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const createCheckout = useServerFn(createInstitutionalCheckout);
  const [institution, setInstitution] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"direct" | "solidarity">("direct");
  const [count, setCount] = useState(1);
  const [centres, setCentres] = useState<string[]>([""]);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<{ request_key: string; access_token: string } | null>(
    null,
  );
  const amount = new Intl.NumberFormat(i18n.language, {
    style: "currency",
    currency: "EUR",
  }).format(item.amount_cents / 100);
  const checkout = useMutation({
    mutationFn: createCheckout,
    onSuccess: (result) => {
      if ("error" in result) {
        setErrorKey(
          result.error === "sold_out"
            ? "capacityChanged"
            : result.error === "invalid_order"
              ? "invalid"
              : "unavailable",
        );
        void client.invalidateQueries({ queryKey: ["institutional", "packages"] });
        if (result.error === "sold_out") setAttempt(null);
        return;
      }
      if (!attempt) {
        setErrorKey("unavailable");
        return;
      }
      try {
        window.sessionStorage.setItem(
          `institutional-receipt:${result.order_id}`,
          attempt.access_token,
        );
        const url = new URL(result.url);
        const receiptUrl =
          url.origin === window.location.origin && url.pathname === "/contratacion/resultado";
        if (!receiptUrl && (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com"))
          throw new Error("invalid_url");
        window.location.assign(url.href);
      } catch {
        setErrorKey("unavailable");
      }
    },
    onError: () => setErrorKey("unavailable"),
  });
  function updateCount(value: number) {
    setCount(value);
    setCentres((old) => Array.from({ length: value }, (_, i) => old[i] ?? ""));
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    const contract = contractingSchema.safeParse({
      package_id: item.id,
      institution_name: institution,
      billing_email: email,
      beneficiary_mode: mode,
      centre_count: count,
      centres: mode === "direct" ? centres : [],
    });
    if (!contract.success) {
      setErrorKey("invalid");
      return;
    }
    if (!attempt && !canContract(item, count)) {
      setErrorKey("capacityChanged");
      return;
    }
    // The capability is private to this browser; never put it in return URLs.
    const current = attempt ?? {
      request_key: crypto.randomUUID(),
      access_token: Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join(""),
    };
    setAttempt(current);
    try {
      window.sessionStorage.setItem(
        `institutional-attempt:${current.request_key}`,
        current.access_token,
      );
    } catch {
      setErrorKey("unavailable");
      return;
    }
    setErrorKey(null);
    checkout.mutate({
      data: {
        ...current,
        contract: contract.data,
        language: i18n.language.startsWith("fr")
          ? "fr"
          : i18n.language.startsWith("en")
            ? "en"
            : "es",
      },
    });
  }
  return (
    <section className="mt-8 border-t-2 pt-8">
      <Button variant="ghost" onClick={onBack} disabled={checkout.isPending}>
        <ArrowLeft />
        {t("licensing.back")}
      </Button>
      <div className="mt-6 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-3">
          <School className="size-10 text-primary" aria-hidden />
          <p className="text-sm font-bold text-muted-foreground">{t("licensing.select")}</p>
          <h2 className="text-2xl">{t(`licensing.packages.${item.id}.name`)}</h2>
          <p className="text-3xl font-black text-secondary">{amount}</p>
          <p className="text-sm text-muted-foreground">{t("licensing.fullPrice")}</p>
          <p className="font-bold">{t("licensing.available", { count: item.available })}</p>
        </div>
        <form onSubmit={submit} className="min-w-0 space-y-5">
          <fieldset
            disabled={checkout.isPending || Boolean(attempt)}
            className="space-y-5 disabled:opacity-70"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 font-bold">
                {t("licensing.institution")}
                <Input
                  autoComplete="organization"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  minLength={2}
                  maxLength={200}
                  required
                />
              </label>
              <label className="block space-y-2 font-bold">
                {t("licensing.email")}
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                  required
                />
              </label>
            </div>
            <label className="block space-y-2 font-bold">
              {t("licensing.beneficiaries")}
              <EduSelect
                label={t("licensing.beneficiaries")}
                value={mode}
                onChange={(v) => {
                  if (v === "direct" || v === "solidarity") setMode(v);
                }}
                options={[
                  { value: "direct", label: t("licensing.direct") },
                  { value: "solidarity", label: t("licensing.solidarity") },
                ]}
              />
            </label>
            <label className="block space-y-2 font-bold">
              {t("licensing.centreCount")}
              <Input
                type="number"
                min={1}
                max={Math.min(item.max_centres, item.available)}
                value={count}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (
                    Number.isInteger(v) &&
                    v >= 1 &&
                    v <= Math.min(item.max_centres, item.available)
                  )
                    updateCount(v);
                }}
                required
              />
            </label>
            {mode === "direct" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {centres.map((name, i) => (
                  <label key={i} className="block space-y-2 font-bold">
                    {t("licensing.centreName", { number: i + 1 })}
                    <Input
                      value={name}
                      minLength={2}
                      maxLength={200}
                      required
                      onChange={(e) =>
                        setCentres((old) =>
                          old.map((v, index) => (index === i ? e.target.value : v)),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("licensing.solidarityNote")}</p>
            )}
          </fieldset>
          {errorKey && (
            <p role="alert" className="text-destructive">
              {t(`licensing.${errorKey}`)}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            className="h-auto min-h-12 w-full whitespace-normal py-3"
            disabled={checkout.isPending || (!attempt && item.available === 0)}
          >
            <LockKeyhole className="shrink-0" />
            {t(
              checkout.isPending
                ? "licensing.processing"
                : !attempt && item.available === 0
                  ? "licensing.soldOut"
                  : "licensing.payment",
            )}
            <ArrowRight className="shrink-0" />
          </Button>
          <p className="text-sm text-muted-foreground">{t("licensing.tax")}</p>
        </form>
      </div>
    </section>
  );
}
