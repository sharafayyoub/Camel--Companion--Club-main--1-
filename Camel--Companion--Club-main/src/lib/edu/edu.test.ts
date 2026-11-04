import { describe, expect, it } from "vitest";
import { evaluateStudent } from "./alerts";
import { parseStudentsCsv } from "./csv";

const base = {
  estudiante_id: "x",
  grupo: "1A",
  asistencia: 95,
  nota_media: 8,
  tareas_entregadas: 90,
};

describe("alert rules", () => {
  it("green when all indicators are above thresholds", () => {
    expect(evaluateStudent(base).level).toBe("verde");
  });
  it("red when attendance is below 75%", () => {
    expect(evaluateStudent({ ...base, asistencia: 74 }).level).toBe("rojo");
  });
  it("yellow when grade is between 5 and 6", () => {
    expect(evaluateStudent({ ...base, nota_media: 5.5 }).level).toBe("amarillo");
  });
  it("red when tasks delivered are below 60%", () => {
    expect(evaluateStudent({ ...base, tareas_entregadas: 59 }).level).toBe("rojo");
  });
  it("exposes attendance factors without changing the 75% threshold", () => {
    expect(evaluateStudent({ ...base, asistencia: 72.5 }).factors).toEqual([
      { metric: "asistencia", value: 72.5, threshold: 75, unit: "%" },
    ]);
  });
});

describe("csv validation", () => {
  it("does not convert a blank attendance value into a measured zero", () => {
    const result = parseStudentsCsv(
      "estudiante_id,grupo,asistencia,nota_media,tareas_entregadas\nA-01,1A,,7,80",
    );
    expect(result.rows).toEqual([]);
    expect(result.errors[0]?.line).toBe(2);
  });
  it("reports missing columns", () => {
    expect(parseStudentsCsv("estudiante_id,grupo\na,b").missingColumns).toEqual([
      "asistencia",
      "nota_media",
      "tareas_entregadas",
    ]);
  });
  it("rejects grade out of range with line number", () => {
    const r = parseStudentsCsv(
      "estudiante_id,grupo,asistencia,nota_media,tareas_entregadas\na,1A,90,11,80\nb,1A,90,7,80",
    );
    expect(r.rows).toHaveLength(1);
    expect(r.errors[0]?.line).toBe(2);
  });
  it("supports semicolon with decimal comma", () => {
    const r = parseStudentsCsv(
      "estudiante_id;grupo;asistencia;nota_media;tareas_entregadas\na;1A;90;6,5;80",
    );
    expect(r.rows[0]?.nota_media).toBe(6.5);
  });
});
