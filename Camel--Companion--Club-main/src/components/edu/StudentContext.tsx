import { useTranslation } from "react-i18next";
import type { CloudStudent } from "@/lib/edu/store";

export function StudentContext({ student }: { student: CloudStudent | undefined }) {
  const { t } = useTranslation();
  if (!student) return null;
  return (
    <div className="mt-3 min-w-0 space-y-2 text-sm">
      <p className="font-bold text-secondary">
        {t("students.connectivity")}: {t(`students.connectivityOptions.${student.connectivity}`)}
      </p>
      {student.observations && (
        <p className="whitespace-pre-wrap break-words text-muted-foreground">
          <span className="font-bold">{t("students.observations")}: </span>
          {student.observations}
        </p>
      )}
      {student.is_sample && (
        <p className="text-xs font-bold text-secondary">{t("common.demoData")}</p>
      )}
    </div>
  );
}
