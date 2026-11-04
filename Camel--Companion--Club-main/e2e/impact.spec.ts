import { test, expect } from "@playwright/test";
import es from "../src/i18n/locales/es.json" with { type: "json" };
import en from "../src/i18n/locales/en.json" with { type: "json" };
import fr from "../src/i18n/locales/fr.json" with { type: "json" };

for (const [lang, text] of Object.entries({ es, en, fr })) {
  test(`fictional Impact Lab workflow in ${lang}`, async ({ page }, testInfo) => {
    const exceptions: string[] = [];
    const externalDataCalls: string[] = [];
    page.on("pageerror", (error) => exceptions.push(error.message));
    page.on("request", (request) => {
      if (request.url().includes("/rest/v1/") || request.url().includes("/auth/v1/"))
        externalDataCalls.push(request.url());
    });
    await page.addInitScript((language) => localStorage.setItem("edupulse.lang", language), lang);
    await page
      .context()
      .addCookies([{ name: "edupulse.lang", value: lang, url: "http://127.0.0.1:4173" }]);
    await page.goto("/demo/impacto");
    await expect(page.getByRole("heading", { name: text.impact.title, exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: text.impact.approve, exact: true }),
    ).toBeDisabled();
    await expect(page.getByText(text.impact.demoNotice, { exact: true })).toBeVisible();
    if (testInfo.project.name === "mobile") {
      const menu = page.getByRole("button", { name: text.nav.menu });
      await menu.click();
      await expect(page.getByRole("navigation")).toBeVisible();
      await menu.click();
      await expect(page.getByRole("navigation")).toBeHidden();
    }
    // Select a combination, then change a target without contaminating observed data.
    const add = page.getByRole("button", { name: text.impact.select, exact: true });
    await add.nth(0).click();
    await add.nth(0).click();
    const slider = page.getByRole("slider").first();
    await slider.fill("95");
    await slider.dispatchEvent("input");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: text.impact.approve, exact: true }).click();
    await expect(page.getByText(text.impact.demoApproved, { exact: true })).toBeVisible();
    await expect(page.getByText(text.impact.noFollowups, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: text.impact.loadExample, exact: true }).click();
    const table = page.getByRole("table").first();
    await expect(table.getByRole("row")).toHaveCount(3);
    // Baseline stays at 71; sample follow-up is 82, never the hypothetical 95 target.
    await expect(table.getByRole("cell", { name: "71", exact: true })).toBeVisible();
    await expect(table.getByRole("cell", { name: "82", exact: true })).toBeVisible();
    await expect(table.getByRole("cell", { name: "95", exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: text.impact.loadExample, exact: true }),
    ).toBeDisabled();
    // Root layout must stay within the screen; wide data tables scroll inside their own container.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    if (lang === "es") {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath("impact.png"), fullPage: true });
      await page.screenshot({ path: testInfo.outputPath("impact-viewport.png") });
    }
    expect(exceptions).toEqual([]);
    expect(externalDataCalls).toEqual([]);
    await page.reload();
    await expect(
      page.getByRole("button", { name: text.impact.approve, exact: true }),
    ).toBeDisabled();
    await expect(page.getByText(text.impact.demoApproved, { exact: true })).toHaveCount(0);
  });
}

test("public routes and protected routes with no Cloud configuration", async ({ page }) => {
  const exceptions: string[] = [];
  page.on("pageerror", (error) => exceptions.push(error.message));
  await page.addInitScript(() => localStorage.setItem("edupulse.lang", "es"));
  for (const url of ["/", "/etica", "/contratacion", "/auth", "/reset-password", "/demo/impacto"]) {
    await page.goto(url);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("This page didn't load");
  }
  for (const url of ["/panel", "/datos", "/alertas", "/planes", "/predicciones", "/impacto"]) {
    await page.goto(url);
    await expect(page).toHaveURL(/\/auth\?/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(url);
  }
  expect(exceptions).toEqual([]);
});

test("SSR isolates simultaneous languages and honors cookie preference", async ({ request }) => {
  const results = await Promise.all(
    Array.from({ length: 12 }, async (_, i) => {
      const language = ["es", "en", "fr"][i % 3]!;
      const response = await request.get("/etica", {
        headers: { Cookie: `edupulse.lang=${language}`, "Accept-Language": "de-DE" },
      });
      const html = await response.text();
      expect(html).toContain(`lang="${language}"`);
      const text = { es, en, fr }[language as "es" | "en" | "fr"];
      expect(html).toContain(text.etica.title);
    }),
  );
  expect(results).toHaveLength(12);
});
