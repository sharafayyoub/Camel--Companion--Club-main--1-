import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import "@/i18n";
import i18n, { detectLanguageFromRequest, normalizeLanguage, persistLanguage } from "@/i18n";
import { I18nextProvider, useTranslation } from "react-i18next";
import { Header } from "@/components/edu/ui";
import { EduAuthProvider } from "@/lib/edu/auth";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("common.notFound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("common.notFound.text")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("common.notFound.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const { t } = useTranslation();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("common.error.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("common.error.text")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("common.error.retry")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("common.error.home")}
          </a>
        </div>
      </div>
    </div>
  );
}

// Server function: detects the visitor's language from the request
// (cookie or Accept-Language) so SSR renders in the same language the
// client will use — no flash, no hydration mismatch.
const detectServerLanguage = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  return detectLanguageFromRequest(
    getRequestHeader("cookie") ?? null,
    getRequestHeader("accept-language") ?? null,
  );
});

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  translations: typeof i18n;
}>()({
  beforeLoad: async ({ context }) => {
    if (typeof window !== "undefined") return;
    const lang = await detectServerLanguage();
    if (context.translations.language !== lang) await context.translations.changeLanguage(lang);
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "EduPulse Intelligence" },
      {
        name: "description",
        content: "Inteligencia educativa para detectar, comprender y mejorar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const { translations } = Route.useRouteContext();
  return (
    <I18nextProvider i18n={translations}>
      <DocumentShell>{children}</DocumentShell>
    </I18nextProvider>
  );
}

function DocumentShell({ children }: { children: ReactNode }) {
  const { i18n: language } = useTranslation();
  return (
    <html lang={language.resolvedLanguage ?? language.language}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient, translations } = Route.useRouteContext();
  const { t } = useTranslation();
  useEffect(() => {
    // The SSR language is authoritative for the first hydration, including deferred
    // pending boundaries. Repair a stale/missing preference cookie without changing
    // an external store while those boundaries are hydrating.
    persistLanguage(normalizeLanguage(translations.language) ?? "es");
  }, [translations]);

  return (
    <QueryClientProvider client={queryClient}>
      <EduAuthProvider>
        <a href="#main-content" className="skip-link">
          {t("common.skipContent")}
        </a>
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10"
        >
          <Outlet />
        </main>
        <footer className="border-t-2 py-6 text-center text-sm text-muted-foreground">
          {t("common.footer")}
        </footer>
        <Toaster />
      </EduAuthProvider>
    </QueryClientProvider>
  );
}
