import { EduSelect } from "@/components/edu/EduSelect";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CloudStudent, CloudProposal } from "@/lib/edu/store";
import { PRIORITIES, SUPPORT_ACTIONS, planSchema } from "@/lib/edu/cloud-schema";
import { evaluateStudent } from "@/lib/edu/alerts";
import { asStudentRecord } from "@/lib/edu/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function PlanEditor({
  student,
  proposal,
}: {
  student: CloudStudent;
  proposal?: CloudProposal;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [action, setAction] = useState(proposal?.support_action ?? "");
  const [priority, setPriority] = useState(proposal?.priority ?? "");
  const [notes, setNotes] = useState(proposal?.notes ?? "");
  const [detail, setDetail] = useState(proposal?.action_detail ?? "");
  const [reviewed, setReviewed] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const level = evaluateStudent(asStudentRecord(student)).level;
  const save = useMutation({
    mutationFn: async () => {
      const input = planSchema.parse({
        student_id: student.id,
        support_action: action,
        priority,
        notes,
        action_detail: detail,
        reviewed,
      });
      if (proposal) {
        const { error } = await supabase.rpc("edu_validate_proposal", {
          wanted_proposal: proposal.id,
          chosen_action: input.support_action,
          chosen_priority: input.priority,
          chosen_detail: input.action_detail,
          chosen_notes: input.notes,
          confirmed_review: input.reviewed,
        });
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("intervention_plans")
        .insert({
          ...input,
          school_id: student.school_id,
          teacher_id: student.teacher_id,
          is_sample: student.is_sample,
        })
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["edu"] });
      setAction("");
      setPriority("");
      setNotes("");
      setDetail("");
      setReviewed(false);
      toast.success(t("mascot.success"));
    },
    onError: () => toast.error(t("cloud.error")),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    const valid = planSchema.safeParse({
      student_id: student.id,
      support_action: action,
      priority,
      notes,
      action_detail: detail,
      reviewed,
    }).success;
    setInvalid(!valid);
    if (valid) save.mutate();
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-2xl">
        {t(proposal ? "plansCloud.pendingValidation" : "plansCloud.new")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("plansCloud.signal", { level: t(`levels.${level}`) })}
      </p>
      <label className="block space-y-2 font-bold">
        {t("plansCloud.action")}
        <EduSelect
          label={t("plansCloud.action")}
          value={action}
          required
          onChange={setAction}
          placeholder={t("cloud.select")}
          options={SUPPORT_ACTIONS.map((value) => ({
            value,
            label: t(`plansCloud.actions.${value}`),
          }))}
        />
      </label>
      <label className="block space-y-2 font-bold">
        {t("plansCloud.priority")}
        <EduSelect
          label={t("plansCloud.priority")}
          value={priority}
          required
          onChange={setPriority}
          placeholder={t("cloud.select")}
          options={PRIORITIES.map((value) => ({
            value,
            label: t(`plansCloud.priorities.${value}`),
          }))}
        />
      </label>
      <label className="block space-y-2 font-bold">
        {t("plansCloud.actionDetail")}
        <Textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
          maxLength={3000}
          required={Boolean(proposal)}
        />
      </label>
      <label className="block space-y-2 font-bold">
        {t("plansCloud.notes")}
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={3000}
          required
        />
      </label>
      <label className="flex items-start gap-3 text-sm font-bold">
        <input
          type="checkbox"
          className="mt-1"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
          required
        />
        {t("plansCloud.review")}
      </label>
      {invalid && (
        <p role="alert" className="text-destructive">
          {t("plansCloud.invalid")}
        </p>
      )}
      <Button type="submit" disabled={save.isPending}>
        <CheckCheck />
        {t(save.isPending ? "cloud.saving" : proposal ? "plansCloud.validate" : "planes.create")}
      </Button>
    </form>
  );
}
