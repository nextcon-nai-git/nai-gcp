"use server";
import { requireAiAction, CLINICAL_AI_ROLES } from "@/lib/auth/ai-action";

/**
 * @fileOverview NAI Full ASO Ingestion Engine - Gemini Multimodal Vision AI.
 * Processa ASOs digitalizados (PDFs, Imagens ou Texto/OCR) com auto-identificação
 * do cliente, cadastro automático do colaborador, interpretação dos exames e
 * geração de ações epidemiológicas de saúde ocupacional.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const AsoExamSchema = z.object({
  nomeExame: z
    .string()
    .describe(
      "Nome do exame realizado (ex: Audiometria, Hemograma, Espirometria, Eletrocardiograma, RX Tórax, Acuidade Visual)."
    ),
  dataExame: z.string().describe("Data de realização do exame (YYYY-MM-DD).").default(""),
  resultado: z.enum(["Normal", "Alterado", "Não Informado"]).default("Normal"),
  detalheAlteracao: z
    .string()
    .describe(
      "Detalhamento da alteração se houver (ex: Perda auditiva induzida por ruído, Glicemia alterada)."
    )
    .default("Sem alterações observadas."),
});

const AsoIngestionOutputSchema = z.object({
  empresaIdentificada: z
    .string()
    .describe("Razão Social ou CNPJ da empresa/cliente constante no ASO.")
    .default("Empresa Não Identificada"),
  cnpjEmpresa: z.string().describe("CNPJ da empresa contratante se presente.").default(""),
  colaborador: z.object({
    nome: z.string().describe("Nome completo do colaborador em CAIXA ALTA.").default(""),
    cpf: z.string().describe("CPF do colaborador.").default(""),
    rgOuMatricula: z.string().describe("RG ou Matrícula funcional.").default(""),
    cargoFuncao: z.string().describe("Cargo ou função exercida.").default("Não informado"),
    setorGhe: z.string().describe("Setor ou GHE (Grupo Homogêneo de Exposição).").default("Geral"),
    dataNascimento: z.string().describe("Data de nascimento (YYYY-MM-DD).").default(""),
  }),
  asoInfo: z.object({
    tipoAso: z
      .enum(["Admissional", "Periódico", "Demissional", "Retorno ao Trabalho", "Mudança de Função"])
      .default("Periódico"),
    dataEmissao: z.string().describe("Data de emissão do ASO (YYYY-MM-DD).").default(""),
    dataValidade: z
      .string()
      .describe("Data de validade recomendada para o próximo ASO (YYYY-MM-DD).")
      .default(""),
    resultadoAso: z.enum(["Apto", "Inapto", "Apto com Restrições"]).default("Apto"),
    restricoesDetalhadas: z
      .string()
      .describe("Descrição de restrições se apto com restrições.")
      .default("Nenhuma restrição."),
    medicoExaminador: z
      .string()
      .describe("Nome do Médico Examinador/Coordenador do PCMSO.")
      .default(""),
    crmMedico: z.string().describe("CRM e UF do médico.").default(""),
  }),
  examesRealizados: z
    .array(AsoExamSchema)
    .describe("Lista de exames complementares transcritos do ASO.")
    .default([]),
  acoesSaudeRecomendadas: z
    .array(z.string())
    .describe("Ações preditivas e programas de saúde recomendados pela IA para a empresa.")
    .default([]),
  resumoEpidemiologico: z
    .string()
    .describe("Síntese executiva médica do ASO para o prontuário.")
    .default("ASO processado com sucesso."),
  scoreConfiabilidade: z
    .number()
    .describe("Nível de confiabilidade da leitura da IA (0-100%).")
    .default(98),
});

import { parseAsoTextWithHeuristics } from "./aso-heuristic-parser";

export type AsoIngestionOutput = z.infer<typeof AsoIngestionOutputSchema>;

export async function processDigitalAsoIngestion(
  asoContent: string,
  fileName?: string,
  idToken?: string
): Promise<AsoIngestionOutput> {
  await requireAiAction(idToken, CLINICAL_AI_ROLES, [asoContent, fileName]);

  try {
    const result = await asoIngestionFlow({ asoContent, fileName });
    if (result && result.colaborador?.nome && result.colaborador.nome !== "Não Informado") {
      return result;
    }
    // Se o resultado estiver vazio, utiliza o motor heurístico
    return parseAsoTextWithHeuristics(asoContent, fileName);
  } catch (err) {
    console.warn("[ASO Ingestion Fallback]", err);
    return parseAsoTextWithHeuristics(asoContent, fileName);
  }
}

const asoIngestionFlow = ai.defineFlow(
  {
    name: "asoIngestionFlow",
    inputSchema: z.object({
      asoContent: z
        .string()
        .describe("Texto bruto, OCR ou Data URI (Base64 PDF/Imagem) do ASO digitalizado."),
      fileName: z.string().optional().describe("Nome opcional do arquivo original do ASO."),
    }),
    outputSchema: AsoIngestionOutputSchema,
  },
  async (input) => {
    try {
      const isDataUri = input.asoContent.startsWith("data:");

      const promptContent: any = [
        {
          text: `Você é o Coordenador Médico Epidemiológico de IA da Nextcon Intelligence (NAI).
          Sua missão é realizar a TRANSCRIÇÃO COMPLETA, CADASTRO E ANÁLISE EPIDEMIOLÓGICA do ASO (Atestado de Saúde Ocupacional) fornecido.

          INSTRUÇÕES CRÍTICAS:
          1. Extraia o Nome da Empresa/Cliente e CNPJ.
          2. Extraia os dados do Colaborador (Nome, CPF, Cargo, Setor/GHE).
          3. Extraia o Tipo do ASO, Data de Emissão, Validade, Resultado (Apto/Inapto/Restrição) e dados do Médico/CRM.
          4. Transcreva TODOS os exames complementares constantes no ASO (Audiometria, RX, Laboratorial, etc) indicando se deu Normal ou Alterado.
          5. GERE AÇÕES PRÁTICAS DE SAÚDE OCUPACIONAL para a empresa com base nos achados (Ex: "Ativar Programa de Conservação Auditiva (PCA)", "Promover Ginástica Laboral", "Acompanhamento de Hipertensão Arterial", "Encaminhamento para Ergonomia NR-17").`,
        },
      ];

      if (isDataUri) {
        promptContent.push({
          media: { url: input.asoContent },
        });
      } else {
        promptContent.push({
          text: `TEXTO DO ASO DIGITALIZADO:
          """
          ${input.asoContent}
          """`,
        });
      }

      const generatePromise = ai.generate({
        prompt: promptContent,
        output: { schema: AsoIngestionOutputSchema },
      });

      // Timeout de segurança de 2.5s para evitar bloqueio caso a API remota demore ou esteja inacessível
      const timeoutPromise = new Promise<{ output: null }>((resolve) =>
        setTimeout(() => resolve({ output: null }), 2500)
      );

      const result = await Promise.race([generatePromise, timeoutPromise]);
      const output = result?.output;

      if (output && output.colaborador && output.colaborador.nome) {
        return output;
      }
    } catch (e) {
      console.warn("[asoIngestionFlow Neural Error]", e);
    }

    // Fallback garantido pelo Motor Regulatório de Medicina do Trabalho (NR-07)
    return parseAsoTextWithHeuristics(input.asoContent, input.fileName);
  }
);
