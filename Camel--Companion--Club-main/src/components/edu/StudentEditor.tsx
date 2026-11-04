import { EduSelect } from "@/components/edu/EduSelect";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CONNECTIVITY, studentSchema, type StudentInput } from "@/lib/edu/cloud-schema";
import type { CloudStudent } from "@/lib/edu/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function StudentEditor({
  student,
  schoolId,
  teacherId,
  onSaved,
}: {
  student?: CloudStudent;
  schoolId: string;
  teacherId: string;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [form, setForm] = useState<StudentInput>(() =>
    student
      ? studentSchema.parse(student)
      : {
          code: "",
          course: "",
          attendance: NaN,
          submissions: NaN,
          resource_usage: NaN,
          grade: NaN,
          observations: "",
          connectivity: "unknown",
          enrollment_status: "active",
        },
  );
  const [invalid, setInvalid] = useState(false);
  const save = useMutation({
    mutationFn: async (data: StudentInput) => {
      const payload = studentSchema.parse(data);
      const result = student
        ? await supabase.from("students").update(payload).eq("id", student.id).select("id").single()
        : await supabase
            .from("students")
            .insert({ ...payload, school_id: schoolId, teacher_id: teacherId })
            .select("id")
            .single();
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["edu"] });
      toast.success(t("cloud.saved"));
      onSaved?.();
    },
    onError: (error: { code?: string }) =>
      toast.error(t(error.code === "23505" ? "students.duplicate" : "cloud.error")),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = studentSchema.safeParse(form);
    setInvalid(!parsed.success);
    if (parsed.success) save.mutate(parsed.data);
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 font-bold">
          {t("students.code")}
          <Input
            value={form.code}
            placeholder="ALU-2041"
            maxLength={32}
            required
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
        </label>
        <label className="space-y-2 font-bold">
          {t("students.course")}
          <Input
            value={form.course}
            maxLength={80}
            required
            onChange={(e) => setForm({ ...form, course: e.target.value })}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["attendance", "submissions", "resource_usage", "grade"] as const).map((key) => (
          <label key={key} className="space-y-2 font-bold">
            {t(`students.${key}`)}
            <Input
              type="number"
              min={0}
              max={key === "grade" ? 10 : 100}
              step="0.1"
              required
              value={Number.isNaN(form[key]) ? "" : form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.valueAsNumber })}
            />
          </label>
        ))}
      </div>
      <label className="block space-y-2 font-bold">
        {t("students.connectivity")}
        <EduSelect
          label={t("students.connectivity")}
          value={form.connectivity}
          onChange={(value) => {
            const connectivity = CONNECTIVITY.find((option) => option === value);
            if (connectivity) setForm({ ...form, connectivity });
          }}
          options={CONNECTIVITY.map((value) => ({
            value,
            label: t(`students.connectivityOptions.${value}`),
          }))}
        />
      </label>
      <label className="block space-y-2 font-bold">
        {t("students.enrollment")}
        <EduSelect
          label={t("students.enrollment")}
          value={form.enrollment_status}
          onChange={(value) => {
            if (value === "active" || value === "completed" || value === "withdrawn")
              setForm({ ...form, enrollment_status: value });
          }}
          options={["active", "completed", "withdrawn"].map((value) => ({
            value,
            label: t(`students.status.${value}`),
          }))}
        />
      </label>
      <label className="block space-y-2 font-bold">
        {t("students.observations")}
        <Textarea
          rows={4}
          maxLength={3000}
          value={form.observations}
          onChange={(e) => setForm({ ...form, observations: e.target.value })}
        />
      </label>
      <p className="text-sm text-muted-foreground">{t("students.privacy")}</p>
      {invalid && (
        <p role="alert" className="text-destructive">
          {t("students.invalid")}
        </p>
      )}
      <Button type="submit" disabled={save.isPending}>
        <Save />
        {t(save.isPending ? "cloud.saving" : "cloud.save")}
      </Button>
    </form>
  );
}
