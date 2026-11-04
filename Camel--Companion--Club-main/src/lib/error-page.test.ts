import { expect, it } from "vitest";
import { renderErrorPage } from "./error-page";
import es from "@/i18n/locales/es.json";
import en from "@/i18n/locales/en.json";
import fr from "@/i18n/locales/fr.json";

it.each(Object.entries({ es, en, fr }))(
  "localizes the last-resort error page in %s",
  (language, copy) => {
    const html = renderErrorPage(
      new Request("https://example.test", { headers: { Cookie: `edupulse.lang=${language}` } }),
    );
    expect(html).toContain(`lang="${language}"`);
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.querySelector("h1")?.textContent).toBe(copy.common.error.title);
    expect(document.querySelector("button")?.textContent).toBe(copy.common.error.retry);
  },
);
