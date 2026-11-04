import { eduPageHead } from "@/lib/edu/meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Database, Search, LineChart, ShieldCheck, ClipboardList, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import camelWave from "@/assets/camel-wave.png";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useEduAuth } from "@/lib/edu/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: ({ match }) => eduPageHead("home", match.context.translations),
  component: Index,
});

const STEPS = [
  { icon: Database, k: "ingesta" },
  { icon: Search, k: "deteccion" },
  { icon: LineChart, k: "prediccion" },
  { icon: ClipboardList, k: "intervencion" },
] as const;

function Index() {
  const { t } = useTranslation();
  const { user, ready } = useEduAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (ready && user) void navigate({ to: "/panel", replace: true });
  }, [user, ready, navigate]);
  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 md:grid-cols-2">
        <img
          src={camelWave}
          alt={t("home.mascotAlt")}
          width={1024}
          height={1024}
          className="mx-auto w-full max-w-sm"
        />
        <div>
          <h1 className="text-5xl leading-tight text-foreground md:text-6xl">
            {t("home.title1")} <span className="text-primary">{t("home.title2")}</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">{t("home.subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button asChild size="lg" variant="secondary">
              <Link to="/demo/impacto">{t("impact.demo")}</Link>
            </Button>
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                {t("auth.signup")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">{t("auth.login")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-center text-4xl text-primary">{t("home.howTitle")}</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.k} className="card-sticker p-6">
              <s.icon className="h-10 w-10 text-secondary" />
              <h3 className="mt-4 text-xl text-foreground">{t(`home.steps.${s.k}.t`)}</h3>
              <p className="mt-2 text-muted-foreground">{t(`home.steps.${s.k}.d`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl bg-sand p-10 md:grid-cols-2">
        <div className="flex gap-4">
          <ShieldCheck className="h-10 w-10 shrink-0 text-primary" />
          <div>
            <h3 className="text-xl text-foreground">{t("home.ethics.t")}</h3>
            <p className="text-muted-foreground">{t("home.ethics.d")}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <Users className="h-10 w-10 shrink-0 text-secondary" />
          <div>
            <h3 className="text-xl text-foreground">{t("home.human.t")}</h3>
            <p className="text-muted-foreground">{t("home.human.d")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
