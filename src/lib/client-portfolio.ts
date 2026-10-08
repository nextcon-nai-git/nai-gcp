export const APPROVED_PORTFOLIO = [
  { id: "cocel", name: "COCEL", records: ["75805895000130"] },
  {
    id: "britania",
    name: "Britânia",
    records: ["CLI_BRITANIA", "BRITANIA_JOINVILLE", "76492701000742"],
  },
  { id: "brde", name: "BRDE", records: ["92816560000137", "CLI_BRDE"] },
  { id: "cassi", name: "CASSI", records: ["33719485002170", "33719485000127"] },
  {
    id: "timenow",
    name: "Timenow",
    records: ["TIME_NOW", "01208413000129", "48865462000106", "CLI_TIMENOW"],
  },
  { id: "gran-para", name: "Gran-Pará", records: ["13419654000104"] },
  { id: "noxi", name: "Noxi Química", records: ["NOXI_QUIMICA", "52793197000167"] },
  { id: "construfam", name: "Construfam", records: ["81707465000189"] },
  { id: "cetesb", name: "CETESB", records: ["CETESB_080680"] },
  { id: "aneel", name: "ANEEL", records: ["ANEEL_02270669"] },
  { id: "avp", name: "Grupo AVP", records: ["GRUPO_AVP"] },
] as const;
export const SANTANDER_RECORD = "90400888000142";
export function portfolioGroup(recordId: string) {
  return APPROVED_PORTFOLIO.find((group) => group.records.some((id) => id === recordId));
}
export function activeClientCount(
  clients: { id: string; active: boolean | null; portfolioClientId?: string | null }[]
) {
  return new Set(clients.filter((c) => c.active === true).map((c) => c.portfolioClientId || c.id))
    .size;
}
