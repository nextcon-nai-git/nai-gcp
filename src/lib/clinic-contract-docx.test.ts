import { describe, expect, it } from "vitest";
import { contractEmailDraft, replaceDocxFields, templateMatches } from "./clinic-contract-docx";
import { ClinicContractFieldsSchema, emptyContractFields } from "./clinic-contract";

describe("minuta de credenciamento", () => {
  it("preenche placeholders fragmentados preservando estilos e condições comerciais", () => {
    const xml =
      "<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>[RAZÃO SOCIAL</w:t></w:r><w:r><w:t> DA CLÍNICA]</w:t></w:r><w:r><w:t> — R$ 30,00 — 24h/72h — [RAZÃO SOCIAL DA CLÍNICA]</w:t></w:r></w:p>";
    const filled = replaceDocxFields(xml, {
      "[RAZÃO SOCIAL DA CLÍNICA]": "Saúde & Trabalho <Exemplo>",
    });
    expect(filled).toContain("<w:b/>");
    expect(filled).toContain("Saúde &amp; Trabalho &lt;Exemplo&gt;");
    expect(filled).toContain("R$ 30,00 — 24h/72h");
    expect(filled).not.toContain("[RAZÃO");
    expect(filled.match(/Saúde/g)).toHaveLength(2);
  });
  it("não remove campos vazios nem condições propostas entre colchetes", () => {
    const xml = "<w:p><w:r><w:t>[e-mail CREDENCIADA] e multa [20%]</w:t></w:r></w:p>";
    expect(replaceDocxFields(xml, { "[e-mail CREDENCIADA]": "" })).toBe(xml);
    expect(templateMatches(Buffer.from("arbitrary document"))).toBe(false);
  });
  it("impede injeção de cabeçalhos e variáveis imprevistas", () => {
    const fields = {
      ...emptyContractFields(),
      email: "clinic@example.test\r\nBcc: other@example.test",
    };
    expect(ClinicContractFieldsSchema.safeParse(fields).success).toBe(false);
    expect(
      ClinicContractFieldsSchema.safeParse({ ...emptyContractFields(), price: 1 }).success
    ).toBe(false);
    expect(() => contractEmailDraft(Buffer.from("document"), fields)).toThrow();
  });
  it("produz somente rascunho MIME com o documento anexado e um destinatário", () => {
    const fields = {
      ...emptyContractFields(),
      email: "clinic@example.test",
      legalName: "Clínica fictícia",
    };
    const eml = contractEmailDraft(Buffer.from("documento de teste"), fields);
    expect(eml).toContain("X-Unsent: 1\r\nTo: clinic@example.test");
    expect(eml).toContain('filename="Minuta_Credenciamento_NEXTCON.docx"');
    expect(eml).toContain(Buffer.from("documento de teste").toString("base64"));
    expect(eml).not.toMatch(/\r\n(?:Bcc|Cc|From):/i);
  });
});
