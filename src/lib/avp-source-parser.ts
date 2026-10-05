import { createHash } from "node:crypto";
import { mapRowToAso } from "./avp-sheet-importer";
import type { GrupoAvpAso } from "./grupo-avp-asos-data";
import { AVP_SOURCE_HEADERS } from "./avp-source-config";

const normalize = (text: string) =>
  text
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ");
export function parseAvpSourceValues(values: unknown[][]) {
  if (!Array.isArray(values) || values.length < 2 || values.length > 10001)
    throw new Error("A fonte não contém uma fila válida ou excede 10.000 linhas.");
  const headers = values[0].map((v) => String(v ?? "").trim());
  const normalizedHeaders = headers.map(normalize);
  if (
    !AVP_SOURCE_HEADERS.every(
      (header) => normalizedHeaders.filter((value) => value === normalize(header)).length === 1
    )
  )
    throw new Error(
      "A aba não contém os 22 campos únicos esperados da fila AVP. A última fila válida foi preservada."
    );
  const occurrences = new Map<string, number>();
  const rows: GrupoAvpAso[] = [];
  const warnings: string[] = [];
  for (let index = 1; index < values.length; index++) {
    const record = Object.fromEntries(
      headers
        .filter(Boolean)
        .map((header) => [header, values[index][headers.indexOf(header)] ?? ""])
    );
    const sourceValue = (field: string) =>
      String(values[index][headers.findIndex((header) => normalize(header) === field)] ?? "");
    const parsed = mapRowToAso(record, index);
    if (!parsed.colaborador?.trim()) {
      if (Object.values(record).some((v) => String(v).trim()))
        warnings.push(`Linha ${index + 1}: sem colaborador; não incluída na fila.`);
      continue;
    }
    const identity = [
      parsed.numero || "",
      parsed.colaborador,
      parsed.cidade || "",
      parsed.uf || "",
      parsed.dataPedido || "",
      parsed.tipoExame || "",
    ]
      .map(normalize)
      .join("|");
    const occurrence = occurrences.get(identity) || 0;
    occurrences.set(identity, occurrence + 1);
    if (occurrence)
      warnings.push(`Linha ${index + 1}: identidade repetida; mantida como solicitação separada.`);
    const id =
      "avp_" +
      createHash("sha256")
        .update(identity + "|" + occurrence)
        .digest("hex")
        .slice(0, 32);
    rows.push({
      id,
      numero: parsed.numero || "",
      urgencia: parsed.urgencia || "NORMAL",
      urgenciaRaw: parsed.urgencia || "NORMAL",
      dataPedido: parsed.dataPedido || "",
      dataPedidoIso: "",
      diasParado: parsed.diasParado || 0,
      cidadeRaw: sourceValue("CIDADE"),
      cidade: parsed.cidade || "Não informada",
      uf: parsed.uf || "BR",
      colaborador: parsed.colaborador,
      tipoExame: parsed.tipoExame || "",
      telefoneGestor: parsed.telefoneGestor || "",
      oQueFazer: parsed.oQueFazer || "",
      observacoes: parsed.observacoes || "",
      status: parsed.status || "NÃO INICIADO",
      statusRaw: sourceValue("STATUS"),
      responsavel: parsed.responsavel || "",
      dataAgendada: parsed.dataAgendada || "",
      dataAgendadaIso: "",
      tipoSolicitacao: parsed.tipoSolicitacao || "",
      nomeClinica: parsed.nomeClinica || "",
      telefoneClinica: parsed.telefoneClinica || "",
      emailClinica: parsed.emailClinica || "",
      valorAso: parsed.valorAso || "",
      cnpjClinica: parsed.cnpjClinica || "",
      chavePix: parsed.chavePix || "",
      pixRealizado: parsed.pixRealizado || "",
      enderecoClinica: parsed.enderecoClinica || "",
      sourceRow: index + 1,
    });
  }
  if (!rows.length)
    throw new Error(
      "Nenhuma solicitação com colaborador foi encontrada. A fila anterior foi preservada."
    );
  return { rows, warnings };
}
