import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import {
  getDefaultWorkOrderData,
  generateWorkOrderPdf,
  getWhatsAppOsDispatchMessage,
  workOrderFilename,
} from "@/services/documents/work-order-pdf-generator";
function sample(company = "CLIENTE ALFA LTDA") {
  const data = getDefaultWorkOrderData({
    nome: "Pessoa de Teste",
    cpf: "52998224725",
    cargo: "Assistente",
  });
  data.empresa.razaoSocial = company;
  data.empresa.cnpj = "11.222.333/0001-81";
  data.versaoPgr = "PGR informado - revisao de teste";
  data.descricaoAtividades = ["Atividade informada para teste."];
  return data;
}
describe("Ordens de Serviço para todos os clientes", () => {
  it("inicia em branco sem empresa, função ou riscos presumidos", () => {
    const data = getDefaultWorkOrderData();
    expect(data.empresa.razaoSocial).toBe("");
    expect(data.colaborador.cargo).toBe("");
    expect(data.riscosIdentificados).toEqual([]);
    expect(data.episObrigatorios).toEqual([]);
    expect(JSON.stringify(data)).not.toMatch(
      /construfam|chesf|statkraft|hidrometria|colete|arrais/i
    );
    expect(data.colaborador.dataEmissaoOs).toBe(
      new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    );
  });
  it("gera PDFs com dados exclusivos de clientes diferentes", () => {
    const a = generateWorkOrderPdf(sample());
    const b = generateWorkOrderPdf(sample("CLIENTE BETA LTDA"));
    expect(a.output()).toContain("CLIENTE ALFA LTDA");
    expect(a.output()).not.toContain("CLIENTE BETA LTDA");
    expect(b.output()).toContain("CLIENTE BETA LTDA");
    expect(b.output()).not.toContain("CLIENTE ALFA LTDA");
    expect(b.output()).not.toMatch(/CONSTRUFAM|CHESF|STATKRAFT|EMBARCADO/);
    expect(b.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    expect(new TextDecoder().decode(new Uint8Array(b.output("arraybuffer")).slice(0, 5))).toBe(
      "%PDF-"
    );
    if (process.env.WORK_ORDER_QA)
      writeFileSync(process.env.WORK_ORDER_QA, Buffer.from(b.output("arraybuffer")));
  });
  it("preserva riscos e EPIs efetivamente informados e pagina textos extensos", () => {
    const data = sample();
    data.riscosIdentificados = [
      {
        fatorRisco: "RUIDO INFORMADO",
        grupo: "Físico",
        fontes: "Fonte de teste",
        possiveisDanos: "Dano informado",
        severidade: "",
        probabilidade: "",
        nivelRisco: "",
        medidasPrevenconais: "Medida informada. ".repeat(300) + "FINAL DAS MEDIDAS",
      },
    ];
    data.episObrigatorios = [
      {
        equipamento: "EPI DE TESTE",
        ca: "CA INFORMADO",
        obrigatoriedade: "Conforme avaliacao",
        finalidade: "Finalidade de teste",
      },
    ];
    const doc = generateWorkOrderPdf(data);
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
    expect(doc.output()).toContain("FINAL DAS MEDIDAS");
    expect(doc.output()).toContain("EPI DE TESTE");
  });
  it("bloqueia geração sem identidade, empresa ou referência técnica", () => {
    expect(() => generateWorkOrderPdf(getDefaultWorkOrderData())).toThrow("CPF");
    const data = sample();
    data.empresa.cnpj = "11111111111111";
    expect(() => generateWorkOrderPdf(data)).toThrow("CNPJ");
    data.empresa.cnpj = "11.222.333/0001-81";
    data.versaoPgr = "";
    expect(() => generateWorkOrderPdf(data)).toThrow("PGR");
  });
  it("prepara mensagem e arquivo com o cliente informado sem instruções náuticas fixas", () => {
    const data = sample("CLIENTE BETA LTDA");
    const message = decodeURIComponent(getWhatsAppOsDispatchMessage(data));
    expect(message).toContain("CLIENTE BETA LTDA");
    expect(message).toContain("Assistente");
    expect(message).not.toMatch(/construfam|colete|arrais|embar[cq]/i);
    expect(message).toContain("Anexe o arquivo");
    expect(workOrderFilename(data)).toContain("CLIENTE_BETA_LTDA");
  });
});
