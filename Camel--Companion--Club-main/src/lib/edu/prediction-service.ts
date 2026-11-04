/** Prediction service contract. The real adapter will call a FastAPI inference service. */
export type ModelStatus =
  | { connected: false; reason: "notConfigured" }
  | { connected: true; name: string; version: string };

export interface PredictionService {
  status(): Promise<ModelStatus>;
}

export const predictionService: PredictionService = {
  async status() {
    return { connected: false, reason: "notConfigured" };
  },
};
