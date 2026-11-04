import { describe, expect, it } from "vitest";
import { authDestination } from "./auth-destination";

describe("educational sign-in destination", () => {
  it("resumes students, alerts, predictions and plans after sign-in", () => {
    for (const path of ["/datos", "/alertas", "/predicciones", "/planes", "/estudiantes/abc"])
      expect(authDestination(path)).toBe(path);
  });
  it("never redirects to another origin", () => {
    for (const path of ["https://evil.test", "//evil.test", "/\\evil.test", undefined])
      expect(authDestination(path)).toBe("/panel");
  });
  it("prevents authentication redirect loops", () => {
    expect(authDestination("/auth?next=/datos")).toBe("/panel");
    expect(authDestination("/reset-password")).toBe("/panel");
  });
});
