import Papa from "papaparse";
import { normalizeAsoStatus } from "./avp-sheet-importer";
import type { GrupoAvpAso } from "./grupo-avp-asos-data";

const columns: [string, keyof GrupoAvpAso][] = [
  ["Nº", "numero"],
  ["URGÊNCIA", "urgencia"],
  ["DATA DO PEDIDO", "dataPedido"],
  ["DIAS PARADO", "diasParado"],
  ["CIDADE", "cidadeRaw"],
  ["COLABORADOR", "colaborador"],
  ["EXAME", "tipoExame"],
  ["TELEFONE DO GESTOR", "telefoneGestor"],
  ["O QUE FAZER", "oQueFazer"],
  ["STATUS", "status"],
  ["RESPONSÁVEL", "responsavel"],
  ["DATA AGENDADA", "dataAgendada"],
  ["OBSERVAÇÕES", "observacoes"],
  ["TIPO DE SOLICITAÇÃO", "tipoSolicitacao"],
  ["NOME CLÍNICA", "nomeClinica"],
  ["TELEFONE", "telefoneClinica"],
  ["EMAIL", "emailClinica"],
  ["VALOR ASO", "valorAso"],
  ["CNPJ", "cnpjClinica"],
  ["CHAVE PIX", "chavePix"],
  ["PIX REALIZADO?", "pixRealizado"],
  ["ENDEREÇO CLÌNICA", "enderecoClinica"],
];

/** Excel-compatible text; imported content stays text instead of becoming formulas. */
export function buildAvpQueueCsv(asos: GrupoAvpAso[]): string {
  return (
    "\uFEFF" +
    Papa.unparse(
      {
        fields: columns.map(([label]) => label),
        data: asos.map((aso) =>
          columns.map(([, key]) => {
            if (key === "cidadeRaw") return `${aso.cidade}/${aso.uf}`;
            if (key === "status" && aso.status === "STATUS NÃO RECONHECIDO") {
              const raw = [aso.manualStatusRaw, aso.statusRaw].find(
                (value) => value && normalizeAsoStatus(value) === aso.status
              );
              return raw || aso.status;
            }
            return aso[key] ?? "";
          })
        ),
      },
      { delimiter: ";", newline: "\r\n", escapeFormulae: /^\s*[=+\-@]|^[\t\r]/ }
    )
  );
}
