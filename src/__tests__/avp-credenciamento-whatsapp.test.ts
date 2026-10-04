import { describe, it, expect } from "vitest";
import {
  DEFAULT_BRAZIL_NATIONAL_CLINICS,
  generateCredenciamentoProposalText,
  generateOneClickCredenciamentoUrl,
  getNationalClinicsStats,
  searchNationalClinics,
  formatBrazilianPhoneDisplay,
} from "@/lib/avp-national-clinics-directory";

describe("NAI National Clinics Directory & 1-Click WhatsApp Credenciamento", () => {
  it("deve conter no mínimo 115 clínicas pré-indexadas cobrindo o território nacional", () => {
    expect(DEFAULT_BRAZIL_NATIONAL_CLINICS.length).toBeGreaterThanOrEqual(115);
  });

  it("deve cobrir todos os 27 estados (UFs) da federação brasileira", () => {
    const allUfs = new Set(DEFAULT_BRAZIL_NATIONAL_CLINICS.map((c) => c.uf.toUpperCase()));
    const expectedUfs = [
      "AC",
      "AL",
      "AP",
      "AM",
      "BA",
      "CE",
      "DF",
      "ES",
      "GO",
      "MA",
      "MT",
      "MS",
      "MG",
      "PA",
      "PB",
      "PR",
      "PE",
      "PI",
      "RJ",
      "RN",
      "RS",
      "RO",
      "RR",
      "SC",
      "SP",
      "SE",
      "TO",
    ];

    expectedUfs.forEach((uf) => {
      expect(allUfs.has(uf), `Estado ${uf} deve ter ao menos 1 clínica indexada`).toBe(true);
    });
  });

  it("deve garantir que todos os registros possuem ID, nome, cidade, UF e WhatsApp válido", () => {
    DEFAULT_BRAZIL_NATIONAL_CLINICS.forEach((clinic) => {
      expect(clinic.id).toBeTruthy();
      expect(clinic.nome).toBeTruthy();
      expect(clinic.cidade).toBeTruthy();
      expect(clinic.uf.length).toBe(2);
      expect(clinic.whatsapp).toMatch(/^55\d{10,11}$/);
      expect(clinic.especialidades.length).toBeGreaterThan(0);
    });
  });

  it("deve gerar mensagem oficial de credenciamento B2B com menção ao Grupo AVP e cidade", () => {
    const clinic = DEFAULT_BRAZIL_NATIONAL_CLINICS[0];
    const message = generateCredenciamentoProposalText(clinic);

    expect(message).toContain(clinic.nome);
    expect(message).toContain(clinic.cidade);
    expect(message).toContain(clinic.uf);
    expect(message).toContain("Grupo AVP");
    expect(message).toContain("5.000 colaboradores");
    expect(message).toContain("tabela de valores");
    expect(message).toContain("liberação do ASO");
  });

  it("deve gerar link oficial wa.me formatado com DDI 55 e mensagem URI-encoded", () => {
    const clinic =
      DEFAULT_BRAZIL_NATIONAL_CLINICS.find((c) => c.cidade === "Fortaleza") ||
      DEFAULT_BRAZIL_NATIONAL_CLINICS[0];
    const { waUrl, messageText } = generateOneClickCredenciamentoUrl(clinic);

    expect(waUrl).toMatch(/^https:\/\/wa\.me\/55\d+\?text=/);
    expect(waUrl).toContain(encodeURIComponent(clinic.nome));
    expect(messageText).toContain(clinic.cidade);
  });

  it("deve permitir customizar a mensagem enviada no WhatsApp 1-clique", () => {
    const clinic = DEFAULT_BRAZIL_NATIONAL_CLINICS[0];
    const custom = "Mensagem B2B personalizada com proposta especial de tabela corporativa.";
    const { waUrl, messageText } = generateOneClickCredenciamentoUrl(clinic, {
      customMessage: custom,
    });

    expect(messageText).toBe(custom);
    expect(waUrl).toContain(encodeURIComponent(custom));
  });

  it("deve filtrar clínicas por cidade e por UF com sucesso", () => {
    const fortalezaClinics = searchNationalClinics(DEFAULT_BRAZIL_NATIONAL_CLINICS, {
      query: "Fortaleza",
      uf: "CE",
    });
    expect(fortalezaClinics.length).toBeGreaterThanOrEqual(1);
    expect(fortalezaClinics[0].cidade).toBe("Fortaleza");
    expect(fortalezaClinics[0].uf).toBe("CE");

    const peClinics = searchNationalClinics(DEFAULT_BRAZIL_NATIONAL_CLINICS, {
      uf: "PE",
    });
    expect(peClinics.length).toBeGreaterThanOrEqual(1);
    expect(peClinics.every((c) => c.uf === "PE")).toBe(true);
  });

  it("deve filtrar polos com volume crítico de ASOs (>= 3)", () => {
    const urgentPolos = searchNationalClinics(DEFAULT_BRAZIL_NATIONAL_CLINICS, {
      onlyUrgent: true,
    });
    expect(urgentPolos.length).toBeGreaterThan(0);
    urgentPolos.forEach((c) => {
      expect(c.totalAsosPolo).toBeGreaterThanOrEqual(3);
    });
  });

  it("deve calcular estatísticas consolidadas corretamente", () => {
    const stats = getNationalClinicsStats(DEFAULT_BRAZIL_NATIONAL_CLINICS);
    expect(stats.totalClinicas).toBe(DEFAULT_BRAZIL_NATIONAL_CLINICS.length);
    expect(stats.totalComWhatsapp).toBeGreaterThanOrEqual(115);
    expect(stats.totalPolosAvp).toBeGreaterThanOrEqual(90);
    expect(stats.totalCidadesAtendidas).toBeGreaterThanOrEqual(100);
  });

  it("deve formatar número de telefone brasileiro no padrão visual legível", () => {
    expect(formatBrazilianPhoneDisplay("5511999887766")).toBe("(11) 99988-7766");
    expect(formatBrazilianPhoneDisplay("558532441122")).toBe("(85) 3244-1122");
    expect(formatBrazilianPhoneDisplay("")).toBe("");
  });
});
