/** Prazos clínicos definidos pelo PCMSO; idade e grau de risco não substituem avaliação médica. */

import { logger, maskPhone } from "@/lib/logger";

export type ExamPeriodicity = "SEMESTRAL" | "ANUAL" | "BIENAL" | "PERSONALIZADA" | "PENDENTE";

export interface ClinicalPeriodicityInput {
  riskDegree?: 1 | 2 | 3 | 4;
  age?: number;
  birthDate?: string;
  hasSpecialExposure?: boolean;
  pcmsoReviewed?: boolean;
  hasPgrExposure?: boolean;
  chronicSusceptibility?: boolean;
  hyperbaricExposure?: boolean;
  physicianIntervalMonths?: number;
}

export interface ExamEvaluationInput extends ClinicalPeriodicityInput {
  id: string;
  name: string;
  employeeName: string;
  companyId: string;
  validUntil?: string;
  lastAsoDate?: string;
  riskDegree?: 1 | 2 | 3 | 4;
  employeeAge?: number;
  employeeBirthDate?: string;
  hasSpecialExposure?: boolean; // Riscos Quadro 1 da NR-07
}

export interface ExpirationAlert {
  id: string;
  title: string;
  description: string;
  type: "aso_expiration" | "pgr_expiration" | "pcmso_expiration" | "esocial_pending";
  severity: "critical" | "warning" | "info";
  employeeName?: string;
  companyId: string;
  dueDate: string;
  daysRemaining: number;
  riskDegree?: 1 | 2 | 3 | 4;
  periodicity?: ExamPeriodicity;
  regulatoryBasis?: string;
}

export interface WhatsAppDispatchResult {
  success: boolean;
  messageId: string;
  status: "DELIVERED" | "DISPATCHED_WEBHOOK" | "QUEUED" | "FAILED";
  maskedPhone: string;
  formattedMessage: string;
  timestamp: string;
  error?: string;
}

export class NotificationService {
  /**
   * Determina a periodicidade legal do exame periódico com base na NR-07 Item 7.5.8.
   */
  static determinePeriodicity(params: ClinicalPeriodicityInput): {
    periodicity: ExamPeriodicity;
    intervalMonths: number | null;
    regulatoryBasis: string;
  } {
    const pending = {
      periodicity: "PENDENTE" as const,
      intervalMonths: null,
      regulatoryBasis:
        "Periodicidade pendente de conferência do PCMSO e do médico responsável (NR-7, 7.5.8).",
    };
    if (
      !params.pcmsoReviewed ||
      params.hasPgrExposure === undefined ||
      params.chronicSusceptibility === undefined
    )
      return pending;
    const ceiling = params.hasPgrExposure || params.chronicSusceptibility ? 12 : 24;
    if (params.hyperbaricExposure && params.physicianIntervalMonths === undefined) return pending;
    const months = params.physicianIntervalMonths ?? ceiling;
    if (!Number.isInteger(months) || months <= 0 || months > ceiling) return pending;
    return {
      periodicity:
        months === 6
          ? "SEMESTRAL"
          : months === 12
            ? "ANUAL"
            : months === 24
              ? "BIENAL"
              : "PERSONALIZADA",
      intervalMonths: months,
      regulatoryBasis: params.hyperbaricExposure
        ? "Prazo registrado pelo médico no PCMSO: conferir NR-7, Anexo IV (condições hiperbáricas)."
        : params.physicianIntervalMonths !== undefined
          ? "Prazo registrado pelo médico responsável no PCMSO; NR-7, 7.5.8."
          : ceiling === 12
            ? "NR-7, 7.5.8, II, a: exame clínico anual ou intervalo menor a critério médico."
            : "NR-7, 7.5.8, II, b: exame clínico a cada dois anos, conforme enquadramento conferido no PCMSO.",
    };
  }

  /**
   * Calcula a data legal de vencimento do próximo ASO periódico a partir do último realizado.
   */
  static calculateNextAsoDueDate(lastAsoDateIso: string, params: ClinicalPeriodicityInput): string {
    const lastDate = new Date(lastAsoDateIso);
    if (isNaN(lastDate.getTime())) return "";

    const { intervalMonths } = this.determinePeriodicity(params);
    if (intervalMonths === null) return "";
    const dueDate = new Date(lastDate);
    // Calendar dates must not drift with the server's timezone or DST.
    const originalDay = dueDate.getUTCDate();
    dueDate.setUTCDate(1);
    dueDate.setUTCMonth(dueDate.getUTCMonth() + intervalMonths);
    const lastDay = new Date(
      Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth() + 1, 0)
    ).getUTCDate();
    dueDate.setUTCDate(Math.min(originalDay, lastDay));

    return dueDate.toISOString().split("T")[0];
  }

  /**
   * Avalia a lista de exames/colaboradores e gera os alertas com antecedência e severidade
   * ajustadas estritamente ao Grau de Risco (NR-07 / PCMSO).
   */
  static calculateExpirations(
    exams: ExamEvaluationInput[],
    referenceDate: Date = new Date()
  ): ExpirationAlert[] {
    const alerts: ExpirationAlert[] = [];

    for (const exam of exams) {
      const risk = exam.riskDegree ?? 2;
      const { periodicity, regulatoryBasis } = this.determinePeriodicity({
        ...exam,
        riskDegree: risk,
        age: exam.employeeAge,
        birthDate: exam.employeeBirthDate,
        hasSpecialExposure: exam.hasSpecialExposure,
      });

      // Se validUntil não foi fornecido, mas temos lastAsoDate, calcula dinamicamente
      const effectiveDueDateStr =
        exam.validUntil ||
        (exam.lastAsoDate
          ? this.calculateNextAsoDueDate(exam.lastAsoDate, {
              ...exam,
              riskDegree: risk,
              age: exam.employeeAge,
              birthDate: exam.employeeBirthDate,
              hasSpecialExposure: exam.hasSpecialExposure,
            })
          : "");

      if (!effectiveDueDateStr) continue;

      const dueDate = new Date(effectiveDueDateStr);
      if (isNaN(dueDate.getTime())) continue;

      const diffTime = dueDate.getTime() - referenceDate.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Janela de alerta: 60 dias para Grau 3/4 e Riscos Especiais, 30 dias para Grau 1/2
      const maxAnticipationDays = risk >= 3 || exam.hasSpecialExposure ? 60 : 30;

      if (daysRemaining <= maxAnticipationDays) {
        let severity: "critical" | "warning" | "info" = "info";

        if (daysRemaining <= 0) {
          severity = "critical";
        } else if (risk >= 3 || exam.hasSpecialExposure) {
          // Grau 3 e 4: maior complexidade laboratorial e de clínica médica
          if (daysRemaining <= 15) severity = "critical";
          else if (daysRemaining <= 30) severity = "warning";
        } else {
          // Grau 1 e 2
          if (daysRemaining <= 7) severity = "critical";
          else if (daysRemaining <= 15) severity = "warning";
        }

        const title =
          daysRemaining <= 0
            ? `ASO Periódico VENCIDO (${daysRemaining === 0 ? "Hoje" : `${Math.abs(daysRemaining)}d atrás`})`
            : `ASO Vence em ${daysRemaining} dias (${periodicity})`;

        const desc = `O exame "${exam.name}" de ${exam.employeeName} requer convocação. Enquadramento: ${regulatoryBasis}.`;

        alerts.push({
          id: `alert_exam_${exam.id}`,
          title,
          description: desc,
          type: "aso_expiration",
          severity,
          employeeName: exam.employeeName,
          companyId: exam.companyId,
          dueDate: effectiveDueDateStr,
          daysRemaining,
          riskDegree: risk,
          periodicity,
          regulatoryBasis,
        });
      }
    }

    return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  /**
   * Formata texto corporativo oficial para envio via WhatsApp corporativo (Cloud API / Twilio / Z-API).
   */
  static formatWhatsAppMessage(
    alert: ExpirationAlert,
    companyName: string = "NextCon SGI"
  ): string {
    const urgenciaEmoji =
      alert.severity === "critical"
        ? "🚨 *URGENTE*"
        : alert.severity === "warning"
          ? "⚠️ *ATENÇÃO*"
          : "📋 *AVISO*";

    return [
      `${urgenciaEmoji} - Vencimento de Exame Ocupacional (NR-07)`,
      ``,
      `Prezado(a) Gestor(a),`,
      `Informamos sobre o prazo de exame médico periódico vinculado ao PCMSO:`,
      ``,
      `• *Colaborador:* ${alert.employeeName || "Não especificado"}`,
      `• *Exame:* ${alert.title}`,
      `• *Vencimento:* ${alert.dueDate}`,
      `• *Dias Restantes:* ${alert.daysRemaining <= 0 ? "VENCIDO!" : `${alert.daysRemaining} dias`}`,
      `• *Regra NR-07:* ${alert.regulatoryBasis || "Conforme PCMSO"}`,
      ``,
      `Por favor, realize o agendamento prévio com a clínica conveniada para evitar infração ao Art. 168 da CLT.`,
      `_Sistema NAI - Plataforma ${companyName}_`,
    ].join("\n");
  }

  /**
   * Dispara o alerta via WhatsApp com payload auditável e suporte a webhook externo.
   */
  static async sendWhatsAppAlert(
    alert: ExpirationAlert,
    phone: string,
    webhookUrl?: string
  ): Promise<WhatsAppDispatchResult> {
    const formattedMessage = this.formatWhatsAppMessage(alert);
    const masked = maskPhone(phone);
    const timestamp = new Date().toISOString();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const targetUrl =
      webhookUrl || (typeof process !== "undefined" ? process.env.WHATSAPP_WEBHOOK_URL : undefined);

    if (targetUrl) {
      try {
        const response = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId,
            phone,
            message: formattedMessage,
            alertId: alert.id,
            severity: alert.severity,
            timestamp,
          }),
        });

        if (response.ok) {
          logger.info(
            `[WhatsApp Notification] Mensagem ${messageId} despachada via Webhook para ${masked}.`
          );
          return {
            success: true,
            messageId,
            status: "DISPATCHED_WEBHOOK",
            maskedPhone: masked,
            formattedMessage,
            timestamp,
          };
        } else {
          logger.warn(
            `[WhatsApp Notification] Falha no Webhook para ${masked}: ${response.status}`
          );
          return {
            success: false,
            messageId,
            status: "FAILED",
            maskedPhone: masked,
            formattedMessage,
            timestamp,
            error: `Webhook retornou status ${response.status}`,
          };
        }
      } catch (err: any) {
        logger.error(`[WhatsApp Notification] Erro na conexão do Webhook: ${err.message}`);
        return {
          success: false,
          messageId,
          status: "FAILED",
          maskedPhone: masked,
          formattedMessage,
          timestamp,
          error: err.message,
        };
      }
    }

    return {
      success: false,
      messageId,
      status: "FAILED",
      maskedPhone: masked,
      formattedMessage,
      timestamp,
      error: "Canal de envio não configurado. Nenhuma mensagem foi enviada ou enfileirada.",
    };
  }
}
