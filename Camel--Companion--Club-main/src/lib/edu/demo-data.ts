import type { StudentRecord } from "./types";

// Deterministic demo dataset (clearly labelled as demo in the UI).
function rand(seed: number) {
  let s = seed;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

export function buildDemoData(): StudentRecord[] {
  const r = rand(42);
  const grupos = ["1ºA", "1ºB", "2ºA", "2ºB", "3ºA"];
  const out: StudentRecord[] = [];
  grupos.forEach((g, gi) => {
    for (let i = 1; i <= 20; i++) {
      const base = 0.55 + gi * 0.07;
      out.push({
        estudiante_id: `${g.replace("º", "")}-${String(i).padStart(2, "0")}`,
        grupo: g,
        asistencia: Math.round(Math.min(100, 65 + r() * 35 * base + 10)),
        nota_media: +Math.min(10, 3 + r() * 7 * base + 1.5).toFixed(1),
        tareas_entregadas: Math.round(Math.min(100, 45 + r() * 55 * base + 10)),
      });
    }
  });
  return out;
}

export const DEMO_TREND = ["Sep", "Oct", "Nov", "Dic", "Ene", "Feb"].map((mes, i) => ({
  mes,
  asistencia: [92, 90, 88, 85, 87, 86][i],
  nota: [6.8, 6.5, 6.4, 6.1, 6.3, 6.2][i],
}));

export const SAMPLE_CSV = `estudiante_id,grupo,asistencia,nota_media,tareas_entregadas
A-01,1ºA,95,7.5,90
A-02,1ºA,72,4.2,55
A-03,1ºA,83,5.8,70
B-01,1ºB,88,6.9,80
`;
