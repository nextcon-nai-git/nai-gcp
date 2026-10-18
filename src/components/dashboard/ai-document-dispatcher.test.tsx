import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiDocumentDispatcher } from "./ai-document-dispatcher";

describe("entrada de importação documental", () => {
  it("direciona ao fluxo vigente com revisão humana sem prometer cadastros automáticos", () => {
    const html = renderToStaticMarkup(<AiDocumentDispatcher />);
    expect(html).toContain('href="/nai-importa"');
    expect(html).toContain("revise os dados antes de salvar");
    expect(html).not.toContain('type="file"');
    expect(html).not.toMatch(/CONSTRUFAM|Auto-Cria|Confiança:/);
  });
});
