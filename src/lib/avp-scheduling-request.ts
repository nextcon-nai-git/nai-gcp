export const AVP_SCHEDULING_WHATSAPP = "5541987168938";

export const AVP_REQUEST_FIELDS = [
  {
    key: "fullName",
    label: "Nome completo do colaborador",
    type: "text",
    placeholder: "Nome completo",
  },
  { key: "birthDate", label: "Data de nascimento", type: "date", placeholder: "" },
  { key: "cpf", label: "CPF", type: "text", placeholder: "000.000.000-00" },
  { key: "rg", label: "RG", type: "text", placeholder: "Número do documento" },
  {
    key: "phone",
    label: "Telefone / WhatsApp do colaborador",
    type: "tel",
    placeholder: "(00) 00000-0000",
  },
  {
    key: "email",
    label: "E-mail do colaborador",
    type: "email",
    placeholder: "colaborador@email.com",
  },
  { key: "admissionDate", label: "Data prevista de admissão", type: "date", placeholder: "" },
  { key: "role", label: "Cargo / função", type: "text", placeholder: "Cargo" },
  {
    key: "unitName",
    label: "Unidade AVP (Cidade/UF)",
    type: "text",
    placeholder: "Unidade, cidade e UF",
  },
  {
    key: "cnpj",
    label: "CNPJ da unidade empregadora",
    type: "text",
    placeholder: "00.000.000/0000-00",
  },
] as const;

export type AvpSchedulingRequest = Record<(typeof AVP_REQUEST_FIELDS)[number]["key"], string>;
export function isAvpSchedulingRequestComplete(request: AvpSchedulingRequest): boolean {
  return AVP_REQUEST_FIELDS.every(({ key }) => request[key].trim().length > 0);
}

export function buildAvpSchedulingMessage(request: AvpSchedulingRequest): string {
  return [
    "Olá, equipe Nextcon Saúde!",
    "Solicitação de ASO admissional — Grupo AVP",
    "",
    ...AVP_REQUEST_FIELDS.map(({ key, label, type }) => {
      const raw = request[key].trim();
      const value = type === "date" ? raw.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1") : raw;
      return label + ": " + value;
    }),
    "",
    "Por favor, confirmem o recebimento e orientem sobre o agendamento.",
  ].join("\n");
}

export function buildAvpSchedulingWhatsAppUrl(message: string): string {
  return "https://wa.me/" + AVP_SCHEDULING_WHATSAPP + "?text=" + encodeURIComponent(message);
}
