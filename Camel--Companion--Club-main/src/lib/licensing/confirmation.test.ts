import { describe, expect, it, vi } from "vitest";
import {
  buildConfirmation,
  confirmationConfiguration,
  confirmationDestination,
  confirmationSenderSchema,
  deliverConfirmation,
  type ConfirmationJob,
} from "./confirmation";
import type { Receipt } from "./rules";

const paid: Receipt = {
  status: "active",
  institution_name: "School fixture",
  billing_email: "buyer@example.org",
  package_id: "pilot",
  centre_count: 1,
  centres: ["Centre fixture"],
  beneficiary_mode: "direct",
  amount_cents: 49000,
  environment: "live",
  paid_at: "2026-11-03T12:00:00Z",
  license_id: "licence-fixture",
};
describe("institutional purchase confirmation", () => {
  it.each(["pending", "preparing", "cancelled"] as const)(
    "does not confirm a %s purchase",
    (status) => {
      expect(() =>
        buildConfirmation({ ...paid, status }, "es", "confirmations@example.org"),
      ).toThrow("unverified_purchase");
    },
  );
  it("addresses only the saved billing email after activation", () => {
    const payload = buildConfirmation(paid, "es", "confirmations@example.org");
    expect(payload.to).toEqual(["buyer@example.org"]);
    expect(payload.text).toContain("licence-fixture");
    expect(payload.text).toContain("490,00");
  });
  it("requires a real sender instead of silently using the owner-only Resend domain", () => {
    expect(confirmationSenderSchema.safeParse(undefined).success).toBe(false);
    expect(confirmationSenderSchema.safeParse("onboarding@resend.dev").success).toBe(false);
    expect(confirmationSenderSchema.safeParse("confirmations@example.org").success).toBe(true);
  });
  it("sends hackathon sandbox confirmations only from onboarding@resend.dev to the specified Resend account email", () => {
    const payload = buildConfirmation(
      { ...paid, environment: "sandbox" },
      "es",
      "onboarding@resend.dev",
      "santibox888@gmail.com",
    );
    expect(payload.from).toBe("EduPulse Intelligence <onboarding@resend.dev>");
    expect(payload.to).toEqual(["santibox888@gmail.com"]);
    expect(payload.to).not.toContain("buyer@example.org");
  });
  it("does not allow the testing sender without a configured recipient", () => {
    expect(confirmationConfiguration("onboarding@resend.dev", undefined)).toBeNull();
    expect(() =>
      buildConfirmation({ ...paid, environment: "sandbox" }, "es", "onboarding@resend.dev"),
    ).toThrow("unconfigured_sender");
  });
  it("never redirects a live purchase to the hackathon recipient", () => {
    const config = confirmationConfiguration("onboarding@resend.dev", "santibox888@gmail.com");
    if (!config) throw new Error("Test configuration missing");
    expect(() => confirmationDestination(paid, config)).toThrow("testing_only");
    expect(() =>
      buildConfirmation(paid, "es", "onboarding@resend.dev", "santibox888@gmail.com"),
    ).toThrow("testing_only");
  });
  it("keeps normal billing recipients with a production sender even when a test recipient is configured", () => {
    const config = confirmationConfiguration("confirmations@example.org", "santibox888@gmail.com");
    if (!config) throw new Error("Test configuration missing");
    expect(confirmationDestination(paid, config)).toBe("buyer@example.org");
  });
  it("leaves solidarity places unassigned in the confirmation", () => {
    const payload = buildConfirmation(
      { ...paid, beneficiary_mode: "solidarity", centres: [] },
      "es",
      "confirmations@example.org",
    );
    expect(payload.text).toContain("Pendiente de asignación solidaria");
    expect(payload.text).not.toContain("Centre fixture");
  });
  it("reuses the saved payload and stable idempotency key after delivery failure", async () => {
    const payload = buildConfirmation(paid, "en", "confirmations@example.org");
    const job: ConfirmationJob = {
      order_id: "order-fixture",
      attempt_token: "claim-fixture",
      payload,
    };
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce("email-fixture");
    const finish = vi.fn();
    const prepare = vi.fn();
    const deps = { claim: async () => job, prepare, send, finish };
    expect(await deliverConfirmation(deps)).toBe("retry");
    expect(await deliverConfirmation(deps)).toBe("sent");
    expect(prepare).not.toHaveBeenCalled();
    expect(send.mock.calls).toEqual([
      [payload, "institutional-confirmation-v1-order-fixture"],
      [payload, "institutional-confirmation-v1-order-fixture"],
    ]);
    expect(finish).toHaveBeenLastCalledWith(job, "email-fixture", null);
  });
  it("preserves the accepted provider ID if the first acknowledgement fails", async () => {
    const payload = buildConfirmation(paid, "fr", "confirmations@example.org");
    const job: ConfirmationJob = {
      order_id: "order-fixture",
      attempt_token: "claim-fixture",
      payload,
    };
    const send = vi.fn().mockResolvedValue("accepted-email");
    const finish = vi
      .fn()
      .mockRejectedValueOnce(new Error("write failed"))
      .mockResolvedValueOnce(undefined);
    expect(
      await deliverConfirmation({ claim: async () => job, prepare: vi.fn(), send, finish }),
    ).toBe("sent");
    expect(send).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenLastCalledWith(job, "accepted-email", null);
  });
  it("does not send when no eligible paid confirmation is claimed", async () => {
    const send = vi.fn();
    expect(
      await deliverConfirmation({
        claim: async () => null,
        prepare: vi.fn(),
        send,
        finish: vi.fn(),
      }),
    ).toBe("idle");
    expect(send).not.toHaveBeenCalled();
  });
});
