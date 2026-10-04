import Papa from "papaparse";
import { GrupoAvpAso, AsoStatus, AsoUrgency } from "@/lib/grupo-avp-asos-data";

export interface SheetDiffEntry {
  numero: string;
  colaborador: string;
  cidade: string;
  campo: string;
  valorAnterior: string;
  valorNovo: string;
}

export interface SheetImportResult {
  success: boolean;
  totalParsed: number;
  updatedCount: number;
  addedCount: number;
  unchangedCount: number;
  mergedAsos: GrupoAvpAso[];
  diffLog: SheetDiffEntry[];
  errors: string[];
}

// Normaliza nomes de colunas para mapeamento semântico tolerante a variações
function normalizeHeaderName(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/º|°|ª/g, "o")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]/g, ""); // remove caracteres especiais e espaços
}

// Mapeamento flexível de aliases para as propriedades do GrupoAvpAso
const HEADER_MAPPINGS: Record<string, (keyof GrupoAvpAso)[]> = {
  numero: ["numero"],
  num: ["numero"],
  no: ["numero"],
  n: ["numero"],
  id: ["numero"],
  urgencia: ["urgencia"],
  urgente: ["urgencia"],
  prioridade: ["urgencia"],
  datapedido: ["dataPedido"],
  datadopedido: ["dataPedido"],
  pedido: ["dataPedido"],
  datadosolicitacao: ["dataPedido"],
  diasparado: ["diasParado"],
  dias: ["diasParado"],
  sla: ["diasParado"],
  cidade: ["cidade"],
  municipio: ["cidade"],
  cidadeuf: ["cidade"],
  polo: ["cidade"],
  localidade: ["cidade"],
  colaborador: ["colaborador"],
  nome: ["colaborador"],
  funcionario: ["colaborador"],
  candidato: ["colaborador"],
  exame: ["tipoExame"],
  tipoexame: ["tipoExame"],
  tipodeexame: ["tipoExame"],
  telefonegestor: ["telefoneGestor"],
  telefonedogestor: ["telefoneGestor"],
  gestor: ["telefoneGestor"],
  telgestor: ["telefoneGestor"],
  contatogestor: ["telefoneGestor"],
  oquefazer: ["oQueFazer"],
  afazer: ["oQueFazer"],
  acao: ["oQueFazer"],
  observacao: ["oQueFazer"],
  obs: ["oQueFazer"],
  status: ["status"],
  situacao: ["status"],
  fase: ["status"],
  responsavel: ["responsavel"],
  resp: ["responsavel"],
  atendente: ["responsavel"],
  dataagendada: ["dataAgendada"],
  agendado: ["dataAgendada"],
  agendadopara: ["dataAgendada"],
  tipodesolicitacao: ["tipoSolicitacao"],
  tiposolicitacao: ["tipoSolicitacao"],
  nomeclinica: ["nomeClinica"],
  clinica: ["nomeClinica"],
  prestador: ["nomeClinica"],
  telefone: ["telefoneClinica"],
  tel: ["telefoneClinica"],
  telclinica: ["telefoneClinica"],
  telefoneclinica: ["telefoneClinica"],
  email: ["emailClinica"],
  emailclinica: ["emailClinica"],
  correio: ["emailClinica"],
  valoraso: ["valorAso"],
  valor: ["valorAso"],
  preco: ["valorAso"],
  custo: ["valorAso"],
  cnpj: ["cnpjClinica"],
  cnpjclinica: ["cnpjClinica"],
  chavepix: ["chavePix"],
  pix: ["chavePix"],
  pixrealizado: ["pixRealizado"],
  pixpago: ["pixRealizado"],
  pagorealizado: ["pixRealizado"],
  enderecoclinica: ["enderecoClinica"],
  endereco: ["enderecoClinica"],
};

// Normalização de Status de ASO para os padrões oficiais do sistema
export function normalizeAsoStatus(rawStatus: string): AsoStatus {
  if (!rawStatus) return "NÃO INICIADO";
  const s = rawStatus
    .trim()
    .toUpperCase()
    .replace(/º|°|ª/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (s.includes("AGENDADO")) return "AGENDADO";
  if (s.includes("NAO INICIADO") || s.includes("PENDENTE")) return "NÃO INICIADO";
  if (s.includes("EXAME FEITO") || s.includes("CONCLUIDO") || s.includes("REALIZADO"))
    return "EXAME FEITO";
  if ((s.includes("2") && s.includes("VIA")) || s.includes("SEGUNDA VIA")) return "2 VIA ASO";
  if (s.includes("SOC") || s.includes("CADASTRANDO")) return "CADASTRANDO NO SOC";
  if (s.includes("REAGENDAMENTO") || s.includes("REAGENDAR")) return "REAGENDAMENTO";
  if (s.includes("RETORNO")) return "AG. RETORNO CLINICA";
  if (s.includes("COMPROV") || s.includes("PIX") || s.includes("PAG")) return "ENVIAR COMPROV. PAG";
  if (s.includes("CANCEL")) return "GESTOR CANCELOU";
  if (s.includes("DESIST")) return "DESISTIU DA VAGA";

  return "NÃO INICIADO";
}

// Extrai UF de strings de cidade como "Fortaleza / CE" ou "Acaraú -CE"
export function extractCityAndUf(rawCity: string): { cidade: string; uf: string } {
  if (!rawCity) return { cidade: "Desconhecida", uf: "BR" };
  const str = rawCity.trim();

  const regexUf = /(?:[\s\/\-\,]+)([A-Z]{2})$/i;
  const match = str.match(regexUf);

  if (match) {
    const uf = match[1].toUpperCase();
    const cidade = str.replace(regexUf, "").trim();
    return { cidade: cidade || str, uf };
  }

  return { cidade: str, uf: "BR" };
}

// Converte qualquer linha de objeto arbitrário para uma estrutura parcial de GrupoAvpAso
export function mapRowToAso(rowObj: Record<string, any>, index: number): Partial<GrupoAvpAso> {
  const aso: Partial<GrupoAvpAso> = {};

  for (const [key, value] of Object.entries(rowObj)) {
    if (value === undefined || value === null) continue;
    const strVal = String(value).trim();
    if (!strVal) continue;

    const normKey = normalizeHeaderName(key);
    const targetProp = HEADER_MAPPINGS[normKey]?.[0];

    if (targetProp) {
      if (targetProp === "status") {
        aso.status = normalizeAsoStatus(strVal);
      } else if (targetProp === "urgencia") {
        aso.urgencia = strVal.toUpperCase().includes("URGENT") ? "URGENTE" : "NORMAL";
      } else if (targetProp === "cidade") {
        const { cidade, uf } = extractCityAndUf(strVal);
        aso.cidade = cidade;
        aso.uf = uf;
      } else if (targetProp === "diasParado") {
        const num = parseInt(strVal, 10);
        aso.diasParado = isNaN(num) ? 0 : num;
      } else {
        (aso as any)[targetProp] = strVal;
      }
    }
  }

  // Fallbacks obrigatórios
  if (!aso.numero) {
    aso.numero = "";
  }
  if (!aso.colaborador) {
    aso.colaborador = `Colaborador Desconhecido ${aso.numero || index + 1}`;
  }
  if (!aso.status) {
    aso.status = "NÃO INICIADO";
  }
  if (!aso.urgencia) {
    aso.urgencia = "NORMAL";
  }
  if (!aso.tipoExame) {
    aso.tipoExame = "Admissional";
  }
  if (!aso.responsavel) {
    aso.responsavel = "NÃO ATRIBUÍDO";
  }

  return aso;
}

// Parser de texto CSV / TSV / Linhas coladas
export function parseSpreadsheetText(text: string): Record<string, any>[] {
  if (!text || !text.trim()) return [];

  // Tenta autodetectar separador usando PapaParse (suporta tab \t, vírgula ,, ponto-e-vírgula ;)
  const results = Papa.parse(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (results.data && results.data.length > 0) {
    return results.data as Record<string, any>[];
  }

  return [];
}

// Parser de arquivo binário Excel (.xlsx / .xls) com importação dinâmica
export async function parseExcelBuffer(buffer: ArrayBuffer): Promise<Record<string, any>[]> {
  try {
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const headers = (sheet.getRow(1).values as unknown[])
      .slice(1)
      .map((v) => String(v || "").trim());
    const rows: Record<string, unknown>[] = [];
    sheet.eachRow((row, number) => {
      if (number === 1) return;
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row.getCell(index + 1).text;
      });
      rows.push(record);
    });
    return rows;
  } catch (err) {
    console.warn("Falha ao ler planilha Excel:", err);
    throw new Error("Não foi possível ler o arquivo. Use XLSX ou CSV.");
  }
}

// Algoritmo de Inteligência de Merge: Mescla dados importados com a lista do sistema
export function mergeSpreadsheetData(
  currentList: GrupoAvpAso[],
  importedRows: Record<string, any>[]
): SheetImportResult {
  const diffLog: SheetDiffEntry[] = [];
  const errors: string[] = [];

  // Indexa a lista atual por 'numero' e por chave composta 'colaborador_cidade'
  const currentByNumber = new Map<string, GrupoAvpAso>();
  const currentByComposite = new Map<string, GrupoAvpAso>();

  currentList.forEach((item) => {
    currentByNumber.set(item.numero.trim().toLowerCase(), item);
    const compKey = `${item.colaborador.trim().toLowerCase()}|${item.cidade.trim().toLowerCase()}`;
    currentByComposite.set(compKey, item);
  });

  const mergedMap = new Map<string, GrupoAvpAso>();
  // Preenche inicialmente com cópias dos existentes
  currentList.forEach((item) => {
    mergedMap.set(item.id, { ...item });
  });

  let updatedCount = 0;
  let addedCount = 0;
  let unchangedCount = 0;

  importedRows.forEach((row, idx) => {
    try {
      const parsed = mapRowToAso(row, idx);
      const parsedNum = parsed.numero?.trim().toLowerCase();
      const compKey = `${parsed.colaborador?.trim().toLowerCase()}|${parsed.cidade?.trim().toLowerCase()}`;

      // Localiza registro existente
      let existing = parsedNum ? currentByNumber.get(parsedNum) : undefined;
      if (!existing && compKey) {
        existing = currentByComposite.get(compKey);
      }

      if (existing) {
        // Objeto em mergedMap
        const target = mergedMap.get(existing.id)!;
        let hasChanges = false;

        // Compara campos e registra diffs
        const checkFields: (keyof GrupoAvpAso)[] = [
          "status",
          "urgencia",
          "dataAgendada",
          "responsavel",
          "nomeClinica",
          "valorAso",
          "pixRealizado",
          "telefoneClinica",
          "emailClinica",
          "telefoneGestor",
        ];

        checkFields.forEach((field) => {
          const newVal = parsed[field];
          const oldVal = target[field];

          if (newVal !== undefined && newVal !== null && String(newVal).trim() !== "") {
            if (String(newVal).trim() !== String(oldVal || "").trim()) {
              diffLog.push({
                numero: target.numero,
                colaborador: target.colaborador,
                cidade: target.cidade,
                campo: field,
                valorAnterior: String(oldVal || "—"),
                valorNovo: String(newVal),
              });
              (target as any)[field] = newVal;
              hasChanges = true;
            }
          }
        });

        // Atualiza outros campos se fornecidos
        if (parsed.dataPedido && !target.dataPedido) target.dataPedido = parsed.dataPedido;
        if (parsed.cnpjClinica && !target.cnpjClinica) target.cnpjClinica = parsed.cnpjClinica;
        if (parsed.chavePix && !target.chavePix) target.chavePix = parsed.chavePix;
        if (parsed.enderecoClinica && !target.enderecoClinica)
          target.enderecoClinica = parsed.enderecoClinica;

        if (hasChanges) {
          updatedCount++;
        } else {
          unchangedCount++;
        }
      } else {
        // Novo registro!
        const newId = `avp_aso_imported_${Date.now()}_${idx}`;
        const newAso: GrupoAvpAso = {
          id: newId,
          numero: parsed.numero || String(currentList.length + addedCount + 1),
          urgencia: (parsed.urgencia as AsoUrgency) || "NORMAL",
          urgenciaRaw: (parsed.urgencia as string) || "NORMAL",
          dataPedido: parsed.dataPedido || new Date().toLocaleDateString("pt-BR"),
          dataPedidoIso: "",
          diasParado: parsed.diasParado || 0,
          cidadeRaw: `${parsed.cidade || "Não Informada"} / ${parsed.uf || "BR"}`,
          cidade: parsed.cidade || "Não Informada",
          uf: parsed.uf || "BR",
          colaborador: parsed.colaborador || `Novo Colaborador ${idx + 1}`,
          tipoExame: parsed.tipoExame || "Admissional",
          telefoneGestor: parsed.telefoneGestor || "",
          oQueFazer: parsed.oQueFazer || "",
          status: (parsed.status as AsoStatus) || "NÃO INICIADO",
          responsavel: parsed.responsavel || "NÃO ATRIBUÍDO",
          dataAgendada: parsed.dataAgendada || "",
          dataAgendadaIso: "",
          tipoSolicitacao: parsed.tipoSolicitacao || "Admissional",
          nomeClinica: parsed.nomeClinica || "",
          telefoneClinica: parsed.telefoneClinica || "",
          emailClinica: parsed.emailClinica || "",
          valorAso: parsed.valorAso || "",
          cnpjClinica: parsed.cnpjClinica || "",
          chavePix: parsed.chavePix || "",
          pixRealizado: parsed.pixRealizado || "NÃO",
          enderecoClinica: parsed.enderecoClinica || "",
        };

        mergedMap.set(newId, newAso);
        addedCount++;

        diffLog.push({
          numero: newAso.numero,
          colaborador: newAso.colaborador,
          cidade: newAso.cidade,
          campo: "NOVO REGISTRO",
          valorAnterior: "—",
          valorNovo: `Status: ${newAso.status} | Resp: ${newAso.responsavel}`,
        });
      }
    } catch (err: any) {
      errors.push(`Linha ${idx + 1}: ${err?.message || "Erro de conversão"}`);
    }
  });

  return {
    success: errors.length === 0 || addedCount > 0 || updatedCount > 0,
    totalParsed: importedRows.length,
    updatedCount,
    addedCount,
    unchangedCount,
    mergedAsos: Array.from(mergedMap.values()),
    diffLog,
    errors,
  };
}

// Converte URL do Google Drive / Google Sheets para o formato direto de exportação CSV
export function formatGoogleSheetsCsvUrl(rawUrl: string): { csvUrl: string; error?: string } {
  if (!rawUrl || !rawUrl.trim()) {
    return { csvUrl: "", error: "URL da planilha não fornecida." };
  }

  const url = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { csvUrl: "", error: "URL inválida." };
  }
  if (
    parsed.protocol !== "https:" ||
    !["docs.google.com", "drive.google.com"].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.port
  ) {
    return { csvUrl: "", error: "Use um link HTTPS do Google Planilhas ou Drive." };
  }

  // Caso 1: Link direto de CSV ou publicado
  if (url.includes("output=csv") || url.includes("format=csv")) {
    return { csvUrl: url };
  }

  // Caso 2: Google Sheets padrão docs.google.com/spreadsheets/d/{ID}/edit...
  const sheetsRegex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  const match = url.match(sheetsRegex);

  if (match && match[1]) {
    const spreadsheetId = match[1];
    // Verifica se possui gid (especificação de aba)
    const gidMatch = url.match(/gid=([0-9]+)/);
    const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : "";
    return {
      csvUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gidParam}`,
    };
  }

  // Caso 3: Google Drive file link: drive.google.com/file/d/{ID}/view...
  const driveRegex = /\/file\/d\/([a-zA-Z0-9-_]+)/;
  const driveMatch = url.match(driveRegex);
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1];
    return {
      csvUrl: `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`,
    };
  }

  return {
    csvUrl: "",
    error:
      "Formato de URL do Google Sheets não reconhecido. Use o link compartilhável da planilha do Google.",
  };
}
