import { createHash } from "node:crypto";
import {
  NAI_DOCUMENT_NAMES,
  PGR_AGENT_NAMES,
  getNaiDocument,
  normalizePgrText,
  type NaiDocument,
  type NaiDocumentType,
  type NaiProvider,
  type PgrAction,
  type PgrAnalysisOutput,
  type PgrPage,
} from "./pgr-schema";

const compact = (value: string) => value.replace(/\s+/g, " ").trim();
const stableId = (value: string) =>
  createHash("sha256").update(normalizePgrText(value)).digest("hex").slice(0, 24);

export function naiDocumentAgent(tipo: NaiDocumentType): NaiDocument["agenteResponsavel"] {
  if (tipo === "PGR" || tipo === "LTCAT") return "engenheiro_seguranca";
  if (["PCMSO", "ASO", "PERICIA_MEDICA"].includes(tipo)) return "medico_trabalho";
  if (["AEP", "AET", "DADOS_ERGONOMICOS"].includes(tipo)) return "ergonomista";
  return null;
}

export function hasNaiClinicalData(pages: PgrPage[]) {
  const text = normalizePgrText(pages.map((p) => p.texto).join("\n"));
  const lines = pages.flatMap((page) => page.texto.split(/\r?\n/).map(normalizePgrText));
  // Match a filled identity field on its own line. Never let whitespace consume
  // the next label in a blank form, or combine an identity with another page.
  const individualClinical = pages.some((page) => {
    const pageLines = page.texto.split(/\r?\n/).map(normalizePgrText);
    const individual = pageLines.some((line, index) => {
      const match = line.match(
        /^(?:paciente|nome (?:do|da) (?:trabalhador|trabalhadora|colaborador|colaboradora)|empregado)\s*:[ \t]*(.*)$/
      );
      if (!match) return false;
      const value = match[1] || pageLines.slice(index + 1).find(Boolean) || "";
      return (
        /^[a-z][a-z .'-]{2,}/.test(value) &&
        !/^(?:funcao|cargo|setor|assinatura|data|cpf|rg|matricula|empresa|cnpj|endereco|nome|preencher|___)\b/.test(
          value
        )
      );
    });
    return (
      individual &&
      /\b(?:exames?|resultados?|apto|inapto|medicacao|consulta|diagnostico)\b/.test(
        normalizePgrText(page.texto)
      )
    );
  });
  return (
    lines.some((line) =>
      /^(?:ficha clinica|prontuario(?: medico)?|anamnese|historia clinica|hipotese diagnostica)(?:$|\s*[:–-])/.test(
        line
      )
    ) ||
    /\bcid(?:\s*[- ]?10)?\s*[:.-]?\s*[a-tv-z]\d{2}/.test(text) ||
    individualClinical
  );
}

const documentPatterns: {
  tipo: NaiDocumentType;
  title: RegExp;
  acronym?: string;
}[] = [
  { tipo: "PGR", title: /programa de gerenciamento de riscos/, acronym: "pgr" },
  {
    tipo: "LTCAT",
    title: /laudo tecnico (?:das? )?condicoes ambientais (?:do|de) trabalho/,
    acronym: "ltcat",
  },
  {
    tipo: "PCMSO",
    title: /programa de controle medico (?:de )?saude ocupacional/,
    acronym: "pcmso",
  },
  { tipo: "ASO", title: /atestado de saude ocupacional/, acronym: "aso" },
  {
    tipo: "PERICIA_MEDICA",
    title: /(?:laudo (?:de )?)?pericias? medicas?|laudo medico[- ]pericial|laudo pericial medico/,
  },
  { tipo: "AEP", title: /avaliacao ergonomica preliminar/, acronym: "aep" },
  { tipo: "AET", title: /analise ergonomica (?:do|de) trabalho/, acronym: "aet" },
  {
    tipo: "DADOS_ERGONOMICOS",
    title:
      /dados ergonomicos|levantamento ergonomico|relatorio (?:de )?ergonomi(?:a|co)|avaliacao ergonomica (?:dos? )?postos? de trabalho/,
  },
];

const referenceHeading =
  /^(?:indice|sumario|referencias?|bibliografia|quadro de documentos|relacao de documentos|documentos (?:relacionados|vinculados|de referencia|complementares))\b/;

function headingTitle(lines: string[], spec: (typeof documentPatterns)[number]) {
  let title = "";
  for (const line of lines.slice(0, 4)) {
    if (!line || referenceHeading.test(normalizePgrText(line)) || /\.{4}|_{4}/.test(line)) break;
    title = compact(`${title} ${line}`);
    const normalized = normalizePgrText(title);
    const match = spec.title.exec(normalized);
    if (!match) continue;
    // A title must start on the first line. Short prose prefixes ("O Programa…")
    // are not headings, even when a PDF wraps the sentence across several lines.
    if (match.index >= normalizePgrText(lines[0]).length) return null;
    const prefix = normalized.slice(0, match.index).trim();
    const headingPrefix =
      /^(?:(?:titulo|documento|tipo de documento)\s*:|\d+(?:\.\d+)*[.)]?\s*[-–—:]?)?$/;
    const acronymPrefix = spec.acronym ? new RegExp(`^${spec.acronym}\\s*[-–—:]$`) : null;
    if (!headingPrefix.test(prefix) && !acronymPrefix?.test(prefix)) return null;
    // Check only the line completing the title, not the paragraph after it.
    // A parenthesized acronym may end a heading, but must not hide prose after it.
    let suffix = normalized.slice(match.index + match[0].length).trim();
    if (spec.acronym) suffix = suffix.replace(new RegExp(`^\\(\\s*${spec.acronym}\\s*\\)\\s*`), "");
    if (suffix && !/^(?:[. ]*$|[-–—:/]|\d{4}(?:\b|$))/.test(suffix)) return null;
    return title;
  }
  return null;
}

/** Titles and document structure are evidence; filenames and active clients are never inputs. */
export function classifyNaiDocument(pages: PgrPage[]): NaiDocument {
  const candidates: {
    tipo: NaiDocumentType;
    score: number;
    pagina: number;
    trecho: string;
    fullTitle: boolean;
  }[] = [];
  for (const page of pages) {
    const lines = page.texto.split(/\r?\n/).map(compact).filter(Boolean);
    let referenceSection = false;
    for (const [lineIndex, line] of lines.slice(0, 80).entries()) {
      const normalized = normalizePgrText(line);
      if (referenceHeading.test(normalized)) {
        referenceSection = true;
        continue;
      }
      if (referenceSection || /\.{4}|_{4}/.test(line)) continue;
      if (
        /^(?:referencias?|bibliografia|consultar|ver |conforme |solicitar|anexo\b)/.test(normalized)
      )
        continue;
      for (const spec of documentPatterns) {
        const title = headingTitle(lines.slice(lineIndex, lineIndex + 4), spec);
        const fullTitle = title !== null;
        const acronymTitle =
          !!spec.acronym &&
          new RegExp(
            `^(?:(?:documento|titulo)\\s*:\\s*)?${spec.acronym.split("").join("[.\\s]*")}\\.?(?:$|\\s*[-–—:/([]|\\s+\\d{4}\\b)`
          ).test(normalized);
        if (!fullTitle && !acronymTitle) continue;
        candidates.push({
          tipo: spec.tipo,
          score: (fullTitle ? 90 : 70) + (page.numero === 1 ? 30 : 0) + (lineIndex < 12 ? 15 : 0),
          pagina: page.numero,
          trecho: (title || line).slice(0, 1200),
          fullTitle,
        });
      }
    }
  }
  // A cover can be absent in an extracted PDF; an occupational risk inventory still has a
  // recognizable structure. References to a PGR inside another classified document do not win.
  if (!candidates.length) {
    const inventory = pages.find((page) =>
      /INVENT[ÁA]RIO\s+DE\s+RISCOS|RECONHECIMENTO\s+DE\s+RISCOS\s+AMBIENTAIS/i.test(page.texto)
    );
    if (inventory) {
      const line = inventory.texto
        .split(/\r?\n/)
        .find((item) =>
          /INVENT[ÁA]RIO\s+DE\s+RISCOS|RECONHECIMENTO\s+DE\s+RISCOS\s+AMBIENTAIS/i.test(item)
        )!;
      candidates.push({
        tipo: "PGR",
        score: 45,
        pagina: inventory.numero,
        trecho: compact(line).slice(0, 1200),
        fullTitle: false,
      });
    }
  }
  const unique = [
    ...new Map(
      candidates
        .sort((a, b) => b.score - a.score)
        .map((item) => [item.tipo, item] as const)
        .reverse()
    ).values(),
  ].sort((a, b) => b.score - a.score);
  const best = unique[0];
  const fullTitleTypes = new Set(
    candidates.filter((item) => item.fullTitle).map((item) => item.tipo)
  );
  const ambiguous =
    fullTitleTypes.size > 1 ||
    (!!best && unique.some((item) => item.tipo !== best.tipo && best.score - item.score <= 15));
  const tipo = best && !ambiguous ? best.tipo : "OUTRO";
  const clinical =
    hasNaiClinicalData(pages) ||
    ["PCMSO", "ASO", "PERICIA_MEDICA"].includes(tipo) ||
    candidates.some(
      (item) => item.fullTitle && ["PCMSO", "ASO", "PERICIA_MEDICA"].includes(item.tipo)
    );
  return {
    tipo,
    agenteResponsavel: naiDocumentAgent(tipo),
    statusClassificacao: ambiguous ? "ambiguo" : best ? "identificado" : "nao_identificado",
    evidencias: (ambiguous ? unique : best ? [best] : [])
      .slice(0, 10)
      .map(({ pagina, trecho }) => ({ pagina, trecho })),
    justificativa: ambiguous
      ? "Há títulos de mais de um tipo documental. Separe os documentos ou confira o tipo antes de integrar."
      : best
        ? `${NAI_DOCUMENT_NAMES[tipo]} identificado pelo título ou estrutura presente no conteúdo. Encaminhamento ao ${PGR_AGENT_NAMES[naiDocumentAgent(tipo)!]}.`
        : "O conteúdo disponível não permite identificar o tipo com segurança. Reenvie o documento completo ou uma cópia legível.",
    acesso: clinical ? "clinico_restrito" : "sst",
  };
}

/** Only explicitly labeled professional/provider blocks become registry suggestions. */
export function extractNaiProviders(pages: PgrPage[]): NaiProvider[] {
  const providers: NaiProvider[] = [];
  const labels =
    /(?:^|\n)\s*(empresa\s+(?:elaboradora|prestadora|contratada)|prestador(?:a)?(?:\s+(?:respons[aá]vel|de\s+servi[çc]os))?|contratada|elaborad[oa]\s+por|respons[aá]vel\s+t[eé]cnico|m[eé]dico\s+(?:respons[aá]vel|examinador|coordenador)|cl[ií]nica(?:\s+executante)?)\s*:\s*([^\n]{3,500})/gi;
  for (const page of pages) {
    for (const match of page.texto.matchAll(labels)) {
      const nome = compact(
        match[2]
          .replace(/^(?:raz[aã]o\s+social|empresa)\s*:\s*/i, "")
          .split(
            /\b(?:C\.?N\.?P\.?J\.?|CPF|CRM|CREA|COREN|CREFITO|Endere[çc]o|E-?mail|Telefone)\s*[:/-]?/i
          )[0]
      ).slice(0, 300);
      if (nome.length < 3) continue;
      const start = (match.index || 0) + match[0].search(/\S/);
      let context = page.texto.slice(start, start + 1100);
      const nextEntity = context
        .slice(match[0].trimStart().length)
        .search(
          /\n\s*(?:empresa|raz[aã]o\s+social|contratante|cliente|contratada|prestador|respons[aá]vel\s+t[eé]cnico|m[eé]dico\s+(?:respons[aá]vel|examinador|coordenador))(?:\s*:|[ \t]+|\s*\n)/i
        );
      if (nextEntity >= 0) context = context.slice(0, match[0].trimStart().length + nextEntity);
      const cnpj = compact(
        context.match(
          /C\.?\s*N\.?\s*P\.?\s*J\.?\s*:?\s*(\d{2}[.\s]?\d{3}[.\s]?\d{3}\s*\/\s*\d{4}\s*-\s*\d{2}|\d{14})/i
        )?.[1] || ""
      );
      const registroProfissional = compact(
        context.match(
          /\b(?:CRM|CREA|COREN|CREFITO|CRP)[ \t]*(?:[-/][ \t]*[A-Z]{2})?[ \t:º°n.N-]*(?:[A-Z]{2}[ \t]+)?\d[\d.]*(?:[ \t]*[-/][ \t]*[A-Z0-9]{1,8})?/i
        )?.[0] || ""
      );
      const row: NaiProvider = {
        id: stableId(nome + "|" + cnpj + "|" + registroProfissional),
        nome,
        cnpj,
        registroProfissional,
        especialidade: compact(
          context.match(/(?:especialidade|profiss[aã]o)\s*:\s*([^\n]{3,180})/i)?.[1] || ""
        ),
        papelNoDocumento: compact(match[1]),
        evidencias: [{ pagina: page.numero, trecho: compact(context).slice(0, 1200) }],
        cidadeUf: compact(
          context.match(/(?:cidade\s*\/?\s*UF|munic[ií]pio|cidade)\s*:\s*([^\n]{3,120})/i)?.[1] ||
            ""
        ),
        endereco: compact(context.match(/endere[çc]o\s*:\s*([^\n]{3,500})/i)?.[1] || ""),
        email: context.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || "",
        telefone: compact(
          context.match(/(?:telefone|fone|celular)\s*:\s*([^\n]{5,100})/i)?.[1] || ""
        ),
      };
      if (!providers.some((item) => item.id === row.id)) providers.push(row);
      if (providers.length >= 25) return providers;
    }
  }
  return providers;
}

const specificReviews: Partial<
  Record<NaiDocumentType, { title: string; description: string; checklist: string[] }>
> = {
  PGR: {
    title: "Revisar o inventário e o plano de ação do PGR",
    description:
      "O Engenheiro de Segurança confronta o inventário, a metodologia, os controles e o plano de ação com as evidências da unidade, registrando lacunas para revisão profissional.",
    checklist: [
      "Conferir empresa, unidade, emissão e responsável técnico.",
      "Comparar perigos, setores, critérios e controles com as evidências.",
      "Conferir cronograma original e ações ainda sem comprovação.",
      "Relacionar documentos complementares e definir responsáveis pelas pendências.",
      "Registrar divergências e submeter a revisão ao responsável técnico.",
    ],
  },
  LTCAT: {
    title: "Revisar evidências e responsabilidade técnica do LTCAT",
    description:
      "Conferir atividades, agentes, medições e metodologia com o responsável técnico. Não concluir enquadramento previdenciário ou exposição sem avaliação competente.",
    checklist: [
      "Conferir empresa, unidade e responsável técnico.",
      "Relacionar atividades, agentes, medições e métodos documentados.",
      "Comparar o contexto com o inventário do PGR.",
      "Registrar lacunas e submeter a conclusão ao responsável técnico.",
    ],
  },
  PCMSO: {
    title: "Revisar PCMSO com o Médico do Trabalho",
    description:
      "Confrontar o programa com o contexto ocupacional e organizar pendências para o médico responsável. Exames e periodicidades dependem da conduta médica aprovada.",
    checklist: [
      "Conferir empresa, unidade, emissão e médico responsável.",
      "Relacionar o programa aos riscos e grupos do PGR vigente.",
      "Conferir cronograma e condutas documentadas sem criar prescrições.",
      "Organizar pendências de agenda apenas após aprovação médica.",
      "Registrar versão, lacunas e aprovação do responsável.",
    ],
  },
  ASO: {
    title: "Conferir ASO e pendências documentais em acesso restrito",
    description:
      "O Médico do Trabalho confere o documento e encaminha somente pendências administrativas autorizadas. A análise IA não emite ASO nem decide aptidão.",
    checklist: [
      "Conferir a correspondência do ASO com empresa e trabalhador no ambiente restrito.",
      "Verificar tipo de exame, datas e identificação profissional documentados.",
      "Conferir integridade e assinatura do original, sem afirmar sua autenticidade automaticamente.",
      "Encaminhar divergências ao médico responsável.",
      "Liberar somente as informações administrativas necessárias para acompanhamento.",
    ],
  },
  PERICIA_MEDICA: {
    title: "Revisar documentação de perícia médica em acesso restrito",
    description:
      "Organizar as evidências e lacunas para revisão médica. O agente não estabelece diagnóstico, nexo, incapacidade, aptidão ou conclusão pericial autônoma.",
    checklist: [
      "Conferir finalidade, autoria e integridade do documento.",
      "Distinguir relatos, achados documentados e conclusão do profissional.",
      "Relacionar documentos faltantes sem expor informações clínicas em cards gerais.",
      "Encaminhar dúvidas ao médico responsável e registrar a revisão.",
    ],
  },
  AEP: {
    title: "Revisar AEP e organizar melhorias ergonômicas",
    description:
      "Conferir tarefas, exigências e organização do trabalho com o Ergonomista. Registrar lacunas e necessidade de aprofundamento sem afirmar avaliação de campo inexistente.",
    checklist: [
      "Conferir unidade, setores e atividades descritas.",
      "Verificar participação dos trabalhadores e evidências da atividade real.",
      "Relacionar exigências físicas, cognitivas e organizacionais documentadas.",
      "Definir medidas, responsáveis e evidências de acompanhamento.",
      "Submeter a necessidade de aprofundamento em AET à avaliação profissional.",
    ],
  },
  AET: {
    title: "Revisar AET e acompanhar o plano de melhorias",
    description:
      "O Ergonomista examina demanda, atividade real, método, achados e recomendações, preservando a distinção entre evidências e propostas.",
    checklist: [
      "Conferir demanda, método, setores e tarefas analisadas.",
      "Verificar evidências de campo e participação dos trabalhadores.",
      "Relacionar recomendações aos achados e responsáveis documentados.",
      "Definir acompanhamento e evidências de eficácia das medidas.",
      "Registrar lacunas para revisão profissional antes de concluir a avaliação.",
    ],
  },
  DADOS_ERGONOMICOS: {
    title: "Organizar dados ergonômicos para análise especializada",
    description:
      "Consolidar dados sobre tarefas e organização do trabalho para o Ergonomista, sem convertê-los automaticamente em AEP, AET ou diagnóstico.",
    checklist: [
      "Identificar fonte, data, unidade e atividade de cada dado.",
      "Conferir método, amostra e limitações das informações.",
      "Separar relatos, observações e medições documentadas.",
      "Listar dados faltantes e planejar sua coleta.",
      "Definir próximos passos com o Ergonomista responsável.",
    ],
  },
};

/** Adds a practical document-specific handoff; no action is marked performed or approved. */
export function withNaiDocumentWorkflow(
  output: PgrAnalysisOutput,
  pages: PgrPage[],
  document = getNaiDocument(output)
): PgrAnalysisOutput {
  const type = document.tipo;
  let actions = output.acoesCategorizadas;
  actions = actions.filter(
    (action) =>
      !action.id.startsWith("agent_") &&
      !action.id.startsWith("nai_review_") &&
      !action.id.startsWith("nai_followup_")
  );
  if (document.acesso === "clinico_restrito" && output.analiseAgente?.status !== "concluida") {
    // Generic PGR tasks do not apply to a clinical draft. After a medical analysis, its
    // document-specific actions stay in the restricted record; the save plan sanitizes the
    // general operational card independently and never copies clinical model-authored text.
    actions = [];
  }
  const review = specificReviews[type];
  const role = document.agenteResponsavel;
  if (review && role) {
    const action: PgrAction = {
      id: `nai_review_${type.toLowerCase()}`,
      tipoAcao: "Verificação",
      titulo: review.title,
      descricaoDetalhada: review.description,
      prioridade: "medium",
      colunaKanban: "todo",
      referenciaLegal:
        role === "medico_trabalho"
          ? "NR-7 · aplicabilidade a conferir pelo médico"
          : role === "ergonomista"
            ? "NR-17 · aplicabilidade a conferir"
            : "Referências técnicas do documento a conferir",
      responsavelSugerido: PGR_AGENT_NAMES[role],
      agenteSugerido: role,
      riscosRelacionados: [],
      evidencia: null,
      checklist: review.checklist,
      fundamento: "sugestao",
      prazoDocumentado: "",
    };
    actions = [action, ...actions];
    if (document.acesso !== "clinico_restrito")
      actions.push({
        id: `nai_followup_${type.toLowerCase()}`,
        tipoAcao: "Verificação",
        titulo: `Preparar devolutiva e próximos passos de ${NAI_DOCUMENT_NAMES[type]}`,
        descricaoDetalhada:
          "Organizar um resumo de achados, pendências e responsáveis para revisão da equipe antes de apresentar ao cliente. Este card não envia mensagens nem aprova documentos.",
        prioridade: "medium",
        colunaKanban: "todo",
        referenciaLegal: "Datas documentadas e referências aplicáveis a conferir",
        responsavelSugerido: PGR_AGENT_NAMES[role],
        agenteSugerido: role,
        riscosRelacionados: [],
        evidencia: null,
        checklist: [
          "Conferir dados do cliente e responsáveis extraídos com o original.",
          "Relacionar achados e pendências aos cards e documentos de origem.",
          "Conferir emissão e datas expressamente documentadas, sem supor validade legal universal.",
          "Combinar responsáveis, próximos passos e prazos operacionais com a equipe.",
          "Revisar e aprovar a devolutiva antes de qualquer comunicação ao cliente.",
        ],
        fundamento: "sugestao",
        prazoDocumentado: "",
      });
  }
  if (document.statusClassificacao !== "identificado") actions = [];
  return {
    ...output,
    documento: document,
    prestadoresIdentificados: output.prestadoresIdentificados || extractNaiProviders(pages),
    acoesCategorizadas: actions.slice(0, 120),
    analiseAgente: output.analiseAgente || {
      agente: role,
      status: "pendente",
      resumo: role
        ? "Documento encaminhado para análise especializada; revisão profissional pendente."
        : "A classificação precisa ser conferida antes do encaminhamento ao agente.",
    },
  };
}
