import { eduPageHead } from "@/lib/edu/meta";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import camelWave from "@/assets/camel-wave.png";
import { PageTitle } from "@/components/edu/ui";

export const Route = createFileRoute("/etica")({
  head: ({ match }) => eduPageHead("ethics", match.context.translations),
  component: Etica,
});

const ITEMS = [
  "humano",
  "sinInventar",
  "explicabilidad",
  "privacidad",
  "equidad",
  "accesible",
] as const;

function Etica() {
  const { t } = useTranslation();
  return (
    <div>
      <PageTitle title={t("etica.title")} subtitle={t("etica.subtitle")} />
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {ITEMS.map((k) => (
            <div key={k} className="card-sticker p-5">
              <h3 className="text-lg text-primary">{t(`etica.items.${k}.t`)}</h3>
              <p className="mt-1 text-muted-foreground">{t(`etica.items.${k}.d`)}</p>
            </div>
          ))}
        </div>
        <img
          src={camelWave}
          alt={t("etica.mascotAlt")}
          width={1024}
          height={1024}
          loading="lazy"
          className="mx-auto w-60 object-contain"
        />
      </div>
    </div>
  );
}
