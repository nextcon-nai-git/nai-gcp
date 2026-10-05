import { beforeEach, describe, it, expect } from "vitest";
import {
  DEFAULT_BRAZIL_NATIONAL_CLINICS as clinics,
  generateCredenciamentoProposalText,
  generateOneClickCredenciamentoUrl,
  getNationalClinicsStats,
  searchNationalClinics,
  getStoredNationalClinics,
  NATIONAL_CLINICS_STORAGE_KEY,
  formatBrazilianPhoneDisplay,
} from "@/lib/avp-national-clinics-directory";
import { AVP_CREDENCIAMENTO_MESSAGE } from "@/lib/avp-source-config";

beforeEach(() => localStorage.clear());
describe("Credenciamento com contatos conferidos", () => {
  it("exige fonte e data de conferência dos contatos publicados", () => {
    expect(clinics).toHaveLength(3);
    for (const clinic of clinics) {
      expect(clinic.sourceUrl).toMatch(/^https:\/\//);
      expect(clinic.verifiedAt).toBeTruthy();
      expect(clinic.cidade).toBe("Imperatriz");
      expect(clinic.uf).toBe("MA");
      if (clinic.whatsapp) expect(clinic.whatsapp).toMatch(/^55\d{10,11}$/);
    }
  });
  it("usa a mensagem exata de CNPJ, PIX e negociação a R$40", () => {
    expect(generateCredenciamentoProposalText(clinics[0])).toBe(AVP_CREDENCIAMENTO_MESSAGE);
    const result = generateOneClickCredenciamentoUrl(clinics[0]);
    expect(new URL(result.waUrl).searchParams.get("text")).toBe(AVP_CREDENCIAMENTO_MESSAGE);
  });
  it("não inventa WhatsApp quando só há telefone publicado", () => {
    const result = generateOneClickCredenciamentoUrl(clinics[2]);
    expect(result.waUrl).toBe("");
  });
  it("preserva mensagem personalizada", () => {
    expect(
      generateOneClickCredenciamentoUrl(clinics[0], { customMessage: "Mensagem de teste" })
        .messageText
    ).toBe("Mensagem de teste");
  });
  it("não recupera do cache os contatos artificiais antigos", () => {
    localStorage.setItem(
      NATIONAL_CLINICS_STORAGE_KEY,
      JSON.stringify([
        { ...clinics[0], id: "nat_clin_imperatriz_ma_001", whatsapp: "5599910009999" },
      ])
    );
    expect(getStoredNationalClinics().map((c) => c.id)).not.toContain("nat_clin_imperatriz_ma_001");
  });
  it("não permite ao cache adulterar um contato conferido", () => {
    localStorage.setItem(
      NATIONAL_CLINICS_STORAGE_KEY,
      JSON.stringify([
        { ...clinics[0], whatsapp: "5599910009999", statusCredenciamento: "EM_NEGOCIACAO" },
      ])
    );
    expect(getStoredNationalClinics()[0].whatsapp).toBe(clinics[0].whatsapp);
    expect(getStoredNationalClinics()[0].statusCredenciamento).toBe("EM_NEGOCIACAO");
  });
  it("filtra sem criar cobertura fictícia", () => {
    expect(searchNationalClinics(clinics, { uf: "PE" })).toHaveLength(0);
    expect(searchNationalClinics(clinics, { query: "imperatriz", uf: "MA" })).toHaveLength(3);
    expect(searchNationalClinics(clinics, { onlyUrgent: true })).toHaveLength(0);
    expect(getNationalClinicsStats(clinics)).toMatchObject({
      totalClinicas: 3,
      totalComWhatsapp: 2,
      totalCidadesAtendidas: 1,
      totalMensagensEnviadas: 0,
    });
  });
  it("formata telefone sem alterar seus dígitos", () => {
    expect(formatBrazilianPhoneDisplay("5511999887766")).toBe("(11) 99988-7766");
    expect(formatBrazilianPhoneDisplay("")).toBe("");
  });
});
