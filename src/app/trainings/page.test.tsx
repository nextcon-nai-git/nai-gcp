import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TrainingDashboard from "./page";

describe("training evidence boundaries", () => {
  it("does not claim operational compliance or live measurements without a connected source", () => {
    const html = renderToStaticMarkup(<TrainingDashboard />);
    expect(html).toContain("Base de treinamentos ainda não conectada");
    expect(html).toContain("Não apurado");
    expect(html).not.toContain("98%");
    expect(html).not.toContain("40h / 5 Dias");
    expect(html).not.toContain("subiu 15%");
    expect(html).not.toContain("Live");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Novo Treinamento/);
  });
});
