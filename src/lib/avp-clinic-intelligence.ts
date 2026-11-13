/**
 * NAI Clinic Intelligence 3.8
 * Módulo de automação, enriquecimento e contingência de clínicas credenciadas de SST.
 * - Extração e normalização de telefones e WhatsApp (inclusive multi-clínicas por célula)
 * - Auditor de contingência de rede (Garantir 2+ clínicas por polo municipal no Brasil)
 * - Gerador de mensagens institucionais B2B para agendamento e pré-credenciamento
 */

import { GrupoAvpAso } from "./grupo-avp-asos-data";
import { GlobalClinic } from "./avp-clinics-data";
import { AVP_CREDENCIAMENTO_MESSAGE } from "./avp-source-config";

export interface ParsedClinicContact {
  nome: string;
  telefoneRaw: string;
  telefoneLimpo: string;
  telefoneFormatado: string;
  isWhatsApp: boolean;
  isValid: boolean;
  whatsappUrl: string;
}

export interface CityRedundancyReport {
  cidade: string;
  uf: string;
  totalAsosNaQueue: number;
  totalClinicasCadastradas: number;
  statusContingencia: "CRITICO_ZERO" | "VULNERAVEL_UMA" | "RESILIENTE_DUAS_OU_MAIS";
  clinicasExistentes: string[];
  clinicasFaltantesParaMeta: number; // Mínimo 2 clínicas por cidade
  urgente: boolean;
}

export interface NetworkRedundancySummary {
  totalCidadesAvaliadas: number;
  totalCidadesCriticas: number; // 0 clínicas
  totalCidadesVulneraveis: number; // 1 clínica
  totalCidadesResilientes: number; // 2+ clínicas
  percentualCoberturaMinima2: number;
  relatorioPorCidade: CityRedundancyReport[];
}

/**
 * Normaliza e formata um número brasileiro para WhatsApp E.164 (+55 DDD NÚMERO).
 */
export function formatBrazilianWhatsApp(
  rawPhone: string,
  customMessage?: string
): {
  clean: string;
  formatted: string;
  isWhatsApp: boolean;
  isValid: boolean;
  waUrl: string;
} {
  if (!rawPhone) {
    return { clean: "", formatted: "", isWhatsApp: false, isValid: false, waUrl: "" };
  }

  // Remove caracteres não numéricos
  let digits = rawPhone.replace(/\D/g, "");

  // Se tiver prefixo 55 internacional duplicado ou inicial
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  // Se o número for 10 dígitos (DDD + 8 dígitos) e for celular antigo sem o 9
  // ou se for celular com 11 dígitos (DDD + 9XXXXXXXX)
  const isMobile = digits.length === 11 && ["9", "8", "7"].includes(digits[2]);
  const isLandline = digits.length === 10;
  const isValid = digits.length === 10 || digits.length === 11;

  let formatted = rawPhone;
  if (digits.length === 11) {
    formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  const encodedMsg = customMessage ? `?text=${encodeURIComponent(customMessage)}` : "";
  const waUrl = isValid ? `https://wa.me/55${digits}${encodedMsg}` : "";

  return {
    clean: digits,
    formatted,
    isWhatsApp: isMobile || digits.length === 11,
    isValid,
    waUrl,
  };
}

function contactEntries(cell: string): Array<{ key: string | null; value: string }> {
  const text = (cell || "").trim();
  if (!text) return [];
  return text.split(/\r?\n|;|[ \t]+(?=\d{1,3}[.)-][ \t]+)/).map((line) => {
    const value = line.trim();
    const mark = /^(\d{1,3})[.)-](?:\s+|(?=[^\s\d])|$)/.exec(value);
    return {
      key: mark ? String(Number(mark[1])) : null,
      value: mark ? value.slice(mark[0].length).trim() : value,
    };
  });
}

/**
 * Desmembra e extrai clínicas e seus respectivos contatos quando agrupados em uma única célula
 * Exemplo real da planilha:
 * Clínica: "1. INTEGRAL SAÚDE\n2. MEDCLIN (MURYLO)\n3. GESCON"
 * Telefones: "1. 16 99999 1320\n2. 16 99214 8740\n3. 16 98215 0054"
 */
export function parseClinicAndPhoneCells(
  clinicCell: string,
  phoneCell: string,
  defaultAsoMessage?: string | ((clinic: string) => string)
): ParsedClinicContact[] {
  const clinics = contactEntries(clinicCell);
  const phones = contactEntries(phoneCell);
  const numbered = [...clinics, ...phones].some((entry) => entry.key !== null);
  const aligned = !numbered && clinics.length === phones.length;
  return clinics.map((clinic, index) => {
    let phone: string | undefined;
    if (clinic.key !== null && clinics.filter((entry) => entry.key === clinic.key).length === 1) {
      const candidates = phones.filter((entry) => entry.key === clinic.key);
      if (candidates.length === 1) phone = candidates[0].value;
    } else if (aligned) phone = phones[index].value;
    const telRaw = clinic.value ? phone || "" : "";
    const parsed = formatBrazilianWhatsApp(
      telRaw,
      typeof defaultAsoMessage === "function" ? defaultAsoMessage(clinic.value) : defaultAsoMessage
    );
    return {
      nome: clinic.value,
      telefoneRaw: telRaw,
      telefoneLimpo: parsed.clean,
      telefoneFormatado: parsed.formatted,
      isWhatsApp: parsed.isWhatsApp,
      isValid: parsed.isValid,
      whatsappUrl: parsed.waUrl,
    };
  });
}

/**
 * Gera mensagem profissional contextualizada para agendamento de ASO via WhatsApp com a clínica credenciada.
 */
export function generateWhatsAppAppointmentMessage(aso: GrupoAvpAso, clinicName?: string): string {
  const targetClinic = clinicName || aso.nomeClinica || "Equipe de Agendamento";
  return (
    `Olá, ${targetClinic}! Tudo bem?\n\n` +
    `Aqui é da *NextCon Gestão em Medicina e Segurança do Trabalho*, cuidamos da gestão de saúde ocupacional do *Grupo AVP*.\n\n` +
    `Precisamos realizar o agendamento de um exame ocupacional:\n` +
    `👤 *Colaborador:* ${aso.colaborador}\n` +
    `🏥 *Tipo de Exame:* ${aso.tipoExame}\n` +
    `📍 *Polo / Município:* ${aso.cidade} - ${aso.uf}\n` +
    `📋 *Solicitação:* Nº ${aso.numero || "S/N"}\n` +
    (aso.urgencia === "URGENTE" ? `🚨 *PRIORIDADE URGENTE* (SLA Crítico)\n` : "") +
    (aso.dataAgendada ? `🗓️ *Data Desejada / Prevista:* ${aso.dataAgendada}\n` : "") +
    (aso.oQueFazer ? `📝 *Observações:* ${aso.oQueFazer}\n` : "") +
    `\nVocês possuem disponibilidade para esta data/semana? Poderiam nos confirmar os horários de atendimento e orientações de preparo?\n\n` +
    `Agradeço desde já pela atenção e parceria!`
  );
}

/**
 * Gera mensagem institucional B2B para prospecção e pré-credenciamento de nova clínica alternativa no polo.
 */
export function generateWhatsAppCredenciamentoMessage(
  cidade: string,
  uf: string,
  clinicName: string = "Clínica Parceira"
): string {
  return AVP_CREDENCIAMENTO_MESSAGE;
}

/**
 * Analisa a redundância de rede de todas as cidades da fila e do catálogo,
 * verificando o cumprimento da diretriz de TER AO MENOS 2 CLÍNICAS POR POLO.
 */
export function analyzeNetworkRedundancy(
  queueAsos: GrupoAvpAso[],
  globalClinics: GlobalClinic[]
): NetworkRedundancySummary {
  const catalogCityMap = new Map<string, Map<string, string>>();

  globalClinics.forEach((clinic) => {
    const name = (clinic.displayName || clinic.name).trim();
    if (
      clinic.status !== "ACTIVE" ||
      !clinic.id ||
      !name ||
      /^(sem cl[ií]nica|a confirmar)$/i.test(name)
    )
      return;
    const id = clinic.cnpj?.replace(/[.\/\s-]/g, "").toUpperCase() || clinic.id;
    clinic.cities.forEach((cityStr) => {
      const norm = cityStr.trim().toUpperCase();
      if (!catalogCityMap.has(norm)) {
        catalogCityMap.set(norm, new Map());
      }
      catalogCityMap.get(norm)!.set(id, name.toUpperCase());
    });
  });

  const asoCityMap = new Map<
    string,
    { totalAsos: number; clinicasInSheet: Set<string>; hasUrgent: boolean }
  >();

  queueAsos.forEach((aso) => {
    if (!aso.cidade) return;
    const key = `${aso.cidade.trim().toUpperCase()}/${(aso.uf || "BR").trim().toUpperCase()}`;
    if (!asoCityMap.has(key)) {
      asoCityMap.set(key, { totalAsos: 0, clinicasInSheet: new Set(), hasUrgent: false });
    }
    const entry = asoCityMap.get(key)!;
    entry.totalAsos++;
    if (aso.urgencia === "URGENTE") entry.hasUrgent = true;

    if (aso.nomeClinica && aso.nomeClinica.trim() && aso.nomeClinica.length > 2) {
      const lower = aso.nomeClinica.toLowerCase();
      if (
        !lower.includes("cancel") &&
        !lower.includes("negociando") &&
        !lower.includes("aguardando")
      ) {
        entry.clinicasInSheet.add(aso.nomeClinica.trim());
      }
    }
  });

  const reports: CityRedundancyReport[] = [];
  let totalCriticas = 0;
  let totalVulneraveis = 0;
  let totalResilientes = 0;

  asoCityMap.forEach((entry, cityKey) => {
    const [cidade, uf] = cityKey.split("/");
    const allUniqueClinics = Array.from(catalogCityMap.get(cityKey)?.values() ?? []);
    const count = allUniqueClinics.length;

    let statusContingencia: CityRedundancyReport["statusContingencia"] = "CRITICO_ZERO";
    if (count === 0) {
      statusContingencia = "CRITICO_ZERO";
      totalCriticas++;
    } else if (count === 1) {
      statusContingencia = "VULNERAVEL_UMA";
      totalVulneraveis++;
    } else {
      statusContingencia = "RESILIENTE_DUAS_OU_MAIS";
      totalResilientes++;
    }

    reports.push({
      cidade,
      uf,
      totalAsosNaQueue: entry.totalAsos,
      totalClinicasCadastradas: count,
      statusContingencia,
      clinicasExistentes: Array.from(allUniqueClinics),
      clinicasFaltantesParaMeta: Math.max(0, 2 - count),
      urgente: entry.hasUrgent,
    });
  });

  reports.sort((a, b) => {
    const scoreA =
      (a.statusContingencia === "CRITICO_ZERO"
        ? 100
        : a.statusContingencia === "VULNERAVEL_UMA"
          ? 50
          : 0) + a.totalAsosNaQueue;
    const scoreB =
      (b.statusContingencia === "CRITICO_ZERO"
        ? 100
        : b.statusContingencia === "VULNERAVEL_UMA"
          ? 50
          : 0) + b.totalAsosNaQueue;
    return scoreB - scoreA;
  });

  const totalCidades = reports.length;
  const percentual =
    totalCidades > 0 ? Number(((totalResilientes / totalCidades) * 100).toFixed(1)) : 0;

  return {
    totalCidadesAvaliadas: totalCidades,
    totalCidadesCriticas: totalCriticas,
    totalCidadesVulneraveis: totalVulneraveis,
    totalCidadesResilientes: totalResilientes,
    percentualCoberturaMinima2: percentual,
    relatorioPorCidade: reports,
  };
}
