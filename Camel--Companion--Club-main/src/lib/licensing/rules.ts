import { z } from "zod";

export const PACKAGE_IDS = ["pilot", "district", "regional"] as const;
export const packageIdSchema = z.enum(PACKAGE_IDS);
export type PackageId = z.infer<typeof packageIdSchema>;
export const PACKAGE_RULES = {
  pilot: { amount_cents: 49000, max_centres: 1, capacity: 10, tax_code: "txcd_20060017" },
  district: { amount_cents: 185000, max_centres: 5, capacity: 5, tax_code: "txcd_20060017" },
  regional: { amount_cents: 450000, max_centres: 15, capacity: 2, tax_code: "txcd_20060017" },
} as const;
export type Environment = "sandbox" | "live";
export type PackageAvailability = {
  id: PackageId;
  amount_cents: number;
  max_centres: number;
  capacity: number;
  available: number;
};
export const contractingSchema = z
  .object({
    package_id: packageIdSchema,
    institution_name: z.string().trim().min(2).max(200),
    billing_email: z.string().trim().toLowerCase().email().max(254),
    beneficiary_mode: z.enum(["direct", "solidarity"]),
    centre_count: z.number().int().min(1).max(15),
    centres: z.array(z.string().trim().min(2).max(200)).max(15),
  })
  .superRefine((data, ctx) => {
    if (data.centre_count > PACKAGE_RULES[data.package_id].max_centres)
      ctx.addIssue({ code: "custom", path: ["centre_count"], message: "invalid_count" });
    if (data.beneficiary_mode === "direct" && data.centres.length !== data.centre_count)
      ctx.addIssue({ code: "custom", path: ["centres"], message: "missing_centres" });
    if (data.beneficiary_mode === "solidarity" && data.centres.length !== 0)
      ctx.addIssue({ code: "custom", path: ["centres"], message: "invalid_centres" });
    if (new Set(data.centres.map((name) => name.toLocaleLowerCase())).size !== data.centres.length)
      ctx.addIssue({ code: "custom", path: ["centres"], message: "duplicate_centres" });
  });
export type ContractingInput = z.infer<typeof contractingSchema>;
export const checkoutSchema = z.object({
  contract: contractingSchema,
  request_key: z.string().uuid(),
  access_token: z.string().regex(/^[a-f0-9]{64}$/),
  language: z.enum(["es", "en", "fr"]),
});
export const receiptSchema = z.object({
  order_id: z.string().uuid(),
  access_token: z.string().regex(/^[a-f0-9]{64}$/),
});
export function canContract(p: PackageAvailability, count: number) {
  return Number.isInteger(count) && count >= 1 && count <= p.max_centres && count <= p.available;
}
export function approvedCheckoutOrigin(origin: string, allowed: string[]) {
  try {
    const parsed = new URL(origin);
    return (
      parsed.origin === origin &&
      allowed.includes(origin) &&
      (parsed.protocol === "https:" || parsed.hostname === "localhost")
    );
  } catch {
    return false;
  }
}
type ExpectedPayment = {
  id: string;
  stripe_session_id: string | null;
  amount_cents: number;
  currency: string;
  environment: string;
};
type PaymentEvidence = {
  id: string;
  mode: string | null;
  status: string | null;
  payment_status: string;
  amount_subtotal: number | null;
  amount_total: number | null;
  currency: string | null;
  livemode: boolean;
  metadata: Record<string, string> | null;
  client_reference_id: string | null;
};
export function isVerifiedPayment(order: ExpectedPayment, session: PaymentEvidence) {
  return (
    session.id === order.stripe_session_id &&
    session.mode === "payment" &&
    session.status === "complete" &&
    session.payment_status === "paid" &&
    session.amount_subtotal === order.amount_cents &&
    session.amount_total === order.amount_cents &&
    session.currency === order.currency &&
    (session.livemode ? "live" : "sandbox") === order.environment &&
    session.metadata?.["institutional_order_id"] === order.id &&
    session.client_reference_id === order.id
  );
}
export type Receipt = {
  status: "preparing" | "pending" | "active" | "cancelled";
  institution_name: string;
  billing_email: string;
  package_id: PackageId;
  centre_count: number;
  centres: string[];
  beneficiary_mode: "direct" | "solidarity";
  amount_cents: number;
  environment: Environment;
  paid_at: string | null;
  license_id: string | null;
};
