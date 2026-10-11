import { createHash } from "node:crypto";
import {
  PGR_AGENT_NAMES,
  PGR_AGENT_ROLES,
  PGR_VERSION,
  isValidPgrCnpj,
  normalizePgrText,
  type PgrPage,
  type PgrRisk,
  type PgrAction,
  type PgrAnalysisOutput,
} from "./pgr-schema";

const id = (value: string) =>
  createHash("sha256").update(normalizePgrText(value)).digest("hex").slice(0, 24);
const compact = (value: string) => value.replace(/\s+/g, " ").trim();
export function evidenceIsInPages(evidence: { pagina: number; trecho: string }, pages: PgrPage[]) {
  const page = pages.find((p) => p.numero === evidence.pagina);
  return !!page && normalizePgrText(page.texto).includes(normalizePgrText(evidence.trecho));
}
export function isPgrExposureEvidence(
  evidence: { pagina: number; trecho: string },
  pages: PgrPage[]
) {
  const page = pages.find((p) => p.numero === evidence.pagina);
  return (
    !!page &&
    evidenceIsInPages(evidence, pages) &&
    !/CONCEITOS\s+DE\s+RISCOS|Classifica[çc][aã]o\s+dos\s+agentes|INTRODU[ÇC][ÃA]O|MATRIZ\s+DE\s+DECIS[ÃA]O/i.test(
      page.texto
    ) &&
    /RECONHECIMENTO\s+DE\s+RISCOS|INVENT[ÁA]RIO|GHE|EXPOST[OA]|EXPOSI[ÇC][ÃA]O/i.test(page.texto) &&
    !/(?:n[aã]o\s+h[aá]|sem|aus[eê]ncia\s+de)\s+exposi[çc][aã]o/i.test(evidence.trecho)
  );
}
export function parsePgrDocumentPages(pages: PgrPage[]): PgrAnalysisOutput {
  const identityCandidates: {
    name: string;
    cnpj: string;
    page: number;
    quote: string;
    address: string;
  }[] = [];
  for (const page of pages.slice(0, 12)) {
    const regex =
      /(?:raz[aã]o\s+social|empresa(?:\s+(?:avaliada|contratante))?|contratante|cliente|empregador)\s*:\s*([^\n]{3,300})/gi;
    for (const m of page.texto.matchAll(regex)) {
      // A provider's labeled corporate name is not a second client. Respect the nearest
      // identification block, and stop before the issuer when looking for an employer CNPJ.
      const priorHeadings = [
        ...page.texto
          .slice(0, m.index || 0)
          .matchAll(
            /(?:^|\n)\s*((?:identifica[çc][aã]o|dados)\s+d[ao]\s+(?:empresa|contratante|cliente|prestador[a]?|contratada)|empresa\s+(?:elaboradora|prestadora|contratada|avaliada|contratante)|prestador[a]?|contratada|elaborad[oa]\s+por|respons[aá]vel\s+t[eé]cnico|m[eé]dico\s+(?:respons[aá]vel|examinador|coordenador)|cliente|contratante|empregador)\s*(?::|\n)/gi
          ),
      ];
      const heading = normalizePgrText(priorHeadings.at(-1)?.[1] || "");
      const explicitClient =
        /^(?:cliente|contratante|empregador|empresa\s+(?:avaliada|contratante))\s*:/i.test(m[0]);
      if (
        !explicitClient &&
        /prestador|contratada|elaborad|responsavel tecnico|medico/.test(heading)
      )
        continue;
      const name = compact(
        m[1].split(/\b(?:C\.?N\.?P\.?J\.?|CNAE|Endere[çc]o|Grau\s+de\s+Risco)\s*:/i)[0]
      );
      if (!name || /^(respons[aá]vel|contratada|elaboradora|prestador)/i.test(name)) continue;
      const tail = page.texto.slice((m.index || 0) + m[0].length, (m.index || 0) + 1000);
      const nextEntity = tail.search(
        /(?:raz[aã]o\s+social|empresa(?:\s+(?:elaboradora|prestadora|contratada|avaliada|contratante))?|contratante|cliente|empregador|prestador[a]?|contratada|cl[ií]nica(?:\s+executante)?|elaborad[oa]\s+por|respons[aá]vel\s+t[eé]cnico|m[eé]dico\s+(?:respons[aá]vel|examinador|coordenador)|(?:nome\s+d[oa]\s+)?(?:empregad[oa]|trabalhador[a]?|colaborador[a]?|paciente|funcion[aá]ri[oa]))\s*:/i
      );
      const context = m[0] + (nextEntity >= 0 ? tail.slice(0, nextEntity) : tail);
      const cnpj =
        context.match(
          /C\.?\s*N\.?\s*P\.?\s*J\.?\s*:?\s*(\d{2}[.\s]?\d{3}[.\s]?\d{3}\s*\/\s*\d{4}\s*-\s*\d{2}|\d{14})/i
        )?.[1] || "";
      const address = context.match(/Endere[çc]o\s*:\s*([^\n]{3,400})/i)?.[1] || "";
      identityCandidates.push({
        name,
        cnpj: compact(cnpj),
        page: page.numero,
        quote: compact(m[0]),
        address: compact(address),
      });
    }
  }
  const unique = [
    ...new Map(identityCandidates.map((c) => [normalizePgrText(c.name) + c.cnpj, c])).values(),
  ];
  const candidate = unique.length === 1 ? unique[0] : null;
  const allText = pages.map((p) => p.texto).join("\n");
  const risks: PgrRisk[] = [];
  const riskPatterns: { label: string; category: PgrRisk["categoria"]; pattern: RegExp }[] = [
    {
      label: "Ruído",
      category: "fisico",
      pattern: /\bru[ií]do(?:\s+(?:cont[ií]nuo|de\s+impacto))?\b/i,
    },
    {
      label: "Vibração",
      category: "fisico",
      pattern: /\bvibra[çc][aã]o(?:\s+(?:localizada|de\s+corpo\s+inteiro))?/i,
    },
    { label: "Calor", category: "fisico", pattern: /\bcalor\b/i },
    {
      label: "Radiação",
      category: "fisico",
      pattern: /\bradia[çc][aã]o(?:\s+n[aã]o\s+ionizante|\s+ionizante)?/i,
    },
    {
      label: "Agentes químicos",
      category: "quimico",
      pattern:
        /\b(?:solventes?|thinner|benzeno|tolueno|xileno|[aá]cidos?|fumos\s+met[aá]licos|vapores|poeiras|reagentes|agentes\s+qu[ií]micos)\b/i,
    },
    {
      label: "Agentes biológicos",
      category: "biologico",
      pattern: /\b(?:bact[eé]rias|fungos|v[ií]rus|parasitas|agentes\s+biol[oó]gicos)\b/i,
    },
    {
      label: "Fatores ergonômicos",
      category: "ergonomico",
      pattern:
        /\b(?:postura\s+(?:inadequada|est[aá]tica)|movimentos?\s+repetitivos?|levantamento\s+(?:manual\s+)?de\s+cargas|sobrecarga\s+muscular)\b/i,
    },
    {
      label: "Fatores psicossociais",
      category: "psicossocial",
      pattern: /\b(?:fatores?\s+psicossociais|ass[eé]dio|sobrecarga\s+de\s+trabalho)\b/i,
    },
    {
      label: "Trabalho em altura",
      category: "acidente",
      pattern: /\b(?:trabalho\s+em\s+altura|queda\s+de\s+altura)\b/i,
    },
    {
      label: "Eletricidade",
      category: "acidente",
      pattern:
        /\b(?:choque\s+el[eé]trico|energias?\s+perigosas|instala[çc][oõ]es\s+el[eé]tricas)\b/i,
    },
    {
      label: "Máquinas e equipamentos",
      category: "acidente",
      pattern: /\b(?:partes\s+m[oó]veis|prensas?|aprisionamento|amputa[çc][aã]o)\b/i,
    },
  ];
  const sectors = new Set<string>();
  for (const page of pages) {
    // Definições, introdução, índice e matrizes não provam exposição da unidade.
    if (
      /CONCEITOS\s+DE\s+RISCOS|Classifica[çc][aã]o\s+dos\s+agentes|INTRODU[ÇC][ÃA]O|MATRIZ\s+DE\s+DECIS[ÃA]O/i.test(
        page.texto
      )
    )
      continue;
    const inventory =
      /RECONHECIMENTO\s+DE\s+RISCOS|INVENT[ÁA]RIO|GHE|EXPOST[OA]|EXPOSI[ÇC][ÃA]O/i.test(page.texto);
    if (!inventory) continue;
    const lines = page.texto.split("\n").map(compact).filter(Boolean);
    const sectorIndex = lines.findIndex((l) => /RECONHECIMENTO DE RISCOS|INVENT[ÁA]RIO/i.test(l));
    const sector =
      sectorIndex >= 0
        ? lines
            .slice(sectorIndex + 1, sectorIndex + 5)
            .filter((l) => !/^Grupo Homog|^Fun[çc][oõ]es|^Tipos de|^\d+$/.test(l))
            .join(" · ")
            .slice(0, 300)
        : page.texto.match(/GHE\s*[:\d-]+[^\n]{0,150}/i)?.[0] || "Setor a conferir";
    for (const spec of riskPatterns) {
      const match = spec.pattern.exec(page.texto);
      if (!match) continue;
      const start = Math.max(0, match.index - 80);
      const end = Math.min(page.texto.length, match.index + 350);
      const quote = compact(page.texto.slice(start, end));
      if (
        /(?:n[aã]o\s+h[aá]|aus[eê]ncia\s+de|sem)\s+(?:exposi[çc][aã]o\s+(?:a\s+)?)?$/i.test(
          page.texto.slice(Math.max(0, match.index - 35), match.index)
        )
      )
        continue;
      const key = id(spec.label + sector);
      if (risks.some((r) => r.id === key)) continue;
      sectors.add(sector);
      risks.push({
        id: key,
        agente: spec.label,
        categoria: spec.category,
        setorGhe: sector,
        evidencia: { pagina: page.numero, trecho: quote },
        controlesDocumentados: [],
        classificacaoOriginal: "",
      });
      if (risks.length >= 100) break;
    }
    if (risks.length >= 100) break;
  }
  const cnae = allText.match(/\bCNAE\s*:\s*([^\n]{1,160})/i)?.[1] || "";
  const degree = allText.match(/Grau\s+de\s+Risco\s*:\s*([1-4])\b/i)?.[1];
  const output: PgrAnalysisOutput = {
    pgrCardDetalhado: {
      razaoSocial: candidate?.name || "",
      cnpj: candidate?.cnpj || "",
      cnae: compact(cnae),
      grauDeRisco: degree ? Number(degree) : null,
      enderecoCompleto: candidate?.address || "",
      cidadeUf: "",
      dataEmissao: "",
      dataValidade: "",
      coordenadasGps: "",
      totalRiscosMapeados: risks.length,
      ghesIdentificados: [...sectors],
      esocialS2240Status:
        "A conferir pelo responsável técnico; PGR não comprova enquadramento ou transmissão do S-2240.",
    },
    identidade: {
      status: unique.length > 1 ? "ambigua" : candidate ? "identificada" : "nao_identificada",
      evidencias: unique.slice(0, 15).map((c) => ({ pagina: c.page, trecho: c.quote })),
      aviso:
        unique.length > 1
          ? "Há mais de uma identificação empresarial; confira contratante e elaborador."
          : !candidate
            ? "Não foi encontrada identificação empresarial rotulada. Não usar o nome do arquivo como prova."
            : !isValidPgrCnpj(candidate.cnpj)
              ? "CNPJ ausente ou inválido; confira o cadastro antes de integrar."
              : "Confira a unidade e o CNPJ extraídos antes de salvar.",
    },
    riscosIdentificados: risks,
    acoesCategorizadas: [],
    parecerTecnicoIA:
      "Extração documental preliminar. Os trechos indicam temas para revisão; não comprovam avaliação completa, exposição atual, eficácia de controles ou conformidade.",
    leitura: {
      modo: pages.some((p) => p.texto.trim()) ? "extracao_documental" : "inconclusiva",
      paginas: pages.length || 1,
      paginasComTexto: pages.filter((p) => p.texto.trim()).length,
      avisos: [
        "Classificações e medições não foram recalculadas. Nenhuma aptidão, exame ou transmissão é definida automaticamente.",
      ],
      versao: PGR_VERSION,
    },
  };
  return withPgrSuggestedActions(output, pages);
}

export function withPgrSuggestedActions(output: PgrAnalysisOutput, pages: PgrPage[]) {
  const actions: PgrAction[] = output.acoesCategorizadas.slice(0, 100);
  const add = (a: Omit<PgrAction, "id" | "colunaKanban">) =>
    actions.push({
      ...a,
      id: id(a.titulo + a.agenteSugerido + a.riscosRelacionados.join("")),
      colunaKanban: "todo",
    });
  for (const risk of output.riscosIdentificados) {
    if (actions.some((a) => a.riscosRelacionados.includes(risk.id))) continue;
    const agent = ["ergonomico", "psicossocial"].includes(risk.categoria)
      ? "ergonomista"
      : "engenheiro_seguranca";
    add({
      tipoAcao: "Verificação",
      titulo: `Revisar ${risk.agente}: ${risk.setorGhe || "setor a conferir"}`.slice(0, 180),
      descricaoDetalhada: `Confrontar a evidência da página ${risk.evidencia.pagina} com as tarefas reais, exposições e controles da unidade. Registrar lacunas antes de classificar o risco.`,
      prioridade: "medium",
      referenciaLegal:
        agent === "ergonomista"
          ? "NR-1 / NR-17 · aplicabilidade a conferir"
          : "NR-1 / NR-9 · aplicabilidade a conferir",
      responsavelSugerido: PGR_AGENT_NAMES[agent],
      agenteSugerido: agent,
      riscosRelacionados: [risk.id],
      evidencia: risk.evidencia,
      checklist: [
        "Confirmar setor, atividade e pessoas expostas com a unidade.",
        "Localizar medições, método, data e calibração quando aplicáveis.",
        "Conferir controles existentes e evidências de eficácia.",
        "Revisar classificação e propor controles conforme a hierarquia.",
        "Definir responsável, prazo e evidência de conclusão.",
      ],
      fundamento: "sugestao",
      prazoDocumentado: "",
    });
    if (actions.length >= 110) break;
  }
  const briefs: Record<
    (typeof PGR_AGENT_ROLES)[number],
    { title: string; description: string; checklist: string[] }
  > = {
    engenheiro_seguranca: {
      title: "Consolidar o inventário e o plano de ação do PGR",
      description:
        "Revisar metodologia, setores, evidências e classificação. Propor controles sem afirmar conformidade, insalubridade ou aposentadoria especial sem avaliação competente.",
      checklist: [
        "Conferir unidade e identificação empresarial.",
        "Comparar inventário, critérios e controles com as evidências.",
        "Conferir cronograma original e ações ainda sem comprovação.",
        "Registrar divergências e encaminhar para revisão humana.",
      ],
    },
    tecnico_seguranca: {
      title: "Preparar inspeções e checklists de campo",
      description:
        "Transformar os riscos documentados em inspeções da unidade, orientações operacionais e coleta de evidências, sem declarar uma inspeção realizada.",
      checklist: [
        "Validar atividades reais e participação dos trabalhadores.",
        "Inspecionar controles, procedimentos, EPCs e EPI aplicáveis.",
        "Conferir documentos e registros de capacitação.",
        "Anexar evidências e escalar desvios ao responsável técnico.",
      ],
    },
    medico_trabalho: {
      title: "Revisar a conexão do PGR com o PCMSO",
      description:
        "Encaminhar o contexto ocupacional ao médico responsável. Exames, periodicidade, diagnóstico e aptidão dependem de sua avaliação; este card não constitui prescrição.",
      checklist: [
        "Relacionar exposições documentadas e grupos de trabalhadores.",
        "Solicitar PCMSO e avaliações complementares disponíveis.",
        "Revisar a necessidade de vigilância pelo médico responsável.",
        "Registrar orientações aprovadas antes de encaminhar agendamentos.",
      ],
    },
    enfermeiro_trabalho: {
      title: "Organizar o acompanhamento de saúde ocupacional",
      description:
        "Preparar acompanhamento e orientações dentro da competência de enfermagem, somente a partir das condutas médicas aprovadas, sem acessar dados clínicos neste fluxo.",
      checklist: [
        "Conferir orientações e preparo aprovados pela equipe clínica.",
        "Listar pendências operacionais de acompanhamento.",
        "Separar contexto de exposição de informação clínica restrita.",
        "Encaminhar questões clínicas ao médico responsável.",
      ],
    },
    ergonomista: {
      title: "Revisar fatores ergonômicos e psicossociais do trabalho",
      description:
        "Conferir se as atividades e a organização do trabalho foram avaliadas; propor roteiro para análise ergonômica e lacunas, sem inventar AEP/AET ou diagnóstico.",
      checklist: [
        "Conferir tarefas reais, organização do trabalho e participação dos trabalhadores.",
        "Identificar lacunas em fatores ergonômicos e psicossociais.",
        "Verificar AEP/AET e dados de campo disponíveis.",
        "Propor medidas e critérios de acompanhamento para revisão.",
      ],
    },
  };
  for (const role of PGR_AGENT_ROLES) {
    if (actions.some((a) => a.id === `agent_${role}`)) continue;
    const b = briefs[role];
    actions.push({
      id: `agent_${role}`,
      tipoAcao: "Verificação",
      titulo: b.title,
      descricaoDetalhada: b.description,
      prioridade: "medium",
      colunaKanban: "todo",
      referenciaLegal:
        role === "medico_trabalho" || role === "enfermeiro_trabalho"
          ? "NR-7 · revisão profissional"
          : role === "ergonomista"
            ? "NR-1 / NR-17 · aplicabilidade a conferir"
            : "NR-1 · revisão profissional",
      responsavelSugerido: PGR_AGENT_NAMES[role],
      agenteSugerido: role,
      riscosRelacionados: [],
      evidencia: null,
      checklist: b.checklist,
      fundamento: "sugestao",
      prazoDocumentado: "",
    });
  }
  // Cronograma original gera tarefa documental sem fingir que o prazo foi cumprido.
  for (const page of pages
    .filter(
      (p) =>
        /CRONOGRAMA\s+DE\s+METAS|PLANO\s+DE\s+A[ÇC][ÃA]O/i.test(p.texto) &&
        /RESPONS[ÁA]VEIS|PRAZO|ATIVIDADE/i.test(p.texto) &&
        !/CONCEITOS\s+DE\s+RISCOS|INTRODU[ÇC][ÃA]O|[ÍI]NDICE|\.{4}/i.test(p.texto)
    )
    .slice(0, 5)) {
    const quote = compact(page.texto).slice(0, 1100);
    if (quote.length < 3) continue;
    add({
      tipoAcao: "Verificação",
      titulo: `Conferir ações e prazos do cronograma (p. ${page.numero})`,
      descricaoDetalhada:
        "Transcrever e conferir cada ação e seu prazo original, solicitar comprovantes e organizar pendências da unidade. Não marcar ações históricas como concluídas sem evidência.",
      prioridade: "high",
      referenciaLegal: "NR-1 · plano de ação a revisar",
      responsavelSugerido: PGR_AGENT_NAMES.tecnico_seguranca,
      agenteSugerido: "tecnico_seguranca",
      riscosRelacionados: [],
      evidencia: { pagina: page.numero, trecho: quote },
      checklist: [
        "Conferir atividades, responsáveis e prazos do documento original.",
        "Solicitar evidências de conclusão e registrar o estado real.",
        "Definir prazos operacionais para pendências com a unidade.",
        "Submeter alterações ao responsável técnico.",
      ],
      fundamento: "documento",
      prazoDocumentado: "Conferir o cronograma original.",
    });
  }
  return {
    ...output,
    acoesCategorizadas: actions.slice(0, 120),
    pgrCardDetalhado: {
      ...output.pgrCardDetalhado,
      totalRiscosMapeados: output.riscosIdentificados.length,
    },
  };
}
