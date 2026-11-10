import { z } from "zod/v3";
import { isoDate, shortText, notes } from "../sst-fields";
import { privateVertexFlow } from "../private-vertex";
export const AccidentInvestigationInputSchema = z.object({
  dataAcidente: isoDate,
  setor: shortText,
  relato: notes,
  equipamento: shortText.optional(),
  codigoSituacao: shortText.optional(),
  cid10: shortText.optional(),
});
const category = z.enum([
  "trecho",
  "imediata",
  "organizacional",
  "pergunta",
  "preventiva",
  "mitigadora",
  "acao",
]);
// Ask Vertex for short, independently checkable observations. The report layout is deterministic.
const proposal = privateVertexFlow(
  "accidentInvestigationFlow",
  z.object({
    itens: z
      .array(z.object({ tipo: category, texto: z.string().trim().min(1).max(400) }))
      .min(1)
      .max(16),
  }),
  "compact"
);
export async function accidentInvestigationFlow(raw: unknown) {
  const i = AccidentInvestigationInputSchema.parse(raw);
  try {
    const r = await proposal(
      "Triagem preliminar de acidente. Escreva no máximo dez itens breves. Para trecho, copie literalmente do relato. " +
        "Imediata e organizacional são apenas hipóteses a investigar. Formule perguntas encadeadas dos cinco porquês e identifique barreiras preventivas e mitigadoras a conferir. " +
        "Use acao para uma medida concreta de apuração. Use só o que a evidência permitir. Não atribua culpa nem invente causas ou testemunhos. Relato e contexto: " +
        JSON.stringify(i)
    );
    const values = (type: z.infer<typeof category>) => [
      ...new Set(r.itens.filter((item) => item.tipo === type).map((item) => item.texto)),
    ];
    return {
      estado: "Investigação preliminar para validação em campo",
      assistenciaIa: "Hipóteses e plano gerados para revisão.",
      relatoOriginal: i.relato,
      fatosRelatados: values("trecho")
        .filter((trecho) => i.relato.includes(trecho))
        .map((trechoLiteral) => ({ fato: trechoLiteral, trechoLiteral })),
      hipotesesImediatas: values("imediata"),
      hipotesesOrganizacionais: values("organizacional"),
      cincoPorques: values("pergunta")
        .slice(0, 5)
        .map((pergunta) => ({
          pergunta,
          respostaProvisoria: null,
          comoVerificar:
            "Registrar a fonte e confirmar a resposta antes de avançar para a próxima pergunta.",
        })),
      bowTie: {
        barreirasPreventivasAConferir: values("preventiva"),
        barreirasMitigadorasAConferir: values("mitigadora"),
      },
      revisaoInventarioPgr: "Conferir o cenário com o inventário após apurar os fatos.",
      plano5W2H: values("acao").map((oQue) => ({
        oQue,
        porQue: "Apurar o cenário relatado e verificar as hipóteses",
        onde: i.setor,
        quando: "A definir pelo responsável",
        quem: "Equipe de investigação a designar",
        como: "Documentar a execução e conferir as evidências em campo",
        custo: null,
      })),
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
