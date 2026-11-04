import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CloudProposal, CloudStudent } from "@/lib/edu/store";
import { PlanEditor } from "./PlanEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ProposalList({
  proposals,
  students,
}: {
  proposals: CloudProposal[];
  students: CloudStudent[];
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const proposal = proposals.find((p) => p.id === selected);
  const student = students.find((s) => s.id === proposal?.student_id);
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("intervention_proposals")
        .delete()
        .eq("id", id)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["edu"] }),
    onError: () => toast.error(t("cloud.error")),
  });
  if (!proposals.length) return null;
  return (
    <section className="mt-8 space-y-4">
      <h2 className="text-2xl">{t("plansCloud.pendingValidation")}</h2>
      {proposals.map((p) => (
        <article key={p.id} className="rounded-lg border-2 border-primary p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                className="font-black text-secondary"
                to="/estudiantes/$studentId"
                params={{ studentId: p.student_id }}
              >
                {students.find((s) => s.id === p.student_id)?.code}
              </Link>
              <h3 className="mt-2 break-words text-lg">{p.action_detail}</h3>
              <p className="mt-2 text-sm font-bold text-secondary">
                {t("plansCloud.pendingValidation")}
                {p.is_sample ? ` · ${t("common.demoData")}` : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={remove.isPending}
              title={t("planes.delete")}
              aria-label={t("planes.delete")}
              onClick={() => {
                if (window.confirm(t("plansCloud.deleteConfirm"))) remove.mutate(p.id);
              }}
            >
              <Trash2 />
            </Button>
          </div>
          {p.notes && <p className="mt-3 whitespace-pre-wrap break-words">{p.notes}</p>}
          <Button className="mt-4" variant="outline" onClick={() => setSelected(p.id)}>
            <CheckCheck />
            {t("plansCloud.reviewProposal")}
          </Button>
        </article>
      ))}
      <Dialog
        open={Boolean(proposal && student)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>{student?.code}</DialogTitle>
          </DialogHeader>
          {proposal && student && (
            <PlanEditor key={proposal.id} student={student} proposal={proposal} />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
