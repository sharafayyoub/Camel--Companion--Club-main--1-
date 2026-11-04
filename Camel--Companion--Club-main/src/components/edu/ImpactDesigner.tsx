import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Clock3,
  FlaskConical,
  GraduationCap,
  Wifi,
  Users,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EduSelect } from "./EduSelect";
import { StudentContext } from "./StudentContext";
import { LevelBadge } from "./ui";
import { evaluateStudent } from "@/lib/edu/alerts";
import type { CloudStudent, CloudPlan } from "@/lib/edu/store";
import {
  INTERVENTIONS,
  INTERVENTION_WEEKS,
  METRICS,
  illustrativeScenario,
  impactDesignSchema,
  baselineMetrics,
  type Intervention,
  type ImpactMetrics,
  type ImpactDesign,
  type ImpactStudy,
} from "@/lib/edu/impact";

const ICONS = { tutoring: GraduationCap, resources: Wifi, family: Users, mentoring: BookOpen };
export function ImpactDesigner({
  student,
  plan,
  study,
  onSave,
  initialDraft,
}: {
  student: CloudStudent;
  plan?: CloudPlan;
  study?: ImpactStudy;
  initialDraft?: { objective: string; notes: string };
  onSave: (design: ImpactDesign) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [actions, setActions] = useState<Intervention[]>(
    study?.actions ??
      (plan && INTERVENTIONS.includes(plan.support_action as Intervention)
        ? [plan.support_action as Intervention]
        : []),
  );
  const [weeks, setWeeks] = useState<number>(study?.duration_weeks ?? 6);
  const [priority, setPriority] = useState(plan?.priority ?? "medium");
  const [objective, setObjective] = useState(plan?.action_detail ?? initialDraft?.objective ?? "");
  const [notes, setNotes] = useState(plan?.notes ?? initialDraft?.notes ?? "");
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const baseline: ImpactMetrics = study
    ? baselineMetrics(study)
    : { attendance: student.attendance, grade: student.grade, submissions: student.submissions };
  const [target, setTarget] = useState<ImpactMetrics>(baseline);
  const scenario = illustrativeScenario(baseline, target);
  const nf = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  });
  const valueFormat = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = impactDesignSchema.safeParse({
      student_id: student.id,
      plan_id: plan?.id ?? null,
      actions,
      duration_weeks: weeks,
      priority,
      objective,
      notes,
      reviewed,
    });
    if (!input.success) {
      setError(t("impact.invalid"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(input.data);
      setReviewed(false);
    } catch {
      setError(t("impact.saveError"));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-8">
      <section className="impact-surface p-5 sm:p-6" aria-label={t("impact.context")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="impact-eyebrow">{t("impact.context")}</p>
            <h2 className="mt-1 text-2xl">
              {student.code}{" "}
              <span className="text-base font-semibold text-muted-foreground">
                · {student.course}
              </span>
            </h2>
          </div>
          <LevelBadge
            level={
              evaluateStudent({
                estudiante_id: student.code,
                grupo: student.course,
                asistencia: student.attendance,
                nota_media: student.grade,
                tareas_entregadas: student.submissions,
              }).level
            }
          />
        </div>
        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {METRICS.map((metric) => (
            <div key={metric} className="rounded-xl bg-muted p-4">
              <dt className="text-sm font-semibold text-muted-foreground">
                {t(`impact.metrics.${metric}`)}
              </dt>
              <dd className="mt-2 text-3xl font-bold tabular-nums">
                {new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(
                  student[metric],
                )}
                <span className="ml-1 text-sm font-semibold text-muted-foreground">
                  {metric === "grade" ? "/10" : "%"}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">{t("impact.participationProxy")}</p>
        <StudentContext student={student} />
      </section>
      <form onSubmit={submit} className="space-y-8" aria-label={t("impact.designForm")}>
        <fieldset disabled={saving} className="space-y-4">
          <legend className="mb-2 text-xl font-bold">{t("impact.compare")}</legend>
          <p className="text-sm text-muted-foreground">{t("impact.compareHelp")}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {INTERVENTIONS.map((action) => {
              const Icon = ICONS[action];
              const selected = actions.includes(action);
              return (
                <article
                  key={action}
                  className={`impact-surface flex min-w-0 flex-col p-5 ${selected ? "border-secondary bg-accent/30 ring-1 ring-secondary" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="size-6 text-secondary" aria-hidden />
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="size-3.5" aria-hidden />
                      {t("impact.weeks", { count: INTERVENTION_WEEKS[action] })}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg">{t(`plansCloud.actions.${action}`)}</h3>
                  <p className="mt-2 text-sm">{t(`impact.catalog.${action}.objective`)}</p>
                  <dl className="my-4 space-y-2 text-sm">
                    <div>
                      <dt className="font-bold">{t("impact.resources")}</dt>
                      <dd className="text-muted-foreground">
                        {t(`impact.catalog.${action}.resources`)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold">{t("impact.indicators")}</dt>
                      <dd className="text-muted-foreground">
                        {t(`impact.catalog.${action}.indicators`)}
                      </dd>
                    </div>
                  </dl>
                  <Button
                    className="mt-auto w-full"
                    type="button"
                    variant={selected ? "secondary" : "outline"}
                    aria-pressed={selected}
                    onClick={() => {
                      setActions(
                        selected ? actions.filter((a) => a !== action) : [...actions, action],
                      );
                      setReviewed(false);
                    }}
                  >
                    {selected && <Check aria-hidden />}
                    {t(selected ? "impact.selected" : "impact.select")}
                  </Button>
                </article>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t("impact.primaryAction")}</p>
        </fieldset>
        <section className="impact-surface p-5 sm:p-6" aria-labelledby="scenario-title">
          <div className="flex items-center gap-2 text-secondary">
            <FlaskConical className="size-5" aria-hidden />
            <h2 id="scenario-title" className="text-xl">
              {t("impact.scenario")}
            </h2>
          </div>
          <p className="mt-3 rounded-lg bg-accent p-3 text-sm font-semibold" role="note">
            {t("impact.scenarioNotice")}
          </p>
          <div className="mt-5 space-y-6">
            {METRICS.map((metric) => (
              <label key={metric} className="block space-y-3">
                <span className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-bold">{t(`impact.metrics.${metric}`)}</span>
                  <span className="tabular-nums">
                    {t("impact.targetValue", {
                      baseline: valueFormat.format(baseline[metric]),
                      target: valueFormat.format(target[metric]),
                      delta: nf.format(scenario.change[metric]),
                      unit:
                        metric === "grade" ? t("impact.gradePoints") : t("impact.percentagePoints"),
                    })}
                  </span>
                </span>
                <input
                  aria-label={t("impact.targetLabel", { metric: t(`impact.metrics.${metric}`) })}
                  type="range"
                  min="0"
                  max={metric === "grade" ? 10 : 100}
                  step={metric === "grade" ? 0.1 : 1}
                  value={target[metric]}
                  onChange={(event) =>
                    setTarget({ ...target, [metric]: event.target.valueAsNumber })
                  }
                  className="h-6 w-full accent-secondary"
                />
              </label>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t("impact.targetsNotEvidence")}</p>
        </section>
        <fieldset disabled={saving} className="impact-surface space-y-5 p-5 sm:p-6">
          <legend className="px-1 text-xl font-bold">{t("impact.decision")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-bold">
              {t("impact.duration")}
              <Input
                type="number"
                min="1"
                max="52"
                required
                value={Number.isNaN(weeks) ? "" : weeks}
                onChange={(event) => {
                  setWeeks(event.target.valueAsNumber);
                  setReviewed(false);
                }}
              />
            </label>
            <label className="block space-y-2 text-sm font-bold">
              {t("plansCloud.priority")}
              <EduSelect
                label={t("plansCloud.priority")}
                value={priority}
                onChange={(value) => {
                  setPriority(value);
                  setReviewed(false);
                }}
                options={["low", "medium", "high"].map((value) => ({
                  value,
                  label: t(`plansCloud.priorities.${value}`),
                }))}
              />
            </label>
          </div>
          <label className="block space-y-2 text-sm font-bold">
            {t("impact.objective")}
            <Textarea
              value={objective}
              required
              minLength={3}
              maxLength={3000}
              onChange={(event) => {
                setObjective(event.target.value);
                setReviewed(false);
              }}
            />
          </label>
          <label className="block space-y-2 text-sm font-bold">
            {t("plansCloud.notes")}
            <Textarea
              value={notes}
              required
              maxLength={3000}
              onChange={(event) => {
                setNotes(event.target.value);
                setReviewed(false);
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">{t("students.privacy")}</p>
          <label className="flex items-start gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-secondary"
              checked={reviewed}
              required
              onChange={(event) => setReviewed(event.target.checked)}
            />
            <span>{t("impact.review")}</span>
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={saving || !reviewed || actions.length === 0}
            className="h-auto min-h-11 whitespace-normal"
          >
            <ShieldCheck aria-hidden />
            {t(saving ? "cloud.saving" : plan ? "impact.updatePlan" : "impact.approve")}
          </Button>
        </fieldset>
      </form>
    </div>
  );
}
