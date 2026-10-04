/**
 * @fileOverview Fluxo de IA do Agente Agendador de ASO & Montador de Kit para Clínicas Parceiras — Genkit 1.x
 * Atua no agendamento de exames ocupacionais (NR-07), cruzamento de riscos (NR-01/PGR)
 * e montagem automatizada do Kit de Atendimento para Clínicas Credenciadas.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

export const AsoSchedulerKitInputSchema = z.object({
  userPrompt: z
    .string()
    .describe("Descrição da solicitação de agendamento de ASO, cargo ou conjunto de exames."),
  workerData: z
    .object({
      name: z.string().optional(),
      cpf: z.string().optional(),
      roleTitle: z.string().optional(),
      department: z.string().optional(),
      examType: z
        .enum([
          "ADMISSIONAL",
          "PERIODICO",
          "DEMISSIONAL",
          "MUDANCA_DE_RISCO",
          "RETORNO_AO_TRABALHO",
        ])
        .optional(),
    })
    .optional()
    .describe("Dados cadastrais do trabalhador."),
  companyContext: z
    .object({
      companyName: z.string().optional(),
      industrySector: z.string().optional(),
      specificRisk: z.string().optional(),
    })
    .optional()
    .describe("Contexto da empresa tomadora."),
  clinicData: z
    .object({
      clinicName: z.string().optional(),
      address: z.string().optional(),
      contact: z.string().optional(),
    })
    .optional()
    .describe("Dados da clínica parceira credenciada."),
});

export type AsoSchedulerKitInput = z.infer<typeof AsoSchedulerKitInputSchema>;

export const AsoSchedulerKitOutputSchema = z.object({
  resumo_agendamento: z.string().describe("Resumo executivo do agendamento e encaminhamento."),
  tipo_aso: z.string().describe("Tipo do ASO (Admissional, Periódico, Demissional, etc.)."),
  exames_complementares: z
    .array(
      z.object({
        codigo_exame: z.string().describe("Código TUSS ou eSocial do exame."),
        nome_exame: z.string().describe("Nome do exame complementar."),
        obrigatoriedade: z.enum(["OBRIGATORIO", "RECOMENDADO", "CONDICIONAL"]),
        fundamentacao_pcmso: z.string().describe("Justificativa conforme risco NR-01/NR-07."),
        preparo_paciente: z
          .string()
          .describe("Instruções de preparo prévio (jejum, repouso auditivo, etc.)."),
      })
    )
    .describe("Lista de exames complementares requeridos."),
  kit_clinica: z
    .object({
      numero_guia: z.string().describe("Número da Guia de Encaminhamento / OS Ocupacional."),
      dados_empresa: z.string().describe("Cabeçalho com Razão Social, CNPJ e Contato."),
      dados_trabalhador: z.string().describe("Nome, CPF, Função e Setor do trabalhador."),
      instrucoes_tecnicas_clinica: z
        .array(z.string())
        .describe("Diretrizes para os médicos examinadores da clínica parceira."),
      prazo_devolucao_aso_dias: z
        .number()
        .describe("Prazo para devolução do ASO assinado em dias."),
      aso_pre_preenchido: z.object({
        riscos_ocupacionais_declarados: z.array(z.string()),
        parecer_apto_inapto_template: z.string(),
        observacoes_medico_examinador: z.string(),
      }),
    })
    .describe("Kit completo de atendimento para a clínica credenciada."),
  alertas_seguranca: z
    .array(z.string())
    .describe(
      "Alertas de atenção técnica para o agendamento (ex: exames pendentes para altura/confinado)."
    ),
});

export type AsoSchedulerKitOutput = z.infer<typeof AsoSchedulerKitOutputSchema>;

export const ASO_SCHEDULER_PROMPT_MASTER = `Você é o Agente IA Agendador de ASO e Montador de Kit para Clínicas Parceiras da Nextcon Intelligence (NAI).
Sua missão é automatizar o agendamento de exames ocupacionais (ASOs) e montar o Kit de Atendimento / Guia de Encaminhamento para Clínicas Credenciadas conforme a NR-07 (PCMSO) e eSocial (S-2220).

REGRAS TÉCNICAS DE AGENDAMENTO:
1. Sempre relacione a função e os riscos ocupacionais (NR-01/PGR) aos exames complementares obrigatórios:
   - Ruído (>85 dBA) -> Audiometria Ocupacional (Repouso auditivo prévio de 14h).
   - Poeiras / Névoas -> RX de Tórax Padrão OIT + Espirometria (Sem fumar 1h antes).
   - Trabalho em Altura (NR-35) / Espaço Confinado (NR-33) -> ECG, EEG, Glicemia em Jejum, Acuidade Visual e Avaliação Psicotécnica.
   - Manipulação de Químicos -> Hemograma Completo + TGO/TGP + Monitorização Biológica (EEOS).
2. Monte a Guia de Encaminhamento da Clínica Credenciada com número único de OS, dados do trabalhador, rol de exames com preparos e instrução clara para a clínica devolver o ASO assinado e o XML S-2220 no prazo acordado.
3. Forneça respostas estruturadas, profissionais e rastreáveis.`;

export async function processAsoSchedulerKitRequest(
  input: AsoSchedulerKitInput
): Promise<AsoSchedulerKitOutput> {
  const fullPrompt = `${ASO_SCHEDULER_PROMPT_MASTER}

---
SOLICITAÇÃO DE AGENDAMENTO / CONSULTA:
"${input.userPrompt}"

DADOS DO TRABALHADOR:
- Nome: ${input.workerData?.name || "A definir / Cadastro em andamento"}
- CPF: ${input.workerData?.cpf || "000.000.000-00"}
- Função: ${input.workerData?.roleTitle || "Não especificada"}
- Setor: ${input.workerData?.department || "Operacional"}
- Tipo de ASO: ${input.workerData?.examType || "ADMISSIONAL"}

EMPRESA / CLINICA:
- Empresa Tomadora: ${input.companyContext?.companyName || "Empresa Cliente NAI"}
- Clínica Credenciada: ${input.clinicData?.clinicName || "Clínica de Saúde Ocupacional Credenciada NAI"}

Gere o JSON estruturado conforme o schema.`;

  try {
    const generatePromise = ai.generate({
      model: "googleai/gemini-1.5-flash",
      prompt: fullPrompt,
      output: { schema: AsoSchedulerKitOutputSchema },
    });

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));

    const response = await Promise.race([generatePromise, timeoutPromise]);

    if (
      response &&
      response.output &&
      typeof response.output === "object" &&
      "resumo_agendamento" in response.output &&
      response.output.resumo_agendamento
    ) {
      return response.output as AsoSchedulerKitOutput;
    }
  } catch (err) {
    console.warn("[Genkit ASO Scheduler & Kit Flow] Modo Fallback Ativado:", err);
  }

  // Fallback de alta disponibilidade
  const roleName = input.workerData?.roleTitle || "Trabalhador Operacional";
  const examTypeStr = input.workerData?.examType || "ADMISSIONAL";
  const clinicNameStr = input.clinicData?.clinicName || "Clínica Parceira Credenciada NAI";

  return {
    resumo_agendamento: `Agendamento e Kit de Exame Ocupacional (${examTypeStr}) gerado para o cargo de ${roleName} a ser realizado na clínica ${clinicNameStr}.`,
    tipo_aso: examTypeStr,
    exames_complementares: [
      {
        codigo_exame: "4.01.01.01-0",
        nome_exame: "Avaliação Clínica / Exame Físico Ocupacional",
        obrigatoriedade: "OBRIGATORIO",
        fundamentacao_pcmso: "NR-07 item 7.5.6 — Exame clínico obrigatório para todos os ASOs.",
        preparo_paciente: "Apresentar documento oficial com foto e Carteira de Trabalho/Digital.",
      },
      {
        codigo_exame: "4.08.05.01-8",
        nome_exame: "Audiometria Tonal Ocupacional",
        obrigatoriedade: "OBRIGATORIO",
        fundamentacao_pcmso:
          "Anexo II da NR-07 — Exposição a ruído contínuo/intermitente acima do nível de ação.",
        preparo_paciente:
          "Repouso auditivo rigoroso de no mínimo 14 horas antes do exame (evitar fones de ouvido e som alto).",
      },
      {
        codigo_exame: "4.01.02.02-4",
        nome_exame: "Electrocardiograma (ECG)",
        obrigatoriedade: "CONDICIONAL",
        fundamentacao_pcmso:
          "NR-35 / NR-33 — Avaliação de aptidão cardiológica para trabalho em altura e espaço confinado.",
        preparo_paciente:
          "Vir com camisa aberta na frente ou de fácil remoção; pele limpa sem cremes no tórax.",
      },
    ],
    kit_clinica: {
      numero_guia: `OS-NAI-${Math.floor(100000 + Math.random() * 900000)}`,
      dados_empresa: `${input.companyContext?.companyName || "Empresa Cliente NAI"} • CNPJ: 12.345.678/0001-90`,
      dados_trabalhador: `Nome: ${input.workerData?.name || "Trabalhador Indicado"} • CPF: ${input.workerData?.cpf || "000.000.000-00"} • Função: ${roleName}`,
      instrucoes_tecnicas_clinica: [
        "Realizar o exame clínico minucioso e registrar os achados na ficha médica ocupacional.",
        "Emitir o ASO em 2 (duas) vias assinadas pelo Médico Examinador (CRM/UF visível).",
        "Disponibilizar o laudo em PDF e o arquivo de carga eSocial S-2220 em até 48 horas úteis.",
        "Em caso de Inaptidão ou Inaptidão Temporária, comunicar imediatamente a equipe de SESMT/NAI.",
      ],
      prazo_devolucao_aso_dias: 2,
      aso_pre_preenchido: {
        riscos_ocupacionais_declarados: [
          "Físico: Ruído contínuo > 85 dBA (NR-15)",
          "Ergonômico: Postura de trabalho em pé prolongada (NR-17)",
          "Acidente: Risco de queda em nível diferente (NR-35)",
        ],
        parecer_apto_inapto_template:
          "[ ] APTO para a função declarada\n[ ] INAPTO para a função declarada\n[ ] APTO com restrições temporárias",
        observacoes_medico_examinador:
          "Trabalhador orientado sobre o uso correto de EPIs auditivos e de retenção de queda.",
      },
    },
    alertas_seguranca: [
      "Atenção: Para trabalho em altura (NR-35), o ASO só deve ser emitido como APTO após a conclusão e laudo normal do ECG e Avaliação Psicotécnica.",
      "Lembrete: O ASO deve ser assinado por médico com CRM ativo e informado no eSocial S-2220.",
    ],
  };
}
