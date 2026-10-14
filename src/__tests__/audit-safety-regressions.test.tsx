import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import GlobalError from "@/app/global-error";
import RouteError from "@/app/error";
import Accounting from "@/app/accounting/page";
import LegacyImport from "@/app/data-import/page";
describe("audit safety regressions", () => {
  it("never prints raw authentication/provider details in error pages", () => {
    const error = new Error(
      'insufficient permissions {"token":"private-test-token","email":"private@example.test"}'
    );
    for (const Component of [GlobalError, RouteError]) {
      const html = renderToStaticMarkup(<Component error={error} reset={() => {}} />);
      expect(html).not.toContain("private-test-token");
      expect(html).not.toContain("private@example.test");
    }
  });
  it("routes legacy accounting and mass seeding to supported workflows", () => {
    Accounting();
    LegacyImport();
    expect(mocks.redirect.mock.calls).toEqual([["/financial"], ["/nai-importa"]]);
  });
});
