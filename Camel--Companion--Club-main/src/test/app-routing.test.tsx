import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import i18n from "@/i18n";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient(), translations: i18n },
    });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
  it.each([
    "/panel",
    "/datos",
    "/alertas",
    "/predicciones",
    "/planes",
    "/impacto",
    "/demo/impacto",
    "/auth",
    "/reset-password",
    "/etica",
    "/contratacion",
    "/contratacion/resultado",
  ])("matches the registered %s route", (url) => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient(), translations: i18n },
    });
    expect(router.matchRoutes(url).at(-1)?.routeId).not.toBe(rootRouteId);
  });
});
