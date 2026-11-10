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
  })
);
export async function accidentInvestigationFlow(raw: unknown) {
  const i = AccidentInvestigationInputSchema.parse(raw);
  const r = await proposal(
    "Organize uma investigação de acidente para revisão pela equipe. Use somente citações literais do relato para os fatos relatados. Identifique separadamente hipóteses imediatas e organizacionais, medidas de verificação, até cinco porquês encadeados, barreiras preventivas e mitigadoras Bow-Tie e plano 5W2H para o PGR. Evite atribuir culpa, inventar fatos ou concluir diagnóstico. Sugira papéis responsáveis e prazos como propostas. Evidência: " +
      JSON.stringify(i)
  );
  return {
    ...r,
    fatosRelatados: r.fatosRelatados.filter((f) => i.relato.includes(f.trechoLiteral)),
    estado: "Investigação preliminar para validação em campo",
  };
}
