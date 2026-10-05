import { describe, it, expect } from "vitest";
import {
  formatBrazilianWhatsApp,
  parseClinicAndPhoneCells,
  generateWhatsAppAppointmentMessage,
  generateWhatsAppCredenciamentoMessage,
  analyzeNetworkRedundancy,
} from "@/lib/avp-clinic-intelligence";
import type { GrupoAvpAso } from "@/lib/grupo-avp-asos-data";
import { AVP_TEST_ASOS as GRUPO_AVP_ASO_LIST } from "./avp-test-fixture";
import { GLOBAL_CLINICS_CATALOG } from "@/lib/avp-clinics-data";

describe("NAI Clinic Intelligence 3.8", () => {
  it("deve formatar número brasileiro e gerar URL do WhatsApp corretamente", () => {
    const res = formatBrazilianWhatsApp("84982001213", "Olá Dr Saúde");
    expect(res.clean).toBe("84982001213");
    expect(res.formatted).toBe("(84) 98200-1213");
    expect(res.isWhatsApp).toBe(true);
    expect(res.isValid).toBe(true);
    expect(res.waUrl).toContain("https://wa.me/5584982001213?text=");
  });

  it("deve tratar números com prefixo +55 e caracteres especiais", () => {
    const res = formatBrazilianWhatsApp("+55 (16) 99214-8740");
    expect(res.clean).toBe("16992148740");
    expect(res.formatted).toBe("(16) 99214-8740");
    expect(res.isWhatsApp).toBe(true);
  });

  it("deve desmembrar múltiplas clínicas e telefones em uma única célula", () => {
    const clinicCell = "1. INTEGRAL SAÚDE\n2. MEDCLIN (MURYLO)\n3. GESCON";
    const phoneCell = "1. 16 99999 1320\n2. 16 99214 8740\n3. 16 98215 0054";

    const parsed = parseClinicAndPhoneCells(clinicCell, phoneCell);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].nome).toBe("INTEGRAL SAÚDE");
    expect(parsed[0].telefoneLimpo).toBe("16999991320");
    expect(parsed[0].isWhatsApp).toBe(true);

    expect(parsed[1].nome).toBe("MEDCLIN (MURYLO)");
    expect(parsed[1].telefoneLimpo).toBe("16992148740");

    expect(parsed[2].nome).toBe("GESCON");
    expect(parsed[2].telefoneLimpo).toBe("16982150054");
  });

  it("deve gerar mensagem contextualizada de agendamento de ASO", () => {
    const mockAso: GrupoAvpAso = {
      ...GRUPO_AVP_ASO_LIST[0],
      colaborador: "João da Silva",
      cidade: "Ituiutaba",
      uf: "MG",
      tipoExame: "Admissional",
      numero: "105",
      urgencia: "URGENTE",
    };

    const msg = generateWhatsAppAppointmentMessage(mockAso, "Clínica Teste");
    expect(msg).toContain("NextCon Gestão em Medicina e Segurança do Trabalho");
    expect(msg).toContain("Grupo AVP");
    expect(msg).toContain("João da Silva");
    expect(msg).toContain("PRIORIDADE URGENTE");
    expect(msg).toContain("Ituiutaba - MG");
  });

  it("deve gerar mensagem oficial de pré-credenciamento B2B para expansão", () => {
    const msg = generateWhatsAppCredenciamentoMessage("Sobral", "CE", "Clínica Vida Saúde");
    expect(msg).toContain("44.337.647/0001-89");
    expect(msg).toContain("CNPJ e a chave PIX");
    expect(msg).toContain("R$40 por exame");
    expect(msg).not.toContain("5.000");
  });

  it("deve auditar a redundância de rede e identificar polos que necessitam de contingência", () => {
    const redundancy = analyzeNetworkRedundancy(GRUPO_AVP_ASO_LIST, GLOBAL_CLINICS_CATALOG);
    expect(redundancy.totalCidadesAvaliadas).toBeGreaterThan(0);
    expect(redundancy.relatorioPorCidade.length).toBe(redundancy.totalCidadesAvaliadas);
    expect(
      redundancy.totalCidadesCriticas +
        redundancy.totalCidadesVulneraveis +
        redundancy.totalCidadesResilientes
    ).toBe(redundancy.totalCidadesAvaliadas);

    // O relatório deve ter cidades críticas ordenadas no topo
    const firstCity = redundancy.relatorioPorCidade[0];
    expect(firstCity.clinicasFaltantesParaMeta).toBeGreaterThan(0);
  });
});
