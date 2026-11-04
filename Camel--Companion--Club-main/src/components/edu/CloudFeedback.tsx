import { useTranslation } from "react-i18next";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export function CloudError() {
  const { t } = useTranslation();
  const router = useRouter();
  const client = useQueryClient();
  return (
    <div role="alert" className="space-y-4 py-12 text-center">
      <h1 className="text-2xl">{t("cloud.error")}</h1>
      <Button
        onClick={async () => {
          await client.invalidateQueries({ queryKey: ["edu"] });
          await router.invalidate();
        }}
      >
        {t("common.error.retry")}
      </Button>
    </div>
  );
}
export function CloudPending() {
  const { t } = useTranslation();
  return (
    <p className="py-12 text-center text-muted-foreground" role="status">
      {t("cloud.loading")}
    </p>
  );
}
