import { describe, it, expect } from "vitest";
import {
  getDefaultConstrufamOsData,
  generateConstrufamOsPdf,
  getWhatsAppOsDispatchMessage,
} from "@/services/documents/construfam-os-pdf-generator";

describe("Construfam Ordem de Serviço NR-01 (Trabalho Embarcado)", () => {
  it("deve carregar dados padrão fiéis ao PGR da Construfam (CHESF / STATKRAFT)", () => {
    const data = getDefaultConstrufamOsData();

    expect(data.empresa.razaoSocial).toBe("CONSTRUFAM ENGENHARIA E EMPREENDIMENTOS LTDA");
    expect(data.empresa.cnpj).toBe("81.707.465/0001-89");
    expect(data.empresa.cnae).toContain("7119-7/01");
    expect(data.colaborador.ghe).toContain("GES 02 - HIDROMETRIA");

    // Risco Crítico de Afogamento (PR2)
    const afogamento = data.riscosIdentificados.find((r) =>
      r.fatorRisco.toLowerCase().includes("afogamento")
    );
    expect(afogamento).toBeDefined();
    expect(afogamento?.severidade).toBe("Crítica");
    expect(afogamento?.nivelRisco).toContain("Risco Alto");
    expect(afogamento?.medidasPrevenconais).toContain("Colete Salva-Vidas");

    // EPI de Salvatagem Homologado pela Marinha
    const colete = data.episObrigatorios.find((e) =>
      e.equipamento.toLowerCase().includes("colete")
    );
    expect(colete).toBeDefined();
    expect(colete?.obrigatoriedade).toContain("100%");

    // Procedimentos de homem ao mar e direito de recusa
    expect(data.procedimentoHomemAoMar.length).toBeGreaterThan(3);
    expect(data.direitosDeveresClt.artigo158).toContain("ato faltoso");
    expect(data.direitosDeveresClt.item143DireitoRecusa).toContain("DIREITO DE RECUSA");
  });

  it("deve permitir sobreposição dinâmica dos dados do colaborador", () => {
    const customData = getDefaultConstrufamOsData({
      nome: "Carlos Eduardo Mendes",
      cpf: "987.654.321-11",
      cargo: "AUXILIAR DE HIDROMETRISTA",
      matricula: "CFM-0899",
      numeroColeteSalvaVidas: "CV-CHESF-102",
    });

    expect(customData.colaborador.nome).toBe("Carlos Eduardo Mendes");
    expect(customData.colaborador.cpf).toBe("987.654.321-11");
    expect(customData.colaborador.cargo).toBe("AUXILIAR DE HIDROMETRISTA");
    expect(customData.colaborador.numeroColeteSalvaVidas).toBe("CV-CHESF-102");
  });

  it("deve gerar o documento PDF A4 multipágina via jsPDF sem exceções", () => {
    const data = getDefaultConstrufamOsData();
    const doc = generateConstrufamOsPdf(data);

    expect(doc).toBeDefined();

    // Verifica número de páginas geradas
    const totalPages = (doc as any).internal.getNumberOfPages();
    expect(totalPages).toBeGreaterThanOrEqual(2);

    // Verifica que o buffer gerado é um PDF válido (inicia com %PDF)
    const arrayBuffer = doc.output("arraybuffer");
    expect(arrayBuffer.byteLength).toBeGreaterThan(10000);

    const uint8 = new Uint8Array(arrayBuffer);
    const pdfHeader = String.fromCharCode(uint8[0], uint8[1], uint8[2], uint8[3], uint8[4]);
    expect(pdfHeader).toBe("%PDF-");
  });

  it("deve montar mensagem formatada para envio via WhatsApp com link e texto normativo", () => {
    const data = getDefaultConstrufamOsData({
      nome: "Antônio Santos",
      cargo: "TOPÓGRAFO / OPERADOR NÁUTICO",
    });
    const message = getWhatsAppOsDispatchMessage(data);

    expect(message).toBeDefined();
    const decoded = decodeURIComponent(message);
    expect(decoded).toContain("CONSTRUFAM ENGENHARIA");
    expect(decoded).toContain("ORDEM DE SERVIÇO DE SST — NR-01");
    expect(decoded).toContain("Antônio Santos");
    expect(decoded).toContain("Colete Salva-Vidas");
  });
});
