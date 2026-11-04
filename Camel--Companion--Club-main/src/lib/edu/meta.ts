import i18n from "@/i18n";

export function eduPageHead(
  page:
    | "home"
    | "auth"
    | "reset"
    | "students"
    | "student"
    | "panel"
    | "alerts"
    | "predictions"
    | "plans"
    | "impact"
    | "ethics"
    | "licensing"
    | "paymentResult",
  translations: typeof i18n = i18n,
) {
  return eduHead(translations.t(`meta.${page}.title`), translations.t(`meta.${page}.description`));
}
export function eduHead(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — EduPulse Intelligence` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — EduPulse Intelligence` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
