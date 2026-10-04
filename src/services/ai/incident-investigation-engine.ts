import { createHash } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { retrieveApplicableNorms, NormativeSection } from "./normative-kb";

export interface FindingLegalBasis {
  source: string; // Ex: "NR-35"
  section: string; // Ex: "35.5.1"
  revision: string; // Ex: "Portaria MTP nº 4.218/2022"
  evidence: string; // Fato extraído do incidente que comprova o apontamento
}

export interface TechnicalFinding {
  finding: string;
  severity: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  legalBasis: FindingLegalBasis;
  recommendedAction: string;
  confidence: number;
}

export interface TechnicalIncidentOpinion {
  incidentId: string;
  companyId: string;
  analysisTimestamp: string;
  severity: "LEVE" | "GRAVE" | "FATAL";
  extractedFacts: {
    summary: string;
    activity: string;
    equipment: string[];
    location: string;
    injuryType?: string;
    ppeMentioned: string[];
    hasLeave?: boolean;
    estimatedDaysOfLeave?: number;
  };
  riskCategories: string[];
  retrievedNorms: Array<{
    source: string;
    section: string;
    title: string;
    revision: string;
  }>;
  findings: TechnicalFinding[];
  esocialImpact: {
    requiresCatS2210: boolean;
    deadlineCat: string | null;
    catDeadlineIso?: string | null;
    catDeadlineTimestamp?: number | null;
    pgrUpdateRequired: boolean;
  };
  immutableDigest: string; // SHA-256 do parecer para auditoria imutável
}

/**
 * Calcula o prazo legal improrrogável de emissão da CAT S-2210 (Art. 22 Lei 8.213/1991)
 */
export function calculateCatLegalDeadline(
  incidentDate: Date = new Date(),
  isFatal: boolean = false
): {
  deadlineIso: string;
  deadlineTimestamp: number;
  description: string;
} {
  if (isFatal) {
    const immediate = new Date(incidentDate.getTime() + 4 * 60 * 60 * 1000);
    return {
      deadlineIso: immediate.toISOString(),
      deadlineTimestamp: immediate.getTime(),
      description: "Comunicação Imediata (Art. 22 Lei 8.213/91 - Óbito)",
    };
  }

  const target = new Date(incidentDate);
  const dayOfWeek = target.getDay();

  let daysToAdd = 1;
  if (dayOfWeek === 5) {
    daysToAdd = 3; // Sexta -> Segunda
  } else if (dayOfWeek === 6) {
    daysToAdd = 2; // Sábado -> Segunda
  } else if (dayOfWeek === 0) {
    daysToAdd = 1; // Domingo -> Segunda
  } else {
    daysToAdd = 1; // Seg a Qui -> Dia seguinte
  }

  target.setDate(target.getDate() + daysToAdd);
  target.setHours(23, 59, 59, 999);

  return {
    deadlineIso: target.toISOString(),
    deadlineTimestamp: target.getTime(),
    description: `Primeiro dia útil seguinte (${target.toLocaleDateString("pt-BR")}) às 23:59:59`,
  };
}

/**
 * 1. Risk Engine: Classifica os vetores de risco a partir do texto do incidente
 */
function detectRiskCategories(text: string): string[] {
  const lower = text.toLowerCase();
  const categories: string[] = ["GESTAO_PGR"];

  if (
    lower.includes("altura") ||
    lower.includes("queda") ||
    lower.includes("telhado") ||
    lower.includes("andaime") ||
    lower.includes("escada")
  ) {
    categories.push("TRABALHO_ALTURA");
  }
  if (
    lower.includes("prensa") ||
    lower.includes("máquina") ||
    lower.includes("maquina") ||
    lower.includes("esteira") ||
    lower.includes("engrenagem") ||
    lower.includes("esmagamento")
  ) {
    categories.push("MAQUINAS_EQUIPAMENTOS");
  }
  if (
    lower.includes("choque") ||
    lower.includes("eletric") ||
    lower.includes("painel") ||
    lower.includes("tensão") ||
    lower.includes("tensao") ||
    lower.includes("arco")
  ) {
    categories.push("RISCO_ELETRICO");
  }
  if (
    lower.includes("confinado") ||
    lower.includes("tanque") ||
    lower.includes("silo") ||
    lower.includes("galeria") ||
    lower.includes("asfixia")
  ) {
    categories.push("ESPACO_CONFINADO");
  }
  if (
    lower.includes("epi") ||
    lower.includes("capacete") ||
    lower.includes("luva") ||
    lower.includes("óculos") ||
    lower.includes("protetor")
  ) {
    categories.push("EPI_PROTECAO");
  }

  return categories;
}

/**
 * PIPELINE RAG FIRST -> LLM SECOND:
 *
 * Incidente
 *    ↓
 * IA extrai fatos
 *    ↓
 * Risk Engine
 *    ↓
 * Knowledge Base oficial
 *    ↓
 * Retrieval (retrieveApplicableNorms)
 *    ↓
 * Norma / artigo / item recuperados
 *    ↓
 * LLM interpreta (Grounding estrito com temperature 0.0)
 *    ↓
 * Parecer Técnico Estruturado Auditável
 */
export async function analyzeIncidentWithNormativeGrounding(
  incidentId: string,
  companyId: string,
  incidentDescription: string,
  additionalContext?: { location?: string; photoUrl?: string }
): Promise<TechnicalIncidentOpinion> {
  const analysisTimestamp = new Date().toISOString();

  // 1. Extração Inicial de Fatos & Risk Engine
  const riskCategories = detectRiskCategories(incidentDescription);

  // 2. RAG FIRST: Recuperação na Base Normativa Oficial
  const retrievedNorms: NormativeSection[] = retrieveApplicableNorms(
    incidentDescription,
    riskCategories
  );

  // 3. Preparação do Contexto Normativo Injetado
  const normativeContext = retrievedNorms
    .map(
      (n) =>
        `[NORMA: ${n.source} | ITEM: ${n.section} | REVISÃO: ${n.revision}]\nTÍTULO: ${n.title}\nTEXTO LEGAL: "${n.text}"`
    )
    .join("\n\n");

  // 4. LLM SECOND: Interpretação Ancorada no Gemini com Temperature 0.0
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    "";

  let llmResult: any = null;

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelName = process.env.GEMINI_FLASH_MODEL || "gemini-3.8-flash";
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.0, // Zero estocasticidade (Determinismo Regulatório)
          responseMimeType: "application/json",
        },
      });

      const prompt = `
Você é o Motor de Investigação Técnica e Perícia em Segurança do Trabalho do NAI (NextCon Intelligence).
Sua missão é emitir um PARECER TÉCNICO AUDITÁVEL E NÃO-ALUCINADO sobre o incidente relatado, estritamente fundamentado nas Normas Regulamentadoras (NRs) fornecidas na base normativa.

DESCRIÇÃO DO INCIDENTE:
"${incidentDescription}"

LOCAL INFORMADO:
"${additionalContext?.location || "Não especificado"}"

BASE NORMATIVA OFICIAL RECUPERADA (RAG KNOWLEDGE BASE):
${normativeContext}

REGRAS ESTRITAS DE AUDITORIA:
1. Extraia os FATOS REAIS comprovados na descrição (extractedFacts).
2. Para CADA constatação (finding), você DEVE vincular obrigatoriamente a base legal (legalBasis) com:
   - source: Código da Norma (ex: "NR-35")
   - section: Número do item exato (ex: "35.5.1")
   - revision: Portaria de revisão informada no cabeçalho da norma
   - evidence: Trecho literal da descrição do fato que comprova a não-conformidade ou o risco
3. Atribua um índice de confiança calibrado (confidence: 0.0 a 1.0).
4. Avalie o impacto no eSocial (necessidade de emissão de CAT S-2210 e atualização do inventário de riscos no PGR/NR-1).

RETORNE APENAS O JSON NO SEGUINTE SCHEMA:
{
  "extractedFacts": {
    "summary": "Resumo dos fatos ocorridos em 1 a 2 frases",
    "activity": "Atividade desenvolvida no momento do evento",
    "equipment": ["equipamento ou ferramenta 1"],
    "location": "Setor ou local da ocorrência",
    "injuryType": "Tipo de lesão (ou 'SEM_LESAO')",
    "ppeMentioned": ["EPIs citados"]
  },
  "findings": [
    {
      "finding": "Descrição técnica da constatação/não-conformidade",
      "severity": "BAIXA" | "MEDIA" | "ALTA" | "CRITICA",
      "legalBasis": {
        "source": "NR-35",
        "section": "35.5.1",
        "revision": "Portaria MTP nº 4.218/2022",
        "evidence": "Trecho comprobatório factual"
      },
      "recommendedAction": "Ação corretiva preventiva imediata",
      "confidence": 0.95
    }
  ],
  "esocialImpact": {
    "requiresCatS2210": true | false,
    "deadlineCat": "Primeiro dia útil seguinte ao da ocorrência ou imediato se óbito",
    "pgrUpdateRequired": true | false
  }
}
`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      llmResult = JSON.parse(text);
    } catch (err) {
      console.error("[Gemini Incident Analysis Error]", err);
    }
  }

  // 5. Fallback Determinístico Regulatório (caso IA offline) e Classificação Legal
  const descLower = incidentDescription.toLowerCase();
  const isFatal =
    descLower.includes("óbito") ||
    descLower.includes("obito") ||
    descLower.includes("morte") ||
    descLower.includes("falecimento");
  const isSevere =
    isFatal ||
    descLower.includes("fratura") ||
    descLower.includes("amput") ||
    descLower.includes("choque") ||
    descLower.includes("queda") ||
    descLower.includes("interna") ||
    descLower.includes("afastamento") ||
    descLower.includes("grave");

  const severity: "LEVE" | "GRAVE" | "FATAL" = isFatal ? "FATAL" : isSevere ? "GRAVE" : "LEVE";
  const hasLeave = isSevere || descLower.includes("afastamento") || descLower.includes("atestado");
  const estimatedDaysOfLeave = isFatal ? 0 : isSevere ? 15 : hasLeave ? 3 : 0;

  const facts = llmResult?.extractedFacts || {
    summary: incidentDescription.slice(0, 150),
    activity: "Operação em campo",
    equipment: [],
    location: additionalContext?.location || "Área Operacional",
    injuryType:
      isSevere || isFatal
        ? "Lesão severa/traumática detectada"
        : descLower.includes("lesão") || descLower.includes("corte")
          ? "Lesão leve"
          : "SEM_LESAO",
    ppeMentioned: [],
    hasLeave,
    estimatedDaysOfLeave,
  };

  const findings: TechnicalFinding[] =
    llmResult?.findings ||
    retrievedNorms.map((n) => ({
      finding: `Operação identificada sob campo de incidência da ${n.source} (${n.title}).`,
      severity:
        n.source === "NR-35" || n.source === "NR-10" || n.source === "NR-33" ? "ALTA" : "MEDIA",
      legalBasis: {
        source: n.source,
        section: n.section,
        revision: n.revision,
        evidence: `Fato relatado compatível com os critérios de enquadramento do item ${n.section}.`,
      },
      recommendedAction: `Revisar procedimento operacional padrão e matriz de treinamento conforme item ${n.section} da ${n.source}.`,
      confidence: 0.92,
    }));

  const hasInjury = (facts.injuryType && facts.injuryType !== "SEM_LESAO") || isSevere || isFatal;
  const requiresCat = Boolean(hasInjury || isFatal || isSevere);
  const deadlineInfo = calculateCatLegalDeadline(new Date(), isFatal);

  const esocialImpact = {
    requiresCatS2210: requiresCat,
    deadlineCat: requiresCat ? deadlineInfo.description : null,
    catDeadlineIso: requiresCat ? deadlineInfo.deadlineIso : null,
    catDeadlineTimestamp: requiresCat ? deadlineInfo.deadlineTimestamp : null,
    pgrUpdateRequired: true,
  };

  // 6. Cálculo do Hash de Não-Repúdio (SHA-256 Immutable Digest)
  const digestPayload = JSON.stringify({
    incidentId,
    companyId,
    severity,
    facts,
    findings,
    esocialImpact,
    analysisTimestamp,
  });
  const immutableDigest = createHash("sha256").update(digestPayload).digest("hex");

  return {
    incidentId,
    companyId,
    analysisTimestamp,
    severity,
    extractedFacts: {
      ...facts,
      hasLeave,
      estimatedDaysOfLeave,
    },
    riskCategories,
    retrievedNorms: retrievedNorms.map((n) => ({
      source: n.source,
      section: n.section,
      title: n.title,
      revision: n.revision,
    })),
    findings,
    esocialImpact,
    immutableDigest,
  };
}
