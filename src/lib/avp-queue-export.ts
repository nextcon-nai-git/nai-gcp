import Papa from "papaparse";
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
          columns.map(
            ([, key]) =>
              (key === "cidadeRaw"
                ? `${aso.cidade}/${aso.uf}`
                : key === "status" && aso.status === "STATUS NÃO RECONHECIDO"
                  ? aso.statusRaw
                  : aso[key]) ?? ""
          )
        ),
      },
      { delimiter: ";", newline: "\r\n", escapeFormulae: /^\s*[=+\-@]|^[\t\r]/ }
    )
  );
}
