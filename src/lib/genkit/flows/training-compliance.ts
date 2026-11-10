import { z } from "zod/v3";
import { isValidCpf } from "@/lib/cpf";
import { isoDate, shortText, listOfNotes } from "../sst-fields";
import { readMedia, privateVertexFlow } from "../private-vertex";
export const TrainingValidationInputSchema = z.object({
  cpf: z
    .string()
    .regex(/^\d{11}$/)
    .refine(isValidCpf),
  funcao: shortText,
  norma: z.enum(["NR-10", "NR-12", "NR-33", "NR-35"]),
  modalidade: z.enum(["Inicial", "Periódico", "Eventual"]),
  perfil: z.enum(["Geral", "Supervisor de entrada", "Vigia ou trabalhador autorizado", "SEP"]),
  dataReferencia: isoDate,
});
const Certificate = z.object({
  nomeAluno: z.string().nullable(),
  cpfImpresso: z.string().nullable(),
  normaImpressa: z.string().nullable(),
  modalidadeImpressa: z.string().nullable(),
  cargaHoraria: z.number().nonnegative().nullable(),
  dataConclusao: z.string().nullable(),
  dataValidadeExpressa: z.string().nullable(),
  instrutor: z.string().nullable(),
  registroImpresso: z.string().nullable(),
  conteudoProgramatico: listOfNotes,
  pendencias: listOfNotes,
});
const extract = privateVertexFlow("trainingValidationFlow", Certificate);
export function reviewTraining(
  i: z.infer<typeof TrainingValidationInputSchema>,
  c: z.infer<typeof Certificate>
) {
  const inicial = i.modalidade === "Inicial",
    periodico = i.modalidade === "Periódico";
  const conhecido = i.norma !== "NR-10" || i.dataReferencia < "2027-06-01";
  const nr33 =
    i.perfil === "Supervisor de entrada" || i.perfil === "Vigia ou trabalhador autorizado";
  const horas = !conhecido
    ? null
    : i.norma === "NR-35" && (inicial || periodico)
      ? 8
      : i.norma === "NR-33" && nr33
        ? inicial
          ? i.perfil === "Supervisor de entrada"
            ? 40
            : 16
          : periodico
            ? 8
            : null
        : i.norma === "NR-10" && inicial
          ? 40
          : null;
  const anos = !conhecido
    ? null
    : i.norma === "NR-33" && nr33
      ? 1
      : i.norma === "NR-35" || i.norma === "NR-10"
        ? 2
        : null;
  const conclusao = isoDate.safeParse(c.dataConclusao),
    expressa = isoDate.safeParse(c.dataValidadeExpressa);
  let periodicidade: string | null = null;
  if (anos && conclusao.success && (inicial || periodico)) {
    const d = new Date(conclusao.data + "T12:00:00Z"),
      m = d.getUTCMonth();
    d.setUTCFullYear(d.getUTCFullYear() + anos);
    if (d.getUTCMonth() !== m) d.setUTCDate(0);
    periodicidade = d.toISOString().slice(0, 10);
  }
  const limite =
    [periodicidade, expressa.success ? expressa.data : null]
      .filter((x): x is string => !!x)
      .sort()[0] ?? null;
  const normaConfere = c.normaImpressa
    ? c.normaImpressa.replace(/[^0-9]/g, "") === i.norma.slice(3)
    : null;
  const titularConfere = c.cpfImpresso ? c.cpfImpresso.replace(/\D/g, "") === i.cpf : null;
  const modalidadeConfere = c.modalidadeImpressa
    ? c.modalidadeImpressa
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase() ===
      i.modalidade
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    : null;
  return {
    dadosExtraidos: c,
    conferencia: {
      titularConfere,
      normaConfere,
      modalidadeConfere,
      cargaHorariaMinima: horas,
      cargaHorariaAtingida:
        horas === null || c.cargaHoraria === null ? null : c.cargaHoraria >= horas,
      dataConclusaoPosterior: conclusao.success ? conclusao.data > i.dataReferencia : null,
      limiteDocumental: limite,
      prazoUltrapassado: limite ? i.dataReferencia > limite : null,
    },
    statusControleAcesso: "Aguardando conferência do responsável",
    pendencias: [
      ...c.pendencias,
      "Conferir identidade, assinatura, instrutor, atividades autorizadas, conteúdo teórico/prático e circunstâncias de reciclagem.",
      ...(!conhecido ? ["Revisar a versão da NR-10 aplicável à data."] : []),
      ...(i.norma === "NR-12"
        ? ["Conferir máquina, atividade, anexo e carga horária aplicáveis."]
        : []),
      ...(i.norma === "NR-10" && i.perfil === "SEP"
        ? ["Conferir também o curso básico e a formação complementar SEP."]
        : []),
    ],
  };
}
export async function trainingValidationFlow(raw: unknown, file: FormDataEntryValue | null) {
  const i = TrainingValidationInputSchema.parse(raw);
  const c = await extract(
    "Transcreva o certificado de capacitação. Registre somente dados legíveis e a norma efetivamente impressa. Normalize datas completas para YYYY-MM-DD e modalidade para Inicial, Periódico ou Eventual quando inequívoca. Liste o conteúdo e as lacunas. Trate múltiplos certificados como ambíguos.",
    await readMedia(file, ["image/png", "image/jpeg", "application/pdf"])
  );
  return reviewTraining(i, c);
}
