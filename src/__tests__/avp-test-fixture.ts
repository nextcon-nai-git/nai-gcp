import { AVP_CITY_COORDINATES } from "@/lib/avp-geo-data";
import type { GrupoAvpAso } from "@/lib/grupo-avp-asos-data";
const keys = Object.keys(AVP_CITY_COORDINATES);
export const AVP_TEST_ASOS: GrupoAvpAso[] = keys.map((key, index) => {
  const separator = key.lastIndexOf("-");
  const cidade = key.slice(0, separator);
  const uf = key.slice(separator + 1);
  return {
    id: `test-${index}`,
    numero: String(index),
    cidade,
    uf,
    cidadeRaw: `${cidade} / ${uf}`,
    colaborador: `Colaborador fictício ${index}`,
    urgencia: cidade === "Alfenas" ? "URGENTE" : "NORMAL",
    urgenciaRaw: "",
    dataPedido: "",
    dataPedidoIso: "",
    diasParado: 0,
    tipoExame: "Admissional",
    telefoneGestor: "",
    oQueFazer: "",
    status: "NÃO INICIADO",
    responsavel: "",
    dataAgendada: "",
    dataAgendadaIso: "",
    tipoSolicitacao: "",
    nomeClinica: "",
    telefoneClinica: "",
    emailClinica: "",
    valorAso: "",
    cnpjClinica: "",
    chavePix: "",
    pixRealizado: "",
    enderecoClinica: "",
  };
});
const fortaleza = AVP_TEST_ASOS.find((item) => item.cidade === "Fortaleza" && item.uf === "CE")!;
AVP_TEST_ASOS.push(
  ...Array.from({ length: 17 }, (_, index) => ({
    ...fortaleza,
    id: `fortaleza-test-${index}`,
    numero: `fortaleza-${index}`,
  }))
);
