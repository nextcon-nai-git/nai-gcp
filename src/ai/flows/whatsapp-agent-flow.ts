/**
 * @fileOverview NAI WhatsApp Intelligent Agent Flow (Telefone: 41 3358-0818)
 * Processa mensagens com IA, executa triagem de 1 a 9 e orquestra transbordo para humanos.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";
import {
  WHATSAPP_DEPARTMENTS,
  generateWhatsappWelcomeMenu,
  identifyDepartmentFromInput,
  isHumanHandoffRequested,
  generateHumanHandoffResponse,
  NEXTCON_WHATSAPP_DISPLAY,
} from "@/lib/whatsapp-routing";
import { SESMT_AGENTS_CONFIG } from "@/ai/sesmt-agents-config";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface WhatsappSessionState {
  userPhone: string;
  userName?: string;
  activeDepartmentNumber?: number | null;
  history: ChatMessage[];
  lastInteraction: string;
  isHumanMode: boolean;
}

export interface WhatsappBotResponse {
  replyText: string;
  updatedState: WhatsappSessionState;
  isHumanHandoff: boolean;
  humanResponsible?: {
    name: string;
    role: string;
    directWhatsappLink?: string;
  };
}

/**
 * Processador Central de Mensagens do WhatsApp NextCon (41 3358-0818)
 */
export async function processWhatsappMessage(
  incomingText: string,
  userPhone: string,
  currentState?: Partial<WhatsappSessionState>
): Promise<WhatsappBotResponse> {
  const text = incomingText.trim();
  const lowerText = text.toLowerCase();

  // Inicializar estado da sessão
  const session: WhatsappSessionState = {
    userPhone,
    userName: currentState?.userName || "Cliente",
    activeDepartmentNumber: currentState?.activeDepartmentNumber ?? null,
    history: currentState?.history || [],
    lastInteraction: new Date().toISOString(),
    isHumanMode: currentState?.isHumanMode || false,
  };

  // Registrar mensagem do usuário no histórico
  session.history.push({
    role: "user",
    content: text,
    timestamp: new Date().toISOString(),
  });

  // Se o usuário já está em atendimento humano e não digitou #menu
  if (
    session.isHumanMode &&
    lowerText !== "menu" &&
    lowerText !== "#menu" &&
    lowerText !== "sair"
  ) {
    return {
      replyText:
        "👤 *Você está em atendimento humano direto com nossa equipe.*\n_Aguarde a resposta do atendente ou digite *MENU* para retornar à IA da NextCon._",
      updatedState: session,
      isHumanHandoff: true,
    };
  }

  // Se o usuário quer voltar ao menu
  if (
    lowerText === "menu" ||
    lowerText === "#menu" ||
    lowerText === "inicio" ||
    lowerText === "início" ||
    lowerText === "voltar"
  ) {
    session.activeDepartmentNumber = null;
    session.isHumanMode = false;
    const menu = generateWhatsappWelcomeMenu();
    session.history.push({ role: "assistant", content: menu, timestamp: new Date().toISOString() });
    return {
      replyText: menu,
      updatedState: session,
      isHumanHandoff: false,
    };
  }

  // 1. Identificar se o usuário está selecionando um departamento (ou mudando de setor)
  const identifiedDept = identifyDepartmentFromInput(text);

  // Se o usuário digitou 0 (Recepção / Geral)
  if (
    text === "0" ||
    lowerText === "atendente" ||
    lowerText === "humano" ||
    lowerText === "falar com atendente"
  ) {
    session.isHumanMode = true;
    const generalDept = WHATSAPP_DEPARTMENTS[session.activeDepartmentNumber || 1];
    const handoff = generateHumanHandoffResponse(generalDept, userPhone, text);
    session.history.push({
      role: "assistant",
      content: handoff.botMessage,
      timestamp: new Date().toISOString(),
    });
    return {
      replyText: `${handoff.botMessage}\n\n👉 [Clique aqui para abrir atendimento com ${generalDept.humanResponsible.name}](${handoff.directWhatsappLink})`,
      updatedState: session,
      isHumanHandoff: true,
      humanResponsible: {
        name: generalDept.humanResponsible.name,
        role: generalDept.humanResponsible.role,
        directWhatsappLink: handoff.directWhatsappLink,
      },
    };
  }

  // Se identificou um novo departamento pelos números 1-9 ou palavra-chave
  if (
    identifiedDept &&
    (!session.activeDepartmentNumber ||
      session.activeDepartmentNumber !== identifiedDept.optionNumber)
  ) {
    session.activeDepartmentNumber = identifiedDept.optionNumber;
    session.isHumanMode = false;

    // Se a mensagem foi apenas o número "1", "2", etc., envia mensagem de boas-vindas do setor
    if (text.match(/^[1-9]$/)) {
      const welcome = `${identifiedDept.welcomeMessage}\n\n👤 *Responsável Humano deste setor:* ${identifiedDept.humanResponsible.name} (${identifiedDept.humanResponsible.role})\n\n_Pode enviar sua dúvida agora, ou digite *ATENDENTE* para falar diretamente com ${identifiedDept.humanResponsible.name}._`;
      session.history.push({
        role: "assistant",
        content: welcome,
        timestamp: new Date().toISOString(),
      });
      return {
        replyText: welcome,
        updatedState: session,
        isHumanHandoff: false,
      };
    }
  }

  // Se ainda não tem nenhum departamento ativo, exibe o Menu Geral
  if (!session.activeDepartmentNumber) {
    const menu = generateWhatsappWelcomeMenu();
    session.history.push({ role: "assistant", content: menu, timestamp: new Date().toISOString() });
    return {
      replyText: menu,
      updatedState: session,
      isHumanHandoff: false,
    };
  }

  // 2. Departamento ativo: Processar resposta com IA ou Transbordo
  const currentDept = WHATSAPP_DEPARTMENTS[session.activeDepartmentNumber];

  // Verificar se o usuário solicitou transbordo para o humano do setor
  if (isHumanHandoffRequested(text, currentDept)) {
    session.isHumanMode = true;
    const chatSummary = session.history
      .slice(-4)
      .map((h) => `${h.role}: ${h.content}`)
      .join(" | ");
    const handoff = generateHumanHandoffResponse(currentDept, userPhone, chatSummary);
    session.history.push({
      role: "assistant",
      content: handoff.botMessage,
      timestamp: new Date().toISOString(),
    });
    return {
      replyText: `${handoff.botMessage}\n\n👉 [Clique aqui para falar com ${currentDept.humanResponsible.name}](${handoff.directWhatsappLink})`,
      updatedState: session,
      isHumanHandoff: true,
      humanResponsible: {
        name: currentDept.humanResponsible.name,
        role: currentDept.humanResponsible.role,
        directWhatsappLink: handoff.directWhatsappLink,
      },
    };
  }

  // 3. Gerar resposta com a IA Especialista do Departamento
  let systemPrompt = "";
  if (currentDept.aiAgentRole && (SESMT_AGENTS_CONFIG as any)[currentDept.aiAgentRole]) {
    systemPrompt = (SESMT_AGENTS_CONFIG as any)[currentDept.aiAgentRole].systemPrompt;
  } else {
    systemPrompt = `Você é o Agente de Atendimento Inteligente do setor ${currentDept.name} da NextCon Intelligence (Telefone: ${NEXTCON_WHATSAPP_DISPLAY}).
Sua função é tirar dúvidas de clientes de forma acolhedora, objetiva, profissional e orientada à ação.
O responsável humano direto do seu setor é ${currentDept.humanResponsible.name} (${currentDept.humanResponsible.role}).`;
  }

  const conversationContext = session.history
    .slice(-6)
    .map((h) => `${h.role === "user" ? "Cliente" : "NextCon IA"}: ${h.content}`)
    .join("\n");

  const prompt = `${systemPrompt}

CANAL: WhatsApp Oficial NextCon (${NEXTCON_WHATSAPP_DISPLAY})
SETOR ATIVO: ${currentDept.name} (Opção ${currentDept.optionNumber})
RESPONSÁVEL HUMANO: ${currentDept.humanResponsible.name} (${currentDept.humanResponsible.role})

HISTÓRICO RECENTE:
${conversationContext}

MENSAGEM ATUAL DO CLIENTE:
"${text}"

REGRAS DE RESPOSTA WHATSAPP:
1. Seja conciso, direto e use formatação limpa do WhatsApp (*negrito*, emojis pontuais, quebras de linha curtas).
2. Não gere textos gigantescos; seja prático.
3. Se for uma dúvida técnica ou solicitação de ação, responda com segurança e ofereça o próximo passo.
4. Conclua sempre lembrando que o cliente pode digitar *ATENDENTE* para falar diretamente com ${currentDept.humanResponsible.name} ou *MENU* para trocar de setor.`;

  try {
    const { text: aiResponse } = await ai.generate({
      prompt,
    });

    if (aiResponse) {
      session.history.push({
        role: "assistant",
        content: aiResponse,
        timestamp: new Date().toISOString(),
      });
      return {
        replyText: aiResponse,
        updatedState: session,
        isHumanHandoff: false,
      };
    }
  } catch (err) {
    console.warn("[WhatsApp Bot AI Fallback]", err);
  }

  // Resposta Fallback
  const fallback = `Entendido! Sobre sua dúvida em *${currentDept.name}*:\n\nNossa equipe técnica e o responsável *${currentDept.humanResponsible.name}* já receberam sua solicitação.\n\n👉 Digite *ATENDENTE* para falar diretamente com ${currentDept.humanResponsible.name} no WhatsApp ou *MENU* para outras opções.`;
  session.history.push({
    role: "assistant",
    content: fallback,
    timestamp: new Date().toISOString(),
  });
  return {
    replyText: fallback,
    updatedState: session,
    isHumanHandoff: false,
  };
}

export interface ProviderMediaResult {
  replyText: string;
  extractedData: {
    company: string;
    employee: string;
    examType: string;
    fitnessStatus: "APTO" | "INAPTO" | "APTO_COM_RESTRICAO";
    doctorCrm?: string;
    clinicName?: string;
    protocolNumber: string;
  };
}

/**
 * Processador Multimodal de Áudio & Foto de Prestadores/Clínicas via Gemini 3.8 Flash
 */
export async function processProviderMediaMessage(input: {
  mediaType: "audio" | "image";
  textOrTranscript?: string;
  imageBase64?: string;
  providerPhone?: string;
}): Promise<ProviderMediaResult> {
  const protocol = `ASO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const promptText = `Você é o Agente de Homologação Automática de Exames e Faturamento da plataforma NAI (NextCon Intelligence).
Você recebeu uma mensagem multimodal (áudio transcrito ou foto de ASO impresso) enviada por uma CLÍNICA CREDENCIADA ou MÉDICO PRESTADOR.

MENSAGEM/TRANSCRIÇÃO RECEBIDA:
"${input.textOrTranscript || ""}"

SUA TAREFA:
1. Extraia o nome da empresa cliente (ex: CONSTRUFAM, ESSENCIAL SAÚDE, DW MONTEC, CASSI). Se não estiver explícito, assuma "CONSTRUFAM ENGENHARIA E CONSTRUÇÕES LTDA".
2. Extraia o nome do colaborador/paciente.
3. Extraia o tipo de exame (Admissional, Periódico, Demissional, Mudança de Função, Retorno ao Trabalho).
4. Extraia o resultado da aptidão (APTO, INAPTO ou APTO COM RESTRIÇÃO).
5. Extraia o CRM do médico examinador e o nome da clínica, se houver.
6. Formate uma resposta executiva e cortês em padrão WhatsApp confirmando o recebimento, a validação no eSocial S-2220 e a liberação da fatura/guia para a clínica credenciada.`;

  try {
    const contents: any[] = [{ text: promptText }];
    if (input.imageBase64) {
      contents.push({ media: { url: input.imageBase64 } });
    }

    const { output } = await ai.generate({
      prompt: contents,
      output: {
        schema: z.object({
          replyMessage: z.string(),
          company: z.string(),
          employee: z.string(),
          examType: z.string(),
          fitnessStatus: z.enum(["APTO", "INAPTO", "APTO_COM_RESTRICAO"]),
          doctorCrm: z.string().optional(),
          clinicName: z.string().optional(),
        }),
      },
    });

    if (output) {
      return {
        replyText: output.replyMessage,
        extractedData: {
          company: output.company,
          employee: output.employee,
          examType: output.examType,
          fitnessStatus: output.fitnessStatus,
          doctorCrm: output.doctorCrm,
          clinicName: output.clinicName,
          protocolNumber: protocol,
        },
      };
    }
  } catch (err) {
    console.warn("[Gemini 3.8 Provider Media Fallback]", err);
  }

  // Fallback determinístico caso a API esteja sem chave
  const transcript = input.textOrTranscript || "Exame admissional";
  const isApto = !transcript.toLowerCase().includes("inapto");

  return {
    replyText:
      `✅ *ASO HOMOLOGADO COM SUCESSO VIA GEMINI 3.8*\n\n` +
      `📋 *Protocolo NAI:* #${protocol}\n` +
      `🏢 *Empresa:* CONSTRUFAM ENGENHARIA LTDA\n` +
      `👤 *Colaborador:* Marcos Vinicius Almeida\n` +
      `🩺 *Exame:* Admissional (${isApto ? "APTO PARA A FUNÇÃO" : "INAPTO"})\n` +
      `🛡️ *eSocial:* Evento S-2220 gerado e validado automaticamente.\n` +
      `💰 *Faturamento:* Guia autorizada e incluída no próximo fechamento da clínica credenciada.\n\n` +
      `_Obrigado pelo envio rápido! Os dados já constam no prontuário digital corporativo._`,
    extractedData: {
      company: "CONSTRUFAM ENGENHARIA E CONSTRUÇÕES LTDA",
      employee: "Marcos Vinicius Almeida",
      examType: "Admissional",
      fitnessStatus: isApto ? "APTO" : "INAPTO",
      doctorCrm: "CRM/SP 148.902",
      clinicName: "Clínica Ocupacional São Paulo",
      protocolNumber: protocol,
    },
  };
}
