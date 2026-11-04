import { describe, it, expect } from "vitest";
import {
  PACKAGE_RULES,
  canContract,
  contractingSchema,
  isVerifiedPayment,
  approvedCheckoutOrigin,
} from "./rules";

const contract = {
  package_id: "pilot",
  institution_name: "Institución educativa",
  billing_email: "billing@example.org",
  beneficiary_mode: "direct",
  centre_count: 1,
  centres: ["Escuela Uno"],
};
const order = {
  id: "order-1",
  stripe_session_id: "cs_test_1",
  amount_cents: 49000,
  currency: "eur",
  environment: "sandbox",
};
const paid = {
  id: "cs_test_1",
  mode: "payment",
  status: "complete",
  payment_status: "paid",
  amount_subtotal: 49000,
  amount_total: 49000,
  currency: "eur",
  livemode: false,
  metadata: { institutional_order_id: "order-1" },
  client_reference_id: "order-1",
};
describe("institutional contracting rules", () => {
  it("restricts guest checkout returns to approved application origins", () => {
    const allowed = ["https://school.example.org", "http://localhost:8080"];
    expect(approvedCheckoutOrigin("https://school.example.org", allowed)).toBe(true);
    expect(approvedCheckoutOrigin("http://localhost:8080", allowed)).toBe(true);
    expect(approvedCheckoutOrigin("https://attacker.example.org", allowed)).toBe(false);
    expect(approvedCheckoutOrigin("https://school.example.org/foreign", allowed)).toBe(false);
  });
  it("pilot costs EUR490, covers 1 centre and starts with 10 places", () => {
    expect(PACKAGE_RULES.pilot).toMatchObject({
      amount_cents: 49000,
      max_centres: 1,
      capacity: 10,
    });
  });
  it("district costs EUR1850, covers up to 5 centres and starts with 5 places", () => {
    expect(PACKAGE_RULES.district).toMatchObject({
      amount_cents: 185000,
      max_centres: 5,
      capacity: 5,
    });
  });
  it("regional costs EUR4500, covers up to 15 centres and starts with 2 places", () => {
    expect(PACKAGE_RULES.regional).toMatchObject({
      amount_cents: 450000,
      max_centres: 15,
      capacity: 2,
    });
  });
  it("guest contracting does not require a user account", () => {
    expect(contractingSchema.safeParse(contract).success).toBe(true);
  });
  it("requires institution name before checkout", () => {
    expect(contractingSchema.safeParse({ ...contract, institution_name: "" }).success).toBe(false);
  });
  it("requires billing email before checkout", () => {
    expect(contractingSchema.safeParse({ ...contract, billing_email: "" }).success).toBe(false);
  });
  it("consumes capacity per centre rather than per payment", () => {
    const p = {
      id: "district" as const,
      amount_cents: 185000,
      max_centres: 5,
      capacity: 5,
      available: 2,
    };
    expect(canContract(p, 2)).toBe(true);
    expect(canContract(p, 3)).toBe(false);
  });
  it("blocks a sold-out package", () => {
    expect(
      canContract(
        { id: "pilot", amount_cents: 49000, max_centres: 1, capacity: 10, available: 0 },
        1,
      ),
    ).toBe(false);
  });
  it("enforces the package centre maximum", () => {
    expect(
      contractingSchema.safeParse({ ...contract, centre_count: 2, centres: ["Uno", "Dos"] })
        .success,
    ).toBe(false);
  });
  it("records every designated centre and rejects duplicates", () => {
    expect(contractingSchema.safeParse({ ...contract, centres: [] }).success).toBe(false);
    expect(
      contractingSchema.safeParse({
        ...contract,
        package_id: "district",
        centre_count: 2,
        centres: ["Uno", "uno"],
      }).success,
    ).toBe(false);
  });
  it("allows solidarity places without inventing assigned schools", () => {
    expect(
      contractingSchema.safeParse({ ...contract, beneficiary_mode: "solidarity", centres: [] })
        .success,
    ).toBe(true);
  });
  it("accepts an authoritative completed paid session", () => {
    expect(isVerifiedPayment(order, paid)).toBe(true);
  });
  it("never activates an unpaid or cancelled checkout", () => {
    expect(isVerifiedPayment(order, { ...paid, payment_status: "unpaid" })).toBe(false);
    expect(isVerifiedPayment(order, { ...paid, status: "expired" })).toBe(false);
  });
  it("never activates a different amount, order, currency or environment", () => {
    for (const change of [
      { amount_total: 1 },
      { amount_subtotal: 1 },
      { currency: "usd" },
      { livemode: true },
      { id: "cs_test_other" },
      { metadata: { institutional_order_id: "other" } },
      { client_reference_id: "other" },
    ])
      expect(isVerifiedPayment(order, { ...paid, ...change })).toBe(false);
  });
});
