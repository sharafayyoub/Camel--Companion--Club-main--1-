import es from "@/i18n/locales/es.json";
import en from "@/i18n/locales/en.json";
import fr from "@/i18n/locales/fr.json";
import { detectLanguageFromRequest } from "@/i18n";

export function renderErrorPage(request?: Request): string {
  const language = detectLanguageFromRequest(
    request?.headers.get("cookie") ?? null,
    request?.headers.get("accept-language") ?? null,
  );
  const copy = { es, en, fr }[language].common.error;
  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8" />
    <title>${escape(copy.title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${escape(copy.title)}</h1>
      <p>${escape(copy.text)}</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">${escape(copy.retry)}</button>
        <a class="secondary" href="/">${escape(copy.home)}</a>
      </div>
    </div>
  </body>
</html>`;
}
