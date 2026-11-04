import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { ImpactDesigner } from "./ImpactDesigner";
import type { CloudStudent } from "@/lib/edu/store";
import es from "@/i18n/locales/es.json";

const student: CloudStudent = {
  id: "81020000-0000-4000-8000-000000000001",
  school_id: "81020000-0000-4000-8000-000000000002",
  teacher_id: "81020000-0000-4000-8000-000000000003",
  code: "ALU-TEST-01",
  course: "2A",
  attendance: 71,
  grade: 4.2,
  submissions: 52,
  resource_usage: 12,
  observations: "",
  connectivity: "unknown",
  enrollment_status: "active",
  is_sample: true,
  created_at: "2026-10-07T00:00:00Z",
  updated_at: "2026-10-07T00:00:00Z",
};
beforeEach(async () => {
  await i18n.changeLanguage("es");
});
afterEach(cleanup);
describe("teacher approval in the real design component", () => {
  it("saves only the reviewed design, never hypothetical target values", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ImpactDesigner
        student={student}
        onSave={onSave}
        initialDraft={{ objective: "Tutoría semanal", notes: "Notas ficticias revisadas" }}
      />,
    );
    const approve = screen.getByRole("button", { name: es.impact.approve });
    expect(approve).toBeDisabled();
    fireEvent.click(screen.getAllByRole("button", { name: es.impact.select })[0]!);
    fireEvent.change(screen.getAllByRole("slider")[0]!, { target: { value: "99" } });
    expect(approve).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(approve);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      student_id: student.id,
      actions: ["tutoring"],
      reviewed: true,
      plan_id: null,
    });
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty("attendance");
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty("target");
    expect(student.attendance).toBe(71);
    await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked());
  });
  it("requires renewed review after a material edit", () => {
    render(
      <ImpactDesigner
        student={student}
        onSave={vi.fn()}
        initialDraft={{ objective: "Tutoría semanal", notes: "Notas de prueba" }}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: es.impact.select })[0]!);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: es.impact.approve })).toBeEnabled();
    fireEvent.change(screen.getByRole("textbox", { name: es.impact.objective }), {
      target: { value: "Otro objetivo revisable" },
    });
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: es.impact.approve })).toBeDisabled();
  });
  it("reports failed persistence without inventing a saved plan", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("offline"));
    render(
      <ImpactDesigner
        student={student}
        onSave={onSave}
        initialDraft={{ objective: "Tutoría semanal", notes: "Notas de prueba" }}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: es.impact.select })[0]!);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: es.impact.approve }));
    expect(await screen.findByRole("alert")).toHaveTextContent(es.impact.saveError);
  });
});
