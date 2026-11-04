import { createInstance } from "i18next";
import { z } from "zod";
import es from "@/i18n/locales/es.json";
import en from "@/i18n/locales/en.json";
import fr from "@/i18n/locales/fr.json";
import type { Receipt } from "./rules";

export const confirmationSenderSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .refine((email) => !email.toLowerCase().endsWith("@resend.dev"));
const emailSchema = z.string().trim().toLowerCase().email().max(254);
export type ConfirmationConfiguration = {
  sender: string;
  testing: boolean;
  recipient: string | null;
};
export function confirmationConfiguration(
  sender: unknown,
  testRecipient: unknown,
): ConfirmationConfiguration | null {
  if (sender === "onboarding@resend.dev") {
    const recipient = emailSchema.safeParse(testRecipient);
    return recipient.success ? { sender, testing: true, recipient: recipient.data } : null;
  }
  const productionSender = confirmationSenderSchema.safeParse(sender);
  return productionSender.success
    ? { sender: productionSender.data, testing: false, recipient: null }
    : null;
}
export function confirmationDestination(
  receipt: Receipt,
  config: ConfirmationConfiguration,
): string {
  if (config.testing) {
    if (
      receipt.environment !== "sandbox" ||
      !config.recipient ||
      config.sender !== "onboarding@resend.dev"
    )
      throw new Error("testing_only");
    return emailSchema.parse(config.recipient);
  }
  confirmationSenderSchema.parse(config.sender);
  return emailSchema.parse(receipt.billing_email);
}
export const confirmationPayloadSchema = z.object({
  from: z.string(),
  to: z.array(z.string().email()).length(1),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
});
export type ConfirmationPayload = z.infer<typeof confirmationPayloadSchema>;
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char,
  );

export function buildConfirmation(
  receipt: Receipt,
  language: string,
  sender: string,
  testRecipient?: string,
): ConfirmationPayload {
  if (receipt.status !== "active" || !receipt.license_id || !receipt.paid_at)
    throw new Error("unverified_purchase");
  const config = confirmationConfiguration(sender, testRecipient);
  if (!config) throw new Error("unconfigured_sender");
  const from = config.sender;
  const destination = confirmationDestination(receipt, config);
  const locale = language === "en" || language === "fr" ? language : "es";
  const instance = createInstance();
  void instance.init({
    resources: { es: { translation: es }, en: { translation: en }, fr: { translation: fr } },
    lng: locale,
    fallbackLng: "es",
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  const t = instance.getFixedT(locale);
  const amount = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(
    receipt.amount_cents / 100,
  );
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(receipt.paid_at),
  );
  const rows = [
    [t("licensing.institution"), receipt.institution_name],
    [t("licensing.select"), t(`licensing.packages.${receipt.package_id}.name`)],
    [t("licensing.amount"), amount],
    [t("licensing.license"), receipt.license_id],
    [t("licensing.date"), date],
    [t("licensing.centres"), String(receipt.centre_count)],
    [
      t("licensing.beneficiaries"),
      receipt.beneficiary_mode === "solidarity"
        ? t("licensing.assignment")
        : receipt.centres.join(" · "),
    ],
  ];
  const subject = t(
    receipt.environment === "sandbox"
      ? "licensing.confirmation.testSubject"
      : "licensing.confirmation.subject",
  );
  const intro = t("licensing.confirmation.intro");
  const footer = t("licensing.confirmation.footer");
  const test = receipt.environment === "sandbox" ? t("licensing.test") : "";
  const solidarity = receipt.beneficiary_mode === "solidarity" ? t("licensing.solidarityNote") : "";
  return {
    from: `EduPulse Intelligence <${from}>`,
    to: [destination],
    subject,
    text: [
      "EduPulse Intelligence",
      subject,
      test,
      intro,
      ...rows.map(([label, value]) => `${label}: ${value}`),
      solidarity,
      footer,
    ]
      .filter(Boolean)
      .join("\n\n"),
    html: `<!doctype html><html lang="${locale}"><head><meta charset="UTF-8"></head><body><h1>EduPulse Intelligence</h1><h2>${escapeHtml(subject)}</h2>${test ? `<p><strong>${escapeHtml(test)}</strong></p>` : ""}<p>${escapeHtml(intro)}</p><dl>${rows.map(([label = "", value = ""]) => `<dt><strong>${escapeHtml(label)}</strong></dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>${solidarity ? `<p>${escapeHtml(solidarity)}</p>` : ""}<p>${escapeHtml(footer)}</p></body></html>`,
  };
}

export type ConfirmationJob = { order_id: string; attempt_token: string | null; payload: unknown };
export type ConfirmationDelivery = {
  claim: () => Promise<ConfirmationJob | null>;
  prepare: (job: ConfirmationJob) => Promise<ConfirmationPayload>;
  send: (payload: ConfirmationPayload, key: string) => Promise<string>;
  finish: (job: ConfirmationJob, providerId: string | null, error: string | null) => Promise<void>;
};
// Stable persisted payload + provider idempotency cover retries after a timeout
// or a crash between provider acceptance and the database acknowledgement.
export async function deliverConfirmation(
  deps: ConfirmationDelivery,
): Promise<"idle" | "sent" | "retry"> {
  const job = await deps.claim();
  if (!job || !job.attempt_token) return "idle";
  let providerId: string | null = null;
  try {
    const payload = job.payload
      ? confirmationPayloadSchema.parse(job.payload)
      : await deps.prepare(job);
    providerId = await deps.send(payload, `institutional-confirmation-v1-${job.order_id}`);
    if (!providerId) throw new Error("missing_email_id");
    await deps.finish(job, providerId, null);
    return "sent";
  } catch {
    // Keep an accepted ID even when the first acknowledgement fails. If this
    // second write also fails, the lease expires and the same payload is retried.
    await deps.finish(job, providerId, providerId ? null : "delivery_failed");
    return providerId ? "sent" : "retry";
  }
}
