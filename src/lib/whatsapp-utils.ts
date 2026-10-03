/**
 * Utilitário para geração de links do WhatsApp com mensagens pré-formatadas.
 */

export function getWhatsAppLink(phone: string, message: string): string {
  if (!phone) return "#";
  // Remove caracteres não numéricos do telefone
  const cleanPhone = phone.replace(/\D/g, "");
  // Garante o código do país se não houver
  const formattedPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

export const MSG_TEMPLATES = {
  EXAME_VENCENDO: (nome: string, exame: string, data: string) =>
    `Olá ${nome}, a Nextcon Saúde Empresarial informa que seu exame de ${exame} está com vencimento previsto para ${data}. Favor entrar em contato para agendamento.`,

  AVISO_GESTOR: (gestor: string, colaborador: string, exame: string) =>
    `Prezado ${gestor}, informamos que o colaborador ${colaborador} possui uma pendência de ${exame} que precisa ser regularizada. Atenciosamente, Nextcon.`,

  ALERTA_LIMBO: (colaborador: string) =>
    `Atenção: Identificamos um possível nexo NTEP para o colaborador ${colaborador}. Favor verificar o painel Sentinela do Limbo na plataforma NAI.`,

  CONFIRMACAO_AGENDAMENTO: (
    colaborador: string,
    exame: string,
    clinica: string,
    data: string,
    hora: string,
    endereco: string
  ) =>
    `Olá ${colaborador}! 🩺\n\nSeu exame ocupacional (${exame}) foi agendado pela Nextcon.\n\n📍 Local: ${clinica}\n📅 Data: ${data}\n⏰ Horário: ${hora}\n🏠 Endereço: ${endereco}\n\n⚠️ Lembre-se de levar um documento com foto. Em caso de imprevisto, avise com 24h de antecedência.`,

  SOLICITAR_GRADE_CLINICA: (clinica: string) =>
    `Olá equipe ${clinica}! 🏥\n\nAqui é da Nextcon Saúde. Poderiam nos fornecer os horários disponíveis para exames Admissionais e Periódicos para esta semana? Obrigado!`,
};
