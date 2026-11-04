import { expect, it } from "vitest";
import { predictionService } from "./prediction-service";

it("does not report a connected model when inference is not configured", async () => {
  expect(await predictionService.status()).toEqual({ connected: false, reason: "notConfigured" });
});
