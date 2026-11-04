import type { Alert, Level, StudentRecord } from "./types";

/** Transparent, rule-based thresholds (not AI). */
export const THRESHOLDS = {
  asistencia: { rojo: 75, amarillo: 85 },
  nota_media: { rojo: 5, amarillo: 6 },
  tareas_entregadas: { rojo: 60, amarillo: 75 },
} as const;

const LABELS = {
  asistencia: "Asistencia",
  nota_media: "Nota media",
  tareas_entregadas: "Tareas entregadas",
};
const UNITS = { asistencia: "%", nota_media: "", tareas_entregadas: "%" };

export function evaluateStudent(s: StudentRecord): Alert {
  let level: Level = "verde";
  const reasons: string[] = [];
  const factors: Alert["factors"] = [];
  (Object.keys(THRESHOLDS) as (keyof typeof THRESHOLDS)[]).forEach((k) => {
    const v = s[k];
    const t = THRESHOLDS[k];
    if (v < t.rojo) {
      level = "rojo";
      reasons.push(`${LABELS[k]} ${v}${UNITS[k]} < ${t.rojo}${UNITS[k]}`);
      factors.push({ metric: k, value: v, threshold: t.rojo, unit: UNITS[k] });
    } else if (v < t.amarillo) {
      if (level !== "rojo") level = "amarillo";
      reasons.push(`${LABELS[k]} ${v}${UNITS[k]} < ${t.amarillo}${UNITS[k]}`);
      factors.push({ metric: k, value: v, threshold: t.amarillo, unit: UNITS[k] });
    }
  });
  return { estudiante_id: s.estudiante_id, grupo: s.grupo, level, reasons, factors };
}

export function buildAlerts(rows: StudentRecord[]): Alert[] {
  return rows.map(evaluateStudent).filter((a) => a.level !== "verde");
}

export function groupSummary(rows: StudentRecord[]) {
  const groups = new Map<string, StudentRecord[]>();
  rows.forEach((r) => groups.set(r.grupo, [...(groups.get(r.grupo) ?? []), r]));
  return [...groups.entries()]
    .map(([grupo, rs]) => {
      const avg = (k: keyof typeof THRESHOLDS) =>
        +(rs.reduce((a, r) => a + r[k], 0) / rs.length).toFixed(1);
      const evals = rs.map(evaluateStudent);
      const rojos = evals.filter((e) => e.level === "rojo").length;
      const amarillos = evals.filter((e) => e.level === "amarillo").length;
      const level: Level =
        rojos / rs.length >= 0.25
          ? "rojo"
          : (rojos + amarillos) / rs.length >= 0.25
            ? "amarillo"
            : "verde";
      return {
        grupo,
        total: rs.length,
        asistencia: avg("asistencia"),
        nota_media: avg("nota_media"),
        tareas_entregadas: avg("tareas_entregadas"),
        rojos,
        amarillos,
        level,
      };
    })
    .sort((a, b) => a.grupo.localeCompare(b.grupo));
}
