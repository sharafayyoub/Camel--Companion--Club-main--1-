import { describe, expect, it } from "vitest";
import i18n, {
  changeLanguage,
  detectLanguage,
  normalizeLanguage,
  persistLanguage,
  SUPPORTED_LANGUAGES,
} from "./index";
import es from "./locales/es.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

type Json = Record<string, unknown>;
function flatKeys(obj: Json, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? flatKeys(v as Json, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe("translation key parity", () => {
  const esKeys = flatKeys(es as Json).sort();
  it("english has exactly the same keys as spanish", () => {
    expect(flatKeys(en as Json).sort()).toEqual(esKeys);
  });
  it("french has exactly the same keys as spanish", () => {
    expect(flatKeys(fr as Json).sort()).toEqual(esKeys);
  });
  it("no translation value is empty", () => {
    for (const locale of [es, en, fr]) {
      for (const key of flatKeys(locale as Json)) {
        const v = key.split(".").reduce<unknown>((o, p) => (o as Json)[p], locale);
        if (typeof v === "string") expect(v.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("language detection and normalization", () => {
  it("normalizes regional variants to base languages", () => {
    expect(normalizeLanguage("es-ES")).toBe("es");
    expect(normalizeLanguage("es-MX")).toBe("es");
    expect(normalizeLanguage("en-US")).toBe("en");
    expect(normalizeLanguage("en-GB")).toBe("en");
    expect(normalizeLanguage("fr-FR")).toBe("fr");
    expect(normalizeLanguage("fr-CA")).toBe("fr");
  });
  it("rejects unknown languages", () => {
    expect(normalizeLanguage("de-DE")).toBeNull();
    expect(normalizeLanguage("")).toBeNull();
    expect(normalizeLanguage(null)).toBeNull();
  });
  it("uses the browser language when supported, else spanish", () => {
    localStorage.removeItem("edupulse.lang");
    // jsdom reports en-US, so the browser fallback applies here.
    expect(detectLanguage()).toBe("en");
  });
  it("prefers the saved preference", () => {
    localStorage.setItem("edupulse.lang", "fr");
    expect(detectLanguage()).toBe("fr");
    localStorage.removeItem("edupulse.lang");
  });
  it("ignores an invalid saved value and falls back to the browser language", () => {
    localStorage.setItem("edupulse.lang", "klingon");
    expect(detectLanguage()).toBe("en");
    localStorage.removeItem("edupulse.lang");
  });
});

describe("language switching", () => {
  it("defaults to spanish and switches without reload", async () => {
    await i18n.changeLanguage("es");
    expect(i18n.t("nav.panel")).toBe("Panel");
    await i18n.changeLanguage("en");
    expect(i18n.t("nav.panel")).toBe("Dashboard");
    await i18n.changeLanguage("fr");
    expect(i18n.t("nav.panel")).toBe("Tableau de bord");
    await i18n.changeLanguage("es");
  });
  it("persists the choice to localStorage", async () => {
    changeLanguage("fr");
    await new Promise((r) => setTimeout(r, 10));
    expect(localStorage.getItem("edupulse.lang")).toBe("fr");
    changeLanguage("es");
    await new Promise((r) => setTimeout(r, 10));
    expect(localStorage.getItem("edupulse.lang")).toBe("es");
  });
  it("updates document.documentElement.lang", async () => {
    changeLanguage("en");
    await new Promise((r) => setTimeout(r, 10));
    expect(document.documentElement.lang).toBe("en");
    changeLanguage("es");
  });
  it("supports exactly es, en, fr", () => {
    expect(SUPPORTED_LANGUAGES).toEqual(["es", "en", "fr"]);
  });
  it("interpolates parameters in all languages", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("datos.activeData", { name: "demo", count: 5 })).toBe(
      "Active data: demo (5 rows)",
    );
    await i18n.changeLanguage("fr");
    expect(i18n.t("datos.activeData", { name: "demo", count: 5 })).toBe(
      "Données actives : demo (5 lignes)",
    );
    await i18n.changeLanguage("es");
  });
});

describe("Intl formatting per locale", () => {
  it("formats numbers per locale", () => {
    expect(new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(1234.5)).toBe("1234,5");
    expect(new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(1234.5)).toBe(
      "1,234.5",
    );
  });
  it("formats dates per locale", () => {
    const d = new Date(Date.UTC(2026, 0, 15));
    expect(new Intl.DateTimeFormat("es", { month: "long" }).format(d)).toBe("enero");
    expect(new Intl.DateTimeFormat("en", { month: "long" }).format(d)).toBe("January");
    expect(new Intl.DateTimeFormat("fr", { month: "long" }).format(d)).toBe("janvier");
  });
});
