import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Level } from "@/lib/edu/types";
import { LanguageSwitcher } from "@/components/edu/LanguageSwitcher";
import camelThink from "@/assets/camel-think.png";
import { Button } from "@/components/ui/button";
import { useEduAuth } from "@/lib/edu/auth";
import {
  LogOut,
  LayoutDashboard,
  Users,
  Bell,
  ChartNoAxesCombined,
  ClipboardList,
  ShieldCheck,
  Building2,
  FlaskConical,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";

const NAV = [
  { to: "/panel", key: "panel", icon: LayoutDashboard },
  { to: "/datos", key: "datos", icon: Users },
  { to: "/alertas", key: "alertas", icon: Bell },
  { to: "/predicciones", key: "predicciones", icon: ChartNoAxesCombined },
  { to: "/planes", key: "planes", icon: ClipboardList },
  { to: "/impacto", key: "impact", icon: FlaskConical },
  { to: "/etica", key: "etica", icon: ShieldCheck },
] as const;

export function Header() {
  const { t } = useTranslation();
  const { user, ready, signOut } = useEduAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 border-b-2 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-3 sm:pb-0">
        <Link to="/" className="text-xl font-black text-primary sm:text-2xl">
          {t("common.appName")}
        </Link>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden h-auto min-h-10 max-w-40 whitespace-normal text-center sm:inline-flex"
          >
            <Link to="/contratacion">
              <Building2 className="shrink-0" />
              <span>{t("nav.licensing")}</span>
            </Link>
          </Button>
          <LanguageSwitcher />
          <Button
            className="sm:hidden"
            variant="ghost"
            size="icon"
            aria-label={t("nav.menu")}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
          </Button>
          {ready &&
            (user ? (
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("auth.signOut")}
                title={t("auth.signOut")}
                onClick={() => void signOut().catch(() => toast.error(t("cloud.error")))}
              >
                <LogOut />
              </Button>
            ) : (
              <Button asChild variant="secondary" className="hidden sm:inline-flex">
                <Link to="/auth">{t("auth.login")}</Link>
              </Button>
            ))}
        </div>
        <nav
          id="main-navigation"
          aria-label={t("common.navigation")}
          className={`${menuOpen ? "grid" : "hidden"} w-full grid-cols-3 gap-1 py-3 sm:grid sm:grid-cols-4 lg:grid-cols-7`}
        >
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2 text-center text-xs font-extrabold text-muted-foreground hover:bg-muted sm:text-sm"
              activeProps={{
                className: "bg-accent text-accent-foreground",
                "aria-current": "page",
              }}
            >
              <n.icon className="size-4 shrink-0" aria-hidden />
              <span className="break-words">{t(`nav.${n.key}`)}</span>
            </Link>
          ))}
          <Link
            to="/contratacion"
            onClick={() => setMenuOpen(false)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 py-2 text-center text-xs font-extrabold text-muted-foreground sm:hidden"
          >
            <Building2 className="size-4 shrink-0" aria-hidden />
            {t("nav.licensing")}
          </Link>
          {ready && !user && (
            <Link
              to="/auth"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center justify-center rounded-lg bg-secondary px-2 py-2 text-center text-xs font-extrabold text-secondary-foreground sm:hidden"
            >
              {t("auth.login")}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PageTitle({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="break-words text-3xl leading-tight text-foreground sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const LEVEL_STYLE: Record<Level, string> = {
  verde: "bg-emerald-100 text-emerald-900",
  amarillo: "bg-warning text-warning-foreground",
  rojo: "bg-destructive text-destructive-foreground",
};

export function LevelBadge({ level }: { level: Level }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold uppercase ${LEVEL_STYLE[level]}`}
    >
      {t(`levels.${level}`)}
    </span>
  );
}

export function DemoBadge({ show }: { show: boolean }) {
  const { t } = useTranslation();
  if (!show) return null;
  return (
    <span className="rounded-full border-2 border-secondary px-3 py-1 text-xs font-extrabold uppercase text-secondary">
      {t("common.demoData")}
    </span>
  );
}

export function EmptyState({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="card-sticker flex flex-col items-center p-10 text-center">
      <img
        src={camelThink}
        alt={t("mascot.thinking")}
        width={1024}
        height={1024}
        loading="lazy"
        className="h-40 w-40 object-contain"
      />
      <h2 className="mt-4 text-2xl text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-muted-foreground">{text}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
