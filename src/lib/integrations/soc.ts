import Papa from "papaparse";
import type { AuthContext } from "@/lib/auth/auth-context";
import { forbidden } from "@/lib/auth/errors";

export type SocResource = "companies" | "employees" | "asos";
export type SocRow = Record<string, string>;
export class SocError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}
export function requireSocAccess(user: AuthContext) {
  if (!(
    user.role === "SUPER_ADMIN" ||
    (!user.tenantId && ["ADMIN", "OPERATIONS"].includes(user.role))
  ))
    throw forbidden("A central SOC é restrita à equipe interna autorizada.");
}
const definitions = {
  companies: { prefix: "COMPANIES", format: "csv", required: ["CODIGO", "RAZAOSOCIAL"] },
  employees: {
    prefix: "EMPLOYEES",
    format: "json",
    required: ["CODIGOEMPRESA", "CODIGO", "MATRICULAFUNCIONARIO"],
  },
  asos: {
    prefix: "ASOS",
    format: "json",
    required: ["CODIGOEMPRESA", "CODIGOFUNCIONARIO", "IDFICHA", "DTASO"],
  },
} as const;
const idPattern = /^\d{1,20}$/;
export function socCompanyIds() {
  const ids = (process.env.SOC_ALLOWED_COMPANY_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length || ids.length > 5 || ids.some((s) => !idPattern.test(s))) return [];
  return [...new Set(ids)];
}
export function socConfiguration() {
  const companyIds = socCompanyIds();
  const principal = process.env.SOC_PRINCIPAL_COMPANY_ID || "";
  return {
    companyIds,
    resources: Object.fromEntries(
      Object.entries(definitions).map(([resource, d]) => [
        resource,
        {
          configured: !!(
            idPattern.test(principal) &&
            companyIds.length &&
            idPattern.test(process.env[`SOC_${d.prefix}_CODE`] || "") &&
            process.env[`SOC_${d.prefix}_KEY`]
          ),
          format: d.format,
        },
      ])
    ),
    connected: null,
    writesEnabled: false,
  };
}
function invalid(message: string): never {
  throw new SocError(400, "INVALID_QUERY", message);
}
export function socQuery(
  resource: SocResource,
  input: { companyId?: string; start?: string; end?: string; employeeIds?: string }
) {
  if (resource === "companies") return {};
  const companyId = input.companyId || "";
  if (!socCompanyIds().includes(companyId))
    throw new SocError(403, "COMPANY_NOT_ALLOWED", "Empresa fora do escopo SOC autorizado.");
  if (resource === "employees")
    return { empresaTrabalho: companyId, cpf: "", parametroData: "0", dataInicio: "", dataFim: "" };
  const dates = [input.start, input.end];
  if (
    dates.some(
      (d) =>
        !d ||
        !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
        !Number.isFinite(Date.parse(d)) ||
        new Date(d).toISOString().slice(0, 10) !== d
    )
  )
    invalid("Informe datas válidas para a consulta de ASOs.");
  const start = input.start!,
    end = input.end!;
  if (end < start || Date.parse(end) - Date.parse(start) > 30 * 86400000)
    invalid("Consulte até 31 dias por vez.");
  const ids = (input.employeeIds || "").split(",");
  if (ids.length > 50 || ids.some((s) => !idPattern.test(s)))
    invalid("Informe de 1 a 50 códigos SOC de colaboradores, separados por vírgula.");
  const br = (s: string) => s.split("-").reverse().join("/");
  return {
    funcionarioInicio: "",
    funcionarioFim: "",
    pFuncionario: "1",
    funcionario: [...new Set(ids)].join(","),
    dataInicio: br(start),
    dataFim: br(end),
    pDataIncAso: "2",
    tpExame: "1,2,3,4,5,6",
  };
}
export function parseSocResponse(resource: SocResource, text: string): SocRow[] {
  const fail = () =>
    new SocError(
      502,
      "RESPONSE_CONTRACT",
      "O SOC retornou conteúdo fora do layout esperado. Confira formato, liberação e relatório; nenhum dado foi sincronizado."
    );
  let rows: unknown;
  const source = text.replace(/^\uFEFF/, "").trim();
  if (!source || source.startsWith("<")) throw fail();
  if (definitions[resource].format === "csv") {
    const parsed = Papa.parse<Record<string, string>>(source, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    });
    if (
      parsed.errors.length ||
      !definitions[resource].required.every((k) => parsed.meta.fields?.includes(k))
    )
      throw fail();
    rows = parsed.data;
  } else {
    try {
      rows = JSON.parse(source);
    } catch {
      throw fail();
    }
  }
  if (!Array.isArray(rows) || rows.length > 20000) throw fail();
  if (
    rows.some(
      (row) =>
        !row ||
        typeof row !== "object" ||
        Array.isArray(row) ||
        !definitions[resource].required.every((k) => Object.hasOwn(row, k)) ||
        Object.values(row).some((v) => v !== null && typeof v !== "string" && typeof v !== "number")
    )
  )
    throw fail();
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? "" : String(v).trim()]))
  );
}
export async function socRead(
  resource: SocResource,
  input: { companyId?: string; start?: string; end?: string; employeeIds?: string } = {},
  fetcher: typeof fetch = fetch
): Promise<SocRow[]> {
  const d = definitions[resource];
  const query = socQuery(resource, input);
  if (!socConfiguration().resources[resource].configured)
    throw new SocError(
      503,
      "CONFIGURATION_REQUIRED",
      "Configure empresa principal, empresas autorizadas e o código/chave deste Exporta Dados no servidor."
    );
  const params = {
    empresa: process.env.SOC_PRINCIPAL_COMPANY_ID!,
    codigo: process.env[`SOC_${d.prefix}_CODE`]!,
    chave: process.env[`SOC_${d.prefix}_KEY`]!,
    tipoSaida: d.format,
    ...query,
  };
  // Endpoint and query layout observed in SOC screen 733. Never accept a URL or key from the client.
  const url =
    "https://ws1.soc.com.br/WebSoc/exportadados?" +
    new URLSearchParams({ parametro: JSON.stringify(params) });
  const signal = AbortSignal.timeout(20000);
  let response: Response;
  try {
    response = await fetcher(url, {
      cache: "no-store",
      redirect: "error",
      signal,
      headers: { Accept: resource === "companies" ? "text/csv" : "application/json" },
    });
  } catch {
    throw new SocError(
      504,
      "TRANSPORT_FAILURE",
      "O SOC não confirmou a resposta. Verifique disponibilidade e conexão."
    );
  }
  if (!response.ok) {
    if ([401, 403].includes(response.status))
      throw new SocError(
        424,
        "ACCESS_DENIED",
        "O SOC recusou o acesso. Confira chave, relatório e restrições de IP."
      );
    if (response.status === 429)
      throw new SocError(
        429,
        "RATE_LIMIT",
        "Limite de consultas SOC atingido. Aguarde antes de repetir."
      );
    throw new SocError(
      502,
      "PROVIDER_HTTP",
      "O SOC retornou uma falha HTTP. A causa raiz ainda precisa ser confirmada no provedor."
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new SocError(502, "EMPTY_RESPONSE", "O SOC respondeu sem conteúdo.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 4 * 1024 * 1024) {
        await reader.cancel();
        throw new SocError(
          502,
          "RESPONSE_TOO_LARGE",
          "A consulta excedeu 4 MB. Reduza o período ou o conjunto de colaboradores."
        );
      }
      chunks.push(next.value);
    }
  } catch (e) {
    if (e instanceof SocError) throw e;
    throw new SocError(504, "TRANSPORT_FAILURE", "A leitura do SOC foi interrompida.");
  } finally {
    reader.releaseLock();
  }
  const raw = Buffer.concat(chunks);
  const encoding = /charset\s*=\s*["']?(?:iso-8859-1|windows-1252)/i.test(
    response.headers.get("content-type") || ""
  )
    ? "windows-1252"
    : "utf-8";
  const rows = parseSocResponse(resource, new TextDecoder(encoding).decode(raw));
  if (resource === "companies")
    return rows
      .filter((r) => socCompanyIds().includes(r.CODIGO))
      .map((r) => ({
        id: r.CODIGO,
        name: r.RAZAOSOCIAL,
        active: r.ATIVO,
        integrationCode: r.CODIGOCLIENTEINTEGRACAO || "",
      }));
  // A partial/mixed-company response is not a successful read. Avoid cross-company matches by employee ID alone.
  if (rows.some((r) => r.CODIGOEMPRESA !== input.companyId))
    throw new SocError(
      502,
      "SCOPE_MISMATCH",
      "O SOC retornou registros de outra empresa. Revise o escopo do Exporta Dados antes de continuar."
    );
  if (resource === "employees") {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      if (r.MATRICULAFUNCIONARIO)
        counts.set(r.MATRICULAFUNCIONARIO, (counts.get(r.MATRICULAFUNCIONARIO) || 0) + 1);
    });
    return rows.map((r) => ({
      id: r.CODIGO,
      companyId: r.CODIGOEMPRESA,
      name: r.NOME || "",
      registration: r.MATRICULAFUNCIONARIO,
      status: r.SITUACAO || "",
      unit: r.NOMEUNIDADE || "",
      role: r.NOMECARGO || "",
      review: !r.MATRICULAFUNCIONARIO
        ? "Matrícula ausente; conferir regra do vínculo"
        : (counts.get(r.MATRICULAFUNCIONARIO) || 0) > 1
          ? "Matrícula repetida; conferir vínculos"
          : "",
      rg: "Não disponível neste relatório",
    }));
  }
  const ids = new Set(input.employeeIds!.split(","));
  if (rows.some((r) => !ids.has(r.CODIGOFUNCIONARIO)))
    throw new SocError(
      502,
      "SCOPE_MISMATCH",
      "O SOC retornou um colaborador fora do filtro solicitado."
    );
  // Exclude clinical findings, CPF and exam results. Several exam rows may refer to the same ASO.
  const unique = new Map<string, SocRow>();
  rows.forEach((r) =>
    unique.set(`${r.CODIGOEMPRESA}:${r.CODIGOFUNCIONARIO}:${r.IDFICHA}`, {
      id: r.IDFICHA,
      companyId: r.CODIGOEMPRESA,
      employeeId: r.CODIGOFUNCIONARIO,
      name: r.NMTRAB || "",
      type: r.TPASO || "",
      issuedAt: r.DTASO,
      recordDate: r.DATAFICHA || "",
    })
  );
  return [...unique.values()];
}
