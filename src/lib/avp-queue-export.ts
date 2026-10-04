import Papa from "papaparse";
import type { GrupoAvpAso } from "./grupo-avp-asos-data";

const columns: [string, keyof GrupoAvpAso][] = [
  ["Nº", "numero"],
  ["Urgência", "urgencia"],
  ["Data Pedido", "dataPedido"],
  ["Dias Parado", "diasParado"],
  ["Cidade", "cidade"],
  ["UF", "uf"],
  ["Colaborador", "colaborador"],
  ["Tipo Exame", "tipoExame"],
  ["Telefone Gestor", "telefoneGestor"],
  ["Status", "status"],
  ["Responsável", "responsavel"],
  ["Data Agendada", "dataAgendada"],
  ["Clínica", "nomeClinica"],
  ["Telefone Clínica", "telefoneClinica"],
  ["E-mail Clínica", "emailClinica"],
  ["Valor ASO", "valorAso"],
  ["CNPJ Clínica", "cnpjClinica"],
  ["Chave PIX", "chavePix"],
  ["PIX Realizado?", "pixRealizado"],
  ["Endereço Clínica", "enderecoClinica"],
  ["Observações / O Que Fazer", "oQueFazer"],
];

/** Excel-compatible text; imported content stays text instead of becoming formulas. */
export function buildAvpQueueCsv(asos: GrupoAvpAso[]): string {
  return (
    "\uFEFF" +
    Papa.unparse(
      {
        fields: columns.map(([label]) => label),
        data: asos.map((aso) => columns.map(([, key]) => aso[key] ?? "")),
      },
      { delimiter: ";", newline: "\r\n", escapeFormulae: /^\s*[=+\-@]|^[\t\r]/ }
    )
  );
}
