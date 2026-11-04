import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { studentsOptions, plansOptions, proposalsOptions, loadEducation } from "@/lib/edu/store";
import { eduPageHead } from "@/lib/edu/meta";
import { StudentEditor } from "@/components/edu/StudentEditor";
import { PlanEditor } from "@/components/edu/PlanEditor";
import { PlanList } from "@/components/edu/PlanList";
import { ProposalList } from "@/components/edu/ProposalList";
import { StudentContext } from "@/components/edu/StudentContext";
import { Button } from "@/components/ui/button";
import { CloudError, CloudPending } from "@/components/edu/CloudFeedback";

export const Route = createFileRoute("/_authenticated/estudiantes/$studentId")({
  head: ({ match }) => eduPageHead("student", match.context.translations),
  loader: ({ context }) => loadEducation(context.queryClient),
  errorComponent: CloudError,
  pendingComponent: CloudPending,
  notFoundComponent: CloudError,
  component: StudentDetail,
});
function StudentDetail() {
  const { t } = useTranslation();
  const { studentId } = Route.useParams();
  const { data: students } = useSuspenseQuery(studentsOptions);
  const { data: plans } = useSuspenseQuery(plansOptions);
  const { data: proposals } = useSuspenseQuery(proposalsOptions);
  const student = students.find((s) => s.id === studentId);
  const navigate = useNavigate();
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", studentId)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["edu"] });
      await navigate({ to: "/datos", replace: true });
    },
    onError: () => toast.error(t("cloud.error")),
  });
  if (!student) return <p role="alert">{t("students.notFound")}</p>;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link to="/datos">
            <ArrowLeft />
            {t("students.title")}
          </Link>
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (window.confirm(t("students.deleteConfirm"))) remove.mutate();
          }}
          disabled={remove.isPending}
        >
          <Trash2 />
          {t("planes.delete")}
        </Button>
      </div>
      <h1 className="text-4xl">{student.code}</h1>
      <p className="mt-2 text-muted-foreground">{student.course}</p>
      <StudentContext student={student} />
      <Button asChild variant="secondary" className="mt-5">
        <Link to="/impacto" search={{ studentId: student.id }}>
          {t("impact.title")}
        </Link>
      </Button>
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-5 text-2xl">{t("students.metrics")}</h2>
          <StudentEditor
            key={student.id}
            student={student}
            schoolId={student.school_id}
            teacherId={student.teacher_id}
          />
        </section>
        <section className="border-t-2 pt-8 lg:border-l-2 lg:border-t-0 lg:pl-8 lg:pt-0">
          <PlanEditor student={student} />
        </section>
      </div>
      <section className="mt-10 border-t-2 pt-8">
        <h2 className="mb-5 text-2xl">{t("planes.title")}</h2>
        <PlanList plans={plans.filter((p) => p.student_id === student.id)} students={students} />
        <ProposalList
          proposals={proposals.filter((p) => p.student_id === student.id)}
          students={students}
        />
      </section>
    </div>
  );
}
