/** Contatos publicados nos sites das próprias clínicas; preço e credenciamento a confirmar. */
export interface VerifiedAvpClinic {
  id: string;
  cidade: string;
  uf: string;
  nome: string;
  telefone: string;
  whatsapp: string;
  email: string;
  endereco: string;
  sourceUrl: string;
  verifiedAt: string;
}
export const VERIFIED_AVP_CLINICS: VerifiedAvpClinic[] = [
  {
    id: "verified_solvit_imperatriz",
    cidade: "Imperatriz",
    uf: "MA",
    nome: "Clínica Solvit",
    telefone: "(99) 99196-3743",
    whatsapp: "5599991963743",
    email: "gerencia@clinicasolvit.com.br",
    endereco: "Rua Pernambuco, 84A, Juçara",
    sourceUrl: "https://www.clinicasolvit.com.br/",
    verifiedAt: "2026-10-04",
  },
  {
    id: "verified_provir_imperatriz",
    cidade: "Imperatriz",
    uf: "MA",
    nome: "Clínica Provir",
    telefone: "(99) 3525-3934",
    whatsapp: "5599988186668",
    email: "atendimento@clinicaprovir.com",
    endereco: "Rua Sergipe, 172, Três Poderes",
    sourceUrl: "https://clinicaprovir.com/",
    verifiedAt: "2026-10-04",
  },
  {
    id: "verified_samed_imperatriz",
    cidade: "Imperatriz",
    uf: "MA",
    nome: "SAMED — Filial Imperatriz",
    telefone: "(99) 9213-0610",
    whatsapp: "",
    email: "contato@samed.med.br",
    endereco: "Rua João Lisboa, 1165",
    sourceUrl: "https://www.samed.med.br/",
    verifiedAt: "2026-10-04",
  },
];
export function normalizeAvpCity(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ");
}
export function verifiedAvpClinicsForCity(cidade: string, uf: string) {
  return VERIFIED_AVP_CLINICS.filter(
    (clinic) =>
      normalizeAvpCity(clinic.cidade) === normalizeAvpCity(cidade) && clinic.uf === uf.toUpperCase()
  );
}
