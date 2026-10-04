/**
 * NEXTCON PLATFORM - MESSAGING UTILS 2026
 * Gerador de links do WhatsApp com templates contextuais da NAI.
 */

export function getWhatsAppLink(phone: string, message: string): string {
  if (!phone) return "#";
  const cleanPhone = phone.replace(/\D/g, "");
  const formattedPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

export const MSG_TEMPLATES = {
  // Chamada para Exame Ocupacional (Periódico)
  EXAME_VENCENDO: (nome: string, exame: string, data: string) =>
    `Olá ${nome.toUpperCase()}, aqui é da Nextcon Saúde. 🩺\n\nIdentificamos que seu exame de *${exame}* tem vencimento previsto para *${data}*.\n\nPor favor, entre em contato para agendarmos sua avaliação clínica e garantir sua aptidão no eSocial. Obrigado!`,

  // Alerta para Gestor de Unidade
  AVISO_GESTOR: (gestor: string, colaborador: string, pendencia: string) =>
    `Prezado ${gestor}, informamos que o colaborador *${colaborador}* possui uma pendência crítica de *${pendencia}* identificada pela NAI.\n\nSolicitamos a regularização imediata para evitar multas automáticas do firewall e-Social. Atenciosamente, NextconSST.`,

  // Alerta de Limbo (Previdenciário)
  ALERTA_LIMBO: (colaborador: string) =>
    `🚨 *ALERTA SENTINELA NAI* 🚨\n\nIdentificamos uma possível caracterização de nexo acidentário (NTEP) para o colaborador *${colaborador}*.\n\nO dossiê de contestação já está disponível no portal do RH. Favor validar com urgência.`,

  // Confirmação de Agendamento Profissional
  CONFIRMACAO_AGENDAMENTO: (
    colaborador: string,
    exame: string,
    clinica: string,
    data: string,
    hora: string,
    endereco: string
  ) =>
    `Olá ${colaborador}! 🩺\n\nSeu exame ocupacional (*${exame}*) foi agendado pela Nextcon.\n\n📍 *Local:* ${clinica}\n📅 *Data:* ${data}\n⏰ *Horário:* ${hora}\n🏠 *Endereço:* ${endereco}\n\n⚠️ *Atenção:* Leve um documento original com foto. Caso não possa comparecer, avise com 24h de antecedência para evitarmos cobrança de No-Show.`,

  // Solicitação de Grade para Clínica Prestadora
  SOLICITAR_GRADE_CLINICA: (clinica: string) =>
    `Olá equipe ${clinica}! 🏥\n\nAqui é da Nextcon Saúde Empresarial. Poderiam nos fornecer os horários disponíveis para exames Admissionais e Periódicos para esta semana? Estamos com demanda de rede ativa. Obrigado!`,
};
