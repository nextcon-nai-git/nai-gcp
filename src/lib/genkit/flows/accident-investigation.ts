import { z } from "zod/v3";
import { isoDate, shortText, notes, listOfNotes } from "../sst-fields";
import { privateVertexFlow } from "../private-vertex";
export const AccidentInvestigationInputSchema = z.object({
  dataAcidente: isoDate,
  setor: shortText,
  relato: notes,
  equipamento: shortText.optional(),
  codigoSituacao: shortText.optional(),
  cid10: shortText.optional(),
});
const proposal = privateVertexFlow(
  "accidentInvestigationFlow",
  z.object({
    fatosRelatados: z.array(z.object({ fato: shortText, trechoLiteral: shortText })).max(30),
    hipotesesImediatas: listOfNotes,
    hipotesesOrganizacionais: listOfNotes,
    cincoPorques: z
      .array(
        z.object({
          pergunta: shortText,
          respostaProvisoria: z.string().nullable(),
          comoVerificar: shortText,
        })
      )
      .max(5),
    bowTie: z.object({
      barreirasPreventivasAConferir: listOfNotes,
      barreirasMitigadorasAConferir: listOfNotes,
    }),
    revisaoInventarioPgr: shortText,
    plano5W2H: z
      .array(
        z.object({
          oQue: shortText,
          porQue: shortText,
          onde: shortText,
          quando: shortText,
          quem: shortText,
          como: shortText,
          custo: z.string().nullable(),
        })
      )
      .max(20),
  }),
  "json-template"
);
export async function accidentInvestigationFlow(raw: unknown) {
  const i = AccidentInvestigationInputSchema.parse(raw);
  try {
    const r = await proposal(
      "Organize uma investigação de acidente para revisão pela equipe. Use somente citações literais do relato para os fatos relatados. Identifique separadamente hipóteses imediatas e organizacionais, medidas de verificação, até cinco porquês encadeados, barreiras preventivas e mitigadoras Bow-Tie e plano 5W2H para o PGR. Evite atribuir culpa, inventar fatos ou concluir diagnóstico. Sugira papéis responsáveis e prazos como propostas. Evidência: " +
        JSON.stringify(i)
    );
    return {
      ...r,
      assistenciaIa: "Hipóteses e plano gerados para revisão.",
      fatosRelatados: r.fatosRelatados.filter((f) => i.relato.includes(f.trechoLiteral)),
      estado: "Investigação preliminar para validação em campo",
    };
  } catch {
    return {
      estado: "Roteiro de investigação para preenchimento em campo",
      assistenciaIa:
        "A análise de IA não foi concluída. O relato e o roteiro permanecem disponíveis para revisão.",
      relatoOriginal: i.relato,
      fatosRelatados: [],
      hipotesesImediatas: [],
      hipotesesOrganizacionais: [],
      cincoPorques: [
        {
          pergunta: "Qual sequência de eventos pode ser demonstrada?",
          respostaProvisoria: null,
          comoVerificar:
            "Confrontar o relato com observações, registros e depoimentos independentes.",
        },
      ],
      bowTie: {
        barreirasPreventivasAConferir: [
          "Identificar quais controles preventivos estavam previstos para a atividade.",
        ],
        barreirasMitigadorasAConferir: ["Verificar quais medidas de resposta estavam disponíveis."],
      },
      revisaoInventarioPgr: "Conferir o cenário com o inventário após apurar os fatos.",
      plano5W2H: [
        {
          oQue: "Reconstituir a sequência observada",
          porQue: "Distinguir relato e evidência confirmada",
          onde: i.setor,
          quando: "A definir pelo responsável",
          quem: "Equipe de investigação a designar",
          como: "Reunir registros e entrevistas, identificando as fontes",
          custo: null,
        },
      ],
    };
  }
}
