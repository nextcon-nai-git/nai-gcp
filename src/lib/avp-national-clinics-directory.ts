/**
 * NAI National Clinics Directory - Rede Brasileira de Clínicas Ocupacionais & Credenciamento
 * Contatos publicados em sites oficiais e registros cadastrados manualmente.
 * Suporte completo ao envio instantâneo de proposta B2B de credenciamento via WhatsApp em 1 clique.
 */

import { VERIFIED_AVP_CLINICS } from "./avp-verified-clinics";
import { AVP_CREDENCIAMENTO_MESSAGE } from "./avp-source-config";

export type OutreachStatus = "NAO_CONTATADO" | "MENSAGEM_ENVIADA" | "EM_NEGOCIACAO" | "CREDENCIADA";

export interface NationalOccupationalClinic {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  telefone: string;
  whatsapp: string; // formato numérico somente dígitos com DDI: ex 5511999887766
  endereco: string;
  bairro?: string;
  cep?: string;
  email: string;
  contatoResponsavel?: string;
  especialidades: string[];
  horarioFuncionamento: string;
  statusCredenciamento: OutreachStatus;
  dataEnvioMensagem?: string;
  isPoloAvp: boolean;
  totalAsosPolo?: number;
  observacoes?: string;
  origem: "SISTEMA_NAI" | "DESCOBERTA_MAPS" | "MANUAL";
  sourceUrl?: string;
  verifiedAt?: string;
}

export interface NationalDirectoryStats {
  totalClinicas: number;
  totalPolosAvp: number;
  totalComWhatsapp: number;
  totalMensagensEnviadas: number;
  totalEmNegociacao: number;
  totalCredenciadas: number;
  totalCidadesAtendidas: number;
}

export const OFFICIAL_CREDENCIAMENTO_SENDER = "Equipe de Credenciamento & Parcerias NextCon";

/**
 * Gera a mensagem institucional B2B oficial para proposta de credenciamento direcionada à clínica.
 */
export function generateCredenciamentoProposalText(
  clinic: NationalOccupationalClinic,
  senderName: string = OFFICIAL_CREDENCIAMENTO_SENDER
): string {
  return AVP_CREDENCIAMENTO_MESSAGE;
}

/**
 * Gera o link direto oficial do WhatsApp com a mensagem codificada em 1-clique.
 */
export function generateOneClickCredenciamentoUrl(
  clinic: NationalOccupationalClinic,
  options?: { senderName?: string; customMessage?: string }
): { waUrl: string; messageText: string } {
  const messageText =
    options?.customMessage || generateCredenciamentoProposalText(clinic, options?.senderName);
  const cleanDigits = (clinic.whatsapp || "").replace(/\D/g, "");
  const fullPhone = cleanDigits.startsWith("55") ? cleanDigits : `55${cleanDigits}`;
  const waUrl =
    fullPhone.length >= 10
      ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(messageText)}`
      : "";

  return { waUrl, messageText };
}

/**
 * Formata um número de telefone com máscara visual legível brasileira.
 */
export function formatBrazilianPhoneDisplay(phoneDigits: string): string {
  if (!phoneDigits) return "";
  let digits = phoneDigits.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phoneDigits;
}

export const DEFAULT_BRAZIL_NATIONAL_CLINICS: NationalOccupationalClinic[] =
  VERIFIED_AVP_CLINICS.map((clinic) => ({
    ...clinic,
    especialidades: ["ASO", "Medicina do Trabalho"],
    horarioFuncionamento: "Confirmar com a clínica",
    statusCredenciamento: "NAO_CONTATADO",
    isPoloAvp: true,
    totalAsosPolo: 0,
    origem: "SISTEMA_NAI",
  }));

export const NATIONAL_CLINICS_STORAGE_KEY = "nai_national_clinics_directory_cache";

/**
 * Lê o catálogo unificado de clínicas do localStorage (mesclando com a base default).
 */
export function getStoredNationalClinics(): NationalOccupationalClinic[] {
  if (typeof window === "undefined") {
    return DEFAULT_BRAZIL_NATIONAL_CLINICS;
  }
  try {
    const raw = localStorage.getItem(NATIONAL_CLINICS_STORAGE_KEY);
    if (!raw) return DEFAULT_BRAZIL_NATIONAL_CLINICS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const map = new Map<string, NationalOccupationalClinic>();
      DEFAULT_BRAZIL_NATIONAL_CLINICS.forEach((c) => map.set(c.id, c));
      parsed.forEach((c: NationalOccupationalClinic) => {
        if (!c || typeof c.id !== "string") return;
        const verified = map.get(c.id);
        if (verified)
          map.set(c.id, {
            ...verified,
            statusCredenciamento: [
              "NAO_CONTATADO",
              "MENSAGEM_ENVIADA",
              "EM_NEGOCIACAO",
              "CREDENCIADA",
            ].includes(c.statusCredenciamento)
              ? c.statusCredenciamento
              : "NAO_CONTATADO",
            observacoes: c.observacoes,
            dataEnvioMensagem: c.dataEnvioMensagem,
          });
        else if (
          c.id.startsWith("custom_nat_clin_") &&
          c.origem === "MANUAL" &&
          typeof c.nome === "string" &&
          typeof c.cidade === "string" &&
          typeof c.uf === "string" &&
          typeof c.telefone === "string" &&
          Array.isArray(c.especialidades)
        )
          map.set(c.id, c);
      });
      return Array.from(map.values());
    }
  } catch (e) {
    console.warn("Erro ao ler cache do diretório de clínicas", e);
  }
  return DEFAULT_BRAZIL_NATIONAL_CLINICS;
}

/**
 * Salva a lista de clínicas no localStorage.
 */
export function saveNationalClinicsToStorage(clinics: NationalOccupationalClinic[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NATIONAL_CLINICS_STORAGE_KEY, JSON.stringify(clinics));
  } catch (e) {
    console.error("Erro ao gravar diretório de clínicas no storage", e);
  }
}

/**
 * Cadastra uma nova clínica manualmente ou via descoberta rápida.
 */
export function saveCustomNationalClinic(
  clinicData: Omit<NationalOccupationalClinic, "id" | "statusCredenciamento" | "origem">
): NationalOccupationalClinic {
  const current = getStoredNationalClinics();
  const cleanCity = clinicData.cidade
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_");
  const newId = `custom_nat_clin_${cleanCity}_${Date.now()}`;

  const cleanWa = (clinicData.whatsapp || "").replace(/\D/g, "");
  const formattedWa = cleanWa
    ? cleanWa.startsWith("55") && [12, 13].includes(cleanWa.length)
      ? cleanWa
      : `55${cleanWa}`
    : "";

  const newClinic: NationalOccupationalClinic = {
    ...clinicData,
    id: newId,
    whatsapp: formattedWa,
    statusCredenciamento: "NAO_CONTATADO",
    origem: "MANUAL",
  };

  const updated = [newClinic, ...current];
  saveNationalClinicsToStorage(updated);
  return newClinic;
}

/**
 * Atualiza o status de contato/credenciamento de uma clínica e persiste.
 */
export function updateClinicOutreachStatus(
  clinicId: string,
  status: OutreachStatus,
  notes?: string
): NationalOccupationalClinic[] {
  const current = getStoredNationalClinics();
  const now = new Date().toLocaleString("pt-BR");

  const updated = current.map((c) => {
    if (c.id === clinicId) {
      return {
        ...c,
        statusCredenciamento: status,
        dataEnvioMensagem: status === "MENSAGEM_ENVIADA" ? now : c.dataEnvioMensagem,
        observacoes: notes !== undefined ? notes : c.observacoes,
      };
    }
    return c;
  });

  saveNationalClinicsToStorage(updated);
  return updated;
}

/**
 * Calcula métricas e KPIs consolidados do diretório nacional.
 */
export function getNationalClinicsStats(
  clinics: NationalOccupationalClinic[]
): NationalDirectoryStats {
  const totalClinicas = clinics.length;
  let totalPolosAvp = 0;
  let totalComWhatsapp = 0;
  let totalMensagensEnviadas = 0;
  let totalEmNegociacao = 0;
  let totalCredenciadas = 0;
  const uniqueCities = new Set<string>();

  clinics.forEach((c) => {
    uniqueCities.add(`${c.cidade}/${c.uf}`.toUpperCase());
    if (c.isPoloAvp) totalPolosAvp++;
    if (c.whatsapp && c.whatsapp.replace(/\D/g, "").length >= 10) totalComWhatsapp++;
    if (c.statusCredenciamento === "MENSAGEM_ENVIADA") totalMensagensEnviadas++;
    if (c.statusCredenciamento === "EM_NEGOCIACAO") totalEmNegociacao++;
    if (c.statusCredenciamento === "CREDENCIADA") totalCredenciadas++;
  });

  return {
    totalClinicas,
    totalPolosAvp,
    totalComWhatsapp,
    totalMensagensEnviadas,
    totalEmNegociacao,
    totalCredenciadas,
    totalCidadesAtendidas: uniqueCities.size,
  };
}

/**
 * Realiza busca inteligente e filtragem no diretório nacional de clínicas.
 */
export function searchNationalClinics(
  clinics: NationalOccupationalClinic[],
  params: {
    query?: string;
    uf?: string;
    status?: OutreachStatus | "ALL";
    onlyAvpPolos?: boolean;
    onlyUrgent?: boolean;
  }
): NationalOccupationalClinic[] {
  const q = (params.query || "").trim().toLowerCase();
  const ufFilter = (params.uf || "ALL").trim().toUpperCase();
  const statusFilter = params.status || "ALL";

  return clinics.filter((c) => {
    if (ufFilter !== "ALL" && c.uf.toUpperCase() !== ufFilter) {
      return false;
    }

    if (statusFilter !== "ALL" && c.statusCredenciamento !== statusFilter) {
      return false;
    }

    if (params.onlyAvpPolos && !c.isPoloAvp) {
      return false;
    }

    if (params.onlyUrgent && (!c.totalAsosPolo || c.totalAsosPolo < 3)) {
      return false;
    }

    if (q) {
      const matchCity = c.cidade.toLowerCase().includes(q);
      const matchUf = c.uf.toLowerCase().includes(q);
      const matchName = c.nome.toLowerCase().includes(q);
      const matchAddress = c.endereco.toLowerCase().includes(q);
      const matchSpecs = c.especialidades.some((s) => s.toLowerCase().includes(q));
      if (!matchCity && !matchUf && !matchName && !matchAddress && !matchSpecs) {
        return false;
      }
    }

    return true;
  });
}
