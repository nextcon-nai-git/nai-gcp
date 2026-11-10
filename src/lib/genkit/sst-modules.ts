export interface SstField {
  key: string;
  label: string;
  kind:
    "text" | "number" | "date" | "select" | "textarea" | "list" | "rows" | "multipliers" | "check";
  required?: boolean;
  options?: string[];
  hint?: string;
}
interface Module {
  title: string;
  origin: string;
  fields: SstField[];
  accept?: string;
}
const field = (
  key: string,
  label: string,
  kind: SstField["kind"] = "text",
  required = true,
  hint?: string
): SstField => ({ key, label, kind, required, hint });
const select = (key: string, label: string, options: string[]): SstField => ({
  key,
  label,
  kind: "select",
  options,
  required: true,
});
export const sstModules = {
  ergonomia: {
    title: "Avaliar posto de trabalho",
    origin: "/reports/industrial-ergonomics",
    accept: "image/jpeg,image/png,video/mp4",
    fields: [
      field("postoTrabalho", "Posto de trabalho"),
      field("atividadeExecutada", "Atividade e ciclo observado", "textarea"),
      select("metodo", "Método da ficha de campo", ["RULA", "REBA", "NIOSH"]),
      field("grupoA", "Pontuação ajustada do grupo A", "number", false),
      field("grupoB", "Pontuação ajustada do grupo B", "number", false),
      field("atividade", "Ajuste de atividade REBA (0 a 3)", "number", false),
      field("cargaKg", "Peso da carga (kg)", "number", false),
      field(
        "multiplicadores",
        "HM, VM, DM, AM, FM e CM",
        "multipliers",
        false,
        "Separe por espaço. Use ponto para decimais e valores da ficha de levantamento."
      ),
      field(
        "aplicabilidadeConfirmada",
        "Conferi a aplicabilidade da equação NIOSH para esta tarefa",
        "check",
        false
      ),
    ],
  },
  fap: {
    title: "Avaliar NTEP e simular RAT ajustado",
    origin: "/legal-financial/ntep-contestation",
    fields: [
      field("cnpjEmpresa", "CNPJ do estabelecimento"),
      field("cnaePrincipal", "CNAE do estabelecimento"),
      field("cid10", "CID-10 da concessão"),
      select("especie", "Espécie concedida", ["B31", "B91"]),
      field("numeroBeneficio", "Número do benefício"),
      field("dataInicio", "Início do benefício", "date"),
      field("dataFim", "Fim do benefício", "date", false),
      select("cat", "Emissão da CAT", ["Desconhecido", "Sim", "Não"]),
      field("exposicao", "Evidência de exposição no S-2240"),
      field("aso", "ASO relacionado", "text", false),
      field("folhaAnual", "Base anual de incidência (R$)", "number"),
      field("rat", "Alíquota RAT de 1%, 2% ou 3%", "number"),
      field("fapAtual", "FAP vigente do estabelecimento", "number"),
      field("fapSimulado", "FAP para o cenário simulado", "number"),
    ],
  },
  fiscalizacao: {
    title: "Simular fiscalização pela NR-28",
    origin: "/governance/compliance-audit",
    fields: [
      field("numeroColaboradores", "Número de empregados", "number"),
      field("grauRiscoEmpresa", "Grau de risco de 1 a 4", "number"),
      select("regime", "Regime de trabalho", ["Geral", "Rural", "Portuário"]),
      field("asosVencidos", "ASOs sinalizados como vencidos", "number"),
      field("treinamentosPendentes", "Treinamentos pendentes", "number"),
      field("eventosS2210", "CATs S-2210 enviadas", "number", false),
      field("eventosS2220", "Eventos S-2220 enviados", "number", false),
      field("eventosS2240", "Eventos S-2240 enviados", "number", false),
      field("laudosPendentes", "Documentos a conferir", "textarea", false),
      field(
        "itens",
        "Códigos de infrações confirmadas",
        "list",
        false,
        "Um código por linha. Exemplo de formato: 107128-9."
      ),
      field("valorUnidade", "Valor vigente da unidade de cálculo em reais", "number", false),
      field("referenciaConversao", "Referência oficial e vigência da conversão", "text", false),
    ],
  },
  acidente: {
    title: "Investigar acidente de trabalho",
    origin: "/accidents",
    fields: [
      field("dataAcidente", "Data do acidente", "date"),
      field("setor", "Setor"),
      field("equipamento", "Equipamento envolvido", "text", false),
      field("codigoSituacao", "Código da situação geradora da CAT", "text", false),
      field("cid10", "CID-10 registrado na CAT", "text", false),
      field("relato", "Relatos e evidências disponíveis", "textarea"),
    ],
  },
  migracao: {
    title: "Conferir agentes da Tabela 24",
    origin: "/integrations/soc",
    fields: [
      select("sistemaOrigem", "Origem", ["SOC", "SENIOR", "TOTVS", "EXCEL_CUSTOM"]),
      field("dataReferencia", "Data de referência dos registros", "date"),
      field(
        "registros",
        "Registros do legado",
        "rows",
        true,
        "Cole até 500 linhas de uma planilha, com colunas separadas por tabulação: ID, agente, intensidade e EPI. As duas últimas são opcionais."
      ),
    ],
  },
  capacitacao: {
    title: "Conferir certificado de capacitação",
    origin: "/trainings",
    accept: "application/pdf,image/png,image/jpeg",
    fields: [
      field("cpf", "CPF do trabalhador (11 dígitos)"),
      field("funcao", "Função desempenhada"),
      select("norma", "Norma aplicável", ["NR-10", "NR-12", "NR-33", "NR-35"]),
      select("modalidade", "Modalidade a conferir", ["Inicial", "Periódico", "Eventual"]),
      select("perfil", "Perfil de capacitação", [
        "Geral",
        "Supervisor de entrada",
        "Vigia ou trabalhador autorizado",
        "SEP",
      ]),
      field("dataReferencia", "Data da conferência", "date"),
    ],
  },
} satisfies Record<string, Module>;
export type SstModule = keyof typeof sstModules;
export function getSstModule(id: string): Module | undefined {
  return Object.hasOwn(sstModules, id) ? sstModules[id as SstModule] : undefined;
}
export function parseSstFields(id: SstModule, form: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const f of sstModules[id].fields) {
    const raw = form.get(f.key);
    if (raw !== null && typeof raw !== "string") throw new Error("Campo inválido.");
    const v = raw?.trim() ?? "";
    if (v.length > 160000) throw new Error("Limite de registros excedido.");
    if (f.kind === "list") {
      result[f.key] = v ? v.split(/[\s,;]+/) : [];
      continue;
    }
    if (f.kind === "check") {
      result[f.key] = raw === "on";
      continue;
    }
    if (!v) {
      if (f.required) throw new Error("Campo obrigatório.");
      continue;
    }
    if (f.kind === "rows") {
      result[f.key] = v
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split("\t").map((s) => s.trim());
          if (parts.length < 2 || parts.length > 4)
            throw new Error("Confira as colunas da planilha.");
          return {
            idOriginal: parts[0],
            descricaoAgenteNocivo: parts[1],
            intensidadeMedida: parts[2] || undefined,
            equipamentoProtecao: parts[3] || undefined,
          };
        });
    } else if (f.kind === "multipliers")
      result[f.key] = v.split(/\s+/).map((v) => Number(v.replace(",", ".")));
    else if (f.kind === "number") result[f.key] = Number(v.replace(",", "."));
    else result[f.key] = v;
  }
  return result;
}
