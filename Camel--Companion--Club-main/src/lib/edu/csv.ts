import { z } from "zod";
import type { StudentRecord } from "./types";

export const REQUIRED_COLUMNS = [
  "estudiante_id",
  "grupo",
  "asistencia",
  "nota_media",
  "tareas_entregadas",
] as const;

const rowSchema = z.object({
  estudiante_id: z.string().trim().min(1, "ID vacío"),
  grupo: z.string().trim().min(1, "Grupo vacío"),
  asistencia: z
    .string()
    .trim()
    .min(1, "Asistencia vacía")
    .pipe(z.coerce.number<string>({ error: "Asistencia no numérica" }).finite().min(0).max(100)),
  nota_media: z
    .string()
    .trim()
    .min(1, "Nota vacía")
    .pipe(z.coerce.number<string>({ error: "Nota no numérica" }).finite().min(0).max(10)),
  tareas_entregadas: z
    .string()
    .trim()
    .min(1, "Tareas vacías")
    .pipe(z.coerce.number<string>({ error: "Tareas no numéricas" }).finite().min(0).max(100)),
});

export type CsvResult = {
  rows: StudentRecord[];
  errors: { line: number; message: string }[];
  missingColumns: string[];
};

function splitLine(line: string, sep: string) {
  return line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
}

export function parseStudentsCsv(text: string): CsvResult {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim() !== "");
  if (lines.length === 0)
    return {
      rows: [],
      errors: [{ line: 0, message: "Archivo vacío" }],
      missingColumns: [...REQUIRED_COLUMNS],
    };
  const first = lines[0] ?? "";
  const sep = first.includes(";") ? ";" : ",";
  const header = splitLine(first, sep).map((h) => h.toLowerCase());
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missingColumns.length) return { rows: [], errors: [], missingColumns };

  const rows: StudentRecord[] = [];
  const errors: CsvResult["errors"] = [];
  lines.slice(1).forEach((line, i) => {
    const cells = splitLine(line, sep);
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => (obj[h] = (cells[idx] ?? "").replace(",", sep === ";" ? "." : ",")));
    const parsed = rowSchema.safeParse(obj);
    if (parsed.success) rows.push(parsed.data);
    else
      errors.push({
        line: i + 2,
        message: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "),
      });
  });
  return { rows, errors, missingColumns: [] };
}
