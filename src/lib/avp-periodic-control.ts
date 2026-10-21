import { parseBrlCents } from "./avp-costs";

export const AVP_PERIODIC_TABS = {
  campaign: "Campanha Periódicos 2026",
  providers: "Prestadores NXC 2026",
  prices: "Custos Observados AVP 2026",
} as const;
export const CAMPAIGN_HEADERS = [
  "ID",
  "Cidade",
  "UF",
  "Nome",
  "CPF",
  "Telefone celular",
  "Status",
  "Data do agendamento",
  "Horário",
  "Clínica",
  "Cidade da clínica",
  "UF da clínica",
  "Dia da cobrança do ASO",
  "Data da última cobrança",
  "Data de recebimento do ASO",
  "Alerta / próxima ação",
  "Validação",
  "Observações",
  "Tipo",
  "Unidade (empresa)",
  "Setor",
  "Cargo",
  "Dt. admissão",
  "Periodicidade (meses)",
  "E-mail",
  "Linhas na convocação",
  "Situação na base do cliente",
  "Último exame (base do cliente)",
  "Conferência",
  "Detalhe da conferência",
  "Linha de origem",
];
export const PROVIDER_HEADERS = [
  "Nome",
  "Razão Social",
  "CNPJ",
  "Cidade",
  "UF",
  "Telefone",
  "Celular",
  "E-mail",
  "Endereço",
  "Atendimento",
  "Contrato ativo informado",
  "Linha de origem",
];
export const PRICE_HEADERS = [
  "Clínica",
  "Cidade / UF",
  "Valor unitário",
  "Serviço",
  "Evidência",
  "Data de referência",
  "Outros valores",
  "Referência",
  "CNPJ",
  "Ressalva",
  "Linha de origem",
];
export const normalizeAvpText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
const taxId = (v: string) => v.replace(/\D/g, "");
const cityName = (city: string) =>
  city.trim().replace(/^Fortaleza\s+-\s+(?:ASCEC|ASSOBES|CEUDESP).*$/i, "Fortaleza");
export const periodicCityKey = (city: string, uf: string) =>
  `${normalizeAvpText(cityName(city))}|${uf.trim().toUpperCase()}`;
const text = (v: unknown) => String(v ?? "").trim();
function readRows(values: unknown[][], headers: readonly string[]) {
  if (!values.length || headers.some((h, i) => text(values[0]?.[i]) !== h))
    throw new Error("Confira os cabeçalhos da campanha, prestadores e custos AVP.");
  if (values.length > 10001) throw new Error("A fonte excede 10.000 registros por aba.");
  return values
    .slice(1)
    .filter((row) => row.some((v) => text(v) !== ""))
    .map((row) => headers.map((_, i) => text(row[i])));
}
export type PeriodicPerson = {
  id: string;
  name: string;
  city: string;
  uf: string;
  cityKey: string;
  unit: string;
  status: string;
  review: string;
  phone: string;
  email: string;
  admission: string;
  classification: "cancelled" | "review" | "listed";
  duplicateRows: number;
  sourceRows: number[];
};
export type AvpObservedPrice = {
  clinic: string;
  city: string;
  uf: string;
  cents: number | null;
  service: string;
  evidence: string;
  date: string;
  reference: string;
  cnpj: string;
  notes: string;
  clinical: boolean;
  match: "CNPJ" | "Nome e município" | "Histórico" | "Sem vínculo";
};
export type PeriodicClinic = {
  origin: "provider-list" | "price-history" | "nai";
  id: string;
  name: string;
  legalNames?: string[];
  cnpj: string;
  city: string;
  uf: string;
  cityKey: string;
  phones: string[];
  emails: string[];
  addresses: string[];
  sourceRows: number[];
  contractReported: boolean;
  contractConflict: boolean;
  prices: AvpObservedPrice[];
  naiRegistered: boolean;
  naiActive: boolean | null;
};
export type PeriodicCity = {
  key: string;
  city: string;
  uf: string;
  total: number;
  cancelled: number;
  review: number;
  listed: number;
  duplicateRows: number;
  clinicIds: string[];
  contracted: number;
  historical: number;
  minClinicalCents: number | null;
  above40: number;
  action: string;
};
export type AvpPeriodicControl = {
  checkedAt: string;
  summary: {
    sourceRows: number;
    uniquePeople: number;
    duplicates: number;
    cancelled: number;
    review: number;
    listed: number;
    cities: number;
    uncovered: number;
    providerRows: number;
    clinics: number;
    historicalClinics: number;
    naiClinics: number;
    above40: number;
  };
  people: PeriodicPerson[];
  clinics: PeriodicClinic[];
  cities: PeriodicCity[];
  unmatchedPrices: AvpObservedPrice[];
};
export type ExistingAvpProvider = {
  name?: string;
  type?: string;
  phone?: string;
  email?: string;
  address?: string;
  cnpj?: string;
  city?: string;
  state?: string;
  active?: boolean;
};

/** Source assertions remain assertions: no inferred contract, attendance or clinical clearance. */
export function buildAvpPeriodicControl(
  campaignValues: unknown[][],
  providerValues: unknown[][],
  priceValues: unknown[][],
  existingProviders: ExistingAvpProvider[] = [],
  checkedAt = new Date().toISOString()
): AvpPeriodicControl {
  const campaign = readRows(campaignValues, CAMPAIGN_HEADERS);
  const providers = readRows(providerValues, PROVIDER_HEADERS);
  const prices = readRows(priceValues, PRICE_HEADERS);
  if (!campaign.length || !providers.length || !prices.length)
    throw new Error("As fontes AVP estão incompletas.");
  const grouped = new Map<string, string[][]>();
  for (const row of campaign) {
    if (!row[0] || !row[3] || !row[1] || !/^[A-Z]{2}$/.test(row[2]))
      throw new Error("Há participante sem ID, nome, cidade ou UF válida.");
    const cpf = taxId(row[4]);
    const key = cpf.length === 11 && row[22] ? `${cpf}|${row[22]}` : `source:${row[30] || row[0]}`;
    const rows = grouped.get(key) || [];
    rows.push(row);
    grouped.set(key, rows);
  }
  const people: PeriodicPerson[] = [...grouped.values()].map((rows) => {
    const row = rows[0];
    const cancelled = rows.some((r) => normalizeAvpText(r[6]).startsWith("CANCELADO"));
    const needsReview =
      rows.length > 1 ||
      rows.some(
        (r) => taxId(r[4]).length !== 11 || !r[22] || !normalizeAvpText(r[28]).startsWith("OK ")
      );
    const classification = cancelled ? "cancelled" : needsReview ? "review" : "listed";
    return {
      id: `periodico-2026-${row[0]}`,
      name: row[3],
      city: cityName(row[1]),
      uf: row[2],
      cityKey: periodicCityKey(row[1], row[2]),
      unit: row[19],
      status: rows.length > 1 ? [...new Set(rows.map((r) => r[6]))].join(" / ") : row[6],
      review: [...new Set(rows.map((r) => r[28]).filter(Boolean))].join(" / "),
      phone: row[5],
      email: row[24],
      admission: row[22],
      classification,
      duplicateRows: rows.length - 1,
      sourceRows: rows.map((r) => Number(r[30])).filter(Number.isInteger),
    };
  });
  const clinicMap = new Map<string, PeriodicClinic>();
  for (const row of providers) {
    if (!row[0]) throw new Error("Há prestador sem nome.");
    const cnpj = taxId(row[2]),
      key = `${cnpj.length === 14 ? cnpj : normalizeAvpText(row[0])}|${periodicCityKey(row[3], row[4])}`;
    const existing = clinicMap.get(key);
    const reported = normalizeAvpText(row[10]) === "SIM";
    if (existing) {
      existing.contractConflict ||= existing.contractReported !== reported;
      existing.contractReported &&= reported;
      existing.sourceRows.push(Number(row[11]));
      existing.phones = [...new Set([...existing.phones, row[5], row[6]].filter(Boolean))];
      existing.emails = [...new Set([...existing.emails, row[7]].filter(Boolean))];
      existing.addresses = [...new Set([...existing.addresses, row[8]].filter(Boolean))];
      existing.legalNames = [...new Set([...(existing.legalNames || []), row[1]].filter(Boolean))];
    } else {
      const registered =
        cnpj.length === 14
          ? existingProviders.filter(
              (p) =>
                taxId(p.cnpj || "") === cnpj &&
                periodicCityKey(p.city || "", p.state || "") === periodicCityKey(row[3], row[4])
            )
          : [];
      clinicMap.set(key, {
        origin: "provider-list",
        id: key,
        name: row[0],
        legalNames: row[1] ? [row[1]] : [],
        cnpj: row[2],
        city: row[3],
        uf: row[4],
        cityKey: periodicCityKey(row[3], row[4]),
        phones: [...new Set([row[5], row[6]].filter(Boolean))],
        emails: row[7] ? [row[7]] : [],
        addresses: row[8] ? [row[8]] : [],
        sourceRows: [Number(row[11])],
        contractReported: reported,
        contractConflict: false,
        prices: [],
        naiRegistered: registered.length > 0,
        naiActive: registered.length ? registered.some((p) => p.active === true) : null,
      });
    }
  }
  const clinics = [...clinicMap.values()];
  const importedClinicCount = clinics.length;
  for (const provider of existingProviders) {
    if (
      !provider.name ||
      !["CLINIC", "LAB"].includes(provider.type || "") ||
      !provider.city ||
      !/^[A-Z]{2}$/.test(provider.state || "")
    )
      continue;
    const cnpj = taxId(provider.cnpj || "");
    const cityKey = periodicCityKey(provider.city, provider.state!);
    if (
      clinics.some(
        (c) =>
          c.cityKey === cityKey &&
          ((cnpj.length === 14 && taxId(c.cnpj) === cnpj) ||
            (!cnpj && normalizeAvpText(c.name) === normalizeAvpText(provider.name!)))
      )
    )
      continue;
    clinics.push({
      origin: "nai",
      id: `nai:${cnpj || normalizeAvpText(provider.name)}|${cityKey}`,
      name: provider.name,
      cnpj: provider.cnpj || "",
      city: provider.city,
      uf: provider.state!,
      cityKey,
      phones: provider.phone ? [provider.phone] : [],
      emails: provider.email ? [provider.email] : [],
      addresses: provider.address ? [provider.address] : [],
      sourceRows: [],
      contractReported: false,
      contractConflict: false,
      prices: [],
      naiRegistered: true,
      naiActive: provider.active === true,
    });
  }
  const unmatchedPrices: AvpObservedPrice[] = [];
  for (const row of prices) {
    const location = row[1].match(/^(.+)\/([A-Z]{2})$/);
    const cnpj = taxId(row[8]);
    let candidates = cnpj.length === 14 ? clinics.filter((c) => taxId(c.cnpj) === cnpj) : [];
    if (location)
      candidates = candidates.filter(
        (c) => c.cityKey === periodicCityKey(location[1], location[2])
      );
    let match: AvpObservedPrice["match"] = "CNPJ";
    if (!candidates.length && !cnpj && location) {
      candidates = clinics.filter(
        (c) =>
          normalizeAvpText(c.name) === normalizeAvpText(row[0]) &&
          c.cityKey === periodicCityKey(location[1], location[2])
      );
      match = "Nome e município";
    }
    // A clinic seen in an older source remains visible without inventing a contract.
    if (!candidates.length && location && (!cnpj || cnpj.length === 14)) {
      const cityKey = periodicCityKey(location[1], location[2]);
      const clinic: PeriodicClinic = {
        origin: "price-history",
        id: `historico:${cnpj || normalizeAvpText(row[0])}|${cityKey}`,
        name: row[0],
        cnpj: row[8],
        city: location[1],
        uf: location[2],
        cityKey,
        phones: [],
        emails: [],
        addresses: [],
        sourceRows: [],
        contractReported: false,
        contractConflict: false,
        prices: [],
        naiRegistered: false,
        naiActive: null,
      };
      clinics.push(clinic);
      candidates = [clinic];
      match = "Histórico";
    }
    if (candidates.length === 1 && candidates[0].origin === "price-history") match = "Histórico";
    const clinical =
      /^(EXAME (CLINICO|OCUPACIONAL)|ASO\b)/.test(normalizeAvpText(row[3])) &&
      !/PCD|ENQUADRAMENTO/.test(normalizeAvpText(row[3]));
    const price: AvpObservedPrice = {
      clinic: row[0],
      city: location?.[1] || "",
      uf: location?.[2] || "",
      cents: parseBrlCents(row[2]),
      service: row[3],
      evidence: row[4],
      date: row[5],
      reference: row[7],
      cnpj: row[8],
      notes: [row[9], row[6] ? `Outros valores: ${row[6]}` : ""].filter(Boolean).join(" "),
      clinical,
      match: candidates.length === 1 ? match : "Sem vínculo",
    };
    if (candidates.length === 1) candidates[0].prices.push(price);
    else unmatchedPrices.push(price);
  }
  const cityMap = new Map<string, PeriodicCity>();
  for (const person of people) {
    let city = cityMap.get(person.cityKey);
    if (!city) {
      city = {
        key: person.cityKey,
        city: person.city,
        uf: person.uf,
        total: 0,
        cancelled: 0,
        review: 0,
        listed: 0,
        duplicateRows: 0,
        clinicIds: [],
        contracted: 0,
        historical: 0,
        minClinicalCents: null,
        above40: 0,
        action: "",
      };
      cityMap.set(person.cityKey, city);
    }
    city.total++;
    city[person.classification]++;
    city.duplicateRows += person.duplicateRows;
  }
  for (const city of cityMap.values()) {
    const local = clinics.filter((c) => c.cityKey === city.key);
    city.clinicIds = local.map((c) => c.id);
    city.contracted = local.filter((c) => c.contractReported && !c.contractConflict).length;
    city.historical = local.filter((c) => c.origin === "price-history").length;
    const clinical = local.flatMap((c) => c.prices).filter((p) => p.clinical && p.cents !== null);
    city.minClinicalCents = clinical.length ? Math.min(...clinical.map((p) => p.cents!)) : null;
    city.above40 = local.filter((c) =>
      c.prices.some((p) => p.cents !== null && p.cents > 4000)
    ).length;
    city.action =
      city.contracted === 0
        ? local.length > 0
          ? "Confirmar credenciamento da rede já localizada"
          : "Credenciar clínica local"
        : city.minClinicalCents === null
          ? "Confirmar preço do periódico"
          : city.minClinicalCents > 4000
            ? "Buscar opção de ASO até R$ 40"
            : city.above40 > 0
              ? "Comparar serviços acima de R$ 40"
              : "Confirmar agenda e preço do periódico";
  }
  const cities = [...cityMap.values()].sort(
    (a, b) =>
      Number(a.contracted > 0) - Number(b.contracted > 0) ||
      b.listed + b.review - (a.listed + a.review) ||
      a.city.localeCompare(b.city, "pt-BR")
  );
  return {
    checkedAt,
    people,
    clinics,
    cities,
    unmatchedPrices,
    summary: {
      sourceRows: campaign.length,
      uniquePeople: people.length,
      duplicates: campaign.length - people.length,
      cancelled: people.filter((p) => p.classification === "cancelled").length,
      review: people.filter((p) => p.classification === "review").length,
      listed: people.filter((p) => p.classification === "listed").length,
      cities: cities.length,
      uncovered: cities.filter((c) => c.contracted === 0).length,
      providerRows: providers.length,
      clinics: importedClinicCount,
      historicalClinics: clinics.filter((c) => c.origin === "price-history").length,
      naiClinics: clinics.filter((c) => c.origin === "nai").length,
      above40: clinics.filter((c) => c.prices.some((p) => p.cents !== null && p.cents > 4000))
        .length,
    },
  };
}
