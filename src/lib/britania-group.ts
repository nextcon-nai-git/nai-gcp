/** Presentation grouping only: legal identities and authorization scopes remain separate. */
export const BRITANIA_GROUP_NAME = "Grupo BRITANIA";
export const BRITANIA_ANCHOR = "BRITANIA_JOINVILLE";
export const BRITANIA_CNPJS = [
  "04644892000114",
  "07019308000128",
  "76492701000157",
  "76492701000742",
  "76492701001129",
  "76492701001471",
] as const;
export function isBritaniaSite(company: { id?: string; cnpj?: string }) {
  return (
    ["CLI_BRITANIA", BRITANIA_ANCHOR].includes(company.id || "") ||
    BRITANIA_CNPJS.some((cnpj) => cnpj === (company.cnpj || company.id || "").replace(/\D/g, ""))
  );
}
export const BRITANIA_TEAM = [
  {
    name: "Dr. Rodrigo Romanini",
    role: "Médico perito",
    delivery: "Revisão médico-pericial individual, cronologia e parecer fundamentado.",
  },
  {
    name: "Dr. Rafael Bruzamolin",
    role: "Médico perito",
    delivery: "Coordenação da análise médico-pericial e revisão cruzada das evidências.",
  },
  {
    name: "Leopold Koenig",
    role: "Contador perito",
    delivery: "Conciliação FAPWeb, benefícios, vínculos, folha e simulações documentadas por CNPJ.",
  },
  {
    name: "Henrique",
    role: "Ergonomista",
    delivery:
      "Exposição histórica, AEP/AET e intervenções por posto. Nome completo e registro a confirmar.",
  },
  {
    name: "Felipe Coneglian",
    role: "Engenheiro de Segurança do Trabalho",
    delivery: "PGR/LTCAT/PPP, medidas de engenharia e verificação de eficácia com o SESMT.",
  },
] as const;
