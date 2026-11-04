import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "./locales/es.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

export const SUPPORTED_LANGUAGES = ["es", "en", "fr"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = "edupulse.lang";
const COOKIE_KEY = "edupulse.lang";

/** Normalizes es-ES, en-US, fr-CA… to es/en/fr; rejects unknown values. */
export function normalizeLanguage(raw?: string | null): AppLanguage | null {
  if (!raw) return null;
  const base = raw.toLowerCase().split("-").at(0) ?? "";
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base) ? (base as AppLanguage) : null;
}

function fromCookie(cookieHeader: string | null | undefined): AppLanguage | null {
  if (!cookieHeader) return null;
  const match = new RegExp(`(?:^|;\\s*)${COOKIE_KEY.replace(".", "\\.")}=([^;]+)`).exec(
    cookieHeader,
  );
  return normalizeLanguage(match?.[1]);
}

function fromAcceptLanguage(header: string | null | undefined): AppLanguage | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const lang = normalizeLanguage(part.split(";").at(0)?.trim());
    if (lang) return lang;
  }
  return null;
}

/** Client-side detection: saved preference → browser language → Spanish. */
export function detectLanguage(): AppLanguage {
  try {
    const saved = normalizeLanguage(localStorage.getItem(STORAGE_KEY));
    if (saved) return saved;
  } catch {
    /* storage unavailable */
  }
  if (typeof document !== "undefined") {
    const savedCookie = fromCookie(document.cookie);
    if (savedCookie) return savedCookie;
  }
  if (typeof navigator !== "undefined") {
    const fromBrowser = normalizeLanguage(navigator.language);
    if (fromBrowser) return fromBrowser;
  }
  return "es";
}

/** Server-side detection (SSR): cookie → Accept-Language → Spanish. */
export function detectLanguageFromRequest(
  cookieHeader: string | null,
  acceptLanguage: string | null,
): AppLanguage {
  return fromCookie(cookieHeader) ?? fromAcceptLanguage(acceptLanguage) ?? "es";
}

export function persistLanguage(lang: AppLanguage) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable */
  }
  if (typeof document !== "undefined") {
    document.cookie = `${COOKIE_KEY}=${lang};path=/;max-age=31536000;SameSite=Lax`;
  }
}

// The client initializes synchronously with the detected language so the
// first render already matches what the server rendered (via cookie /
// Accept-Language in the root route's beforeLoad). No flash, no mismatch.
export const translationResources = {
  es: { translation: es },
  en: { translation: en },
  fr: { translation: fr },
};
export function createScopedI18n(language: AppLanguage) {
  const instance = i18n.createInstance();
  void instance.init({
    resources: translationResources,
    lng: language,
    fallbackLng: "es",
    initAsync: false,
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
  return instance;
}

i18n.use(initReactI18next).init({
  resources: translationResources,
  lng:
    typeof window === "undefined"
      ? "es"
      : (normalizeLanguage(document.documentElement.lang) ?? detectLanguage()),
  fallbackLng: "es",
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
  missingKeyHandler: (lng, ns, key) => {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key} (${lng})`);
  },
});

i18n.on("languageChanged", (lng) => {
  const lang = normalizeLanguage(lng) ?? "es";
  if (typeof window !== "undefined") persistLanguage(lang);
  if (typeof document !== "undefined") document.documentElement.lang = lang;
});

export function changeLanguage(lang: AppLanguage) {
  void i18n.changeLanguage(lang);
}

export default i18n;
