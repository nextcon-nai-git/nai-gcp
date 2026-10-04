/**
 * @fileOverview NAI Master Domain Configuration.
 * Configuração central do domínio oficial de produção da Nextcon Saúde Empresarial: www.nai.nextconsaude.com.br
 */

export const OFFICIAL_DOMAIN = "www.nai.nextconsaude.com.br";
export const OFFICIAL_BASE_URL = `https://${OFFICIAL_DOMAIN}`;

/**
 * Retorna a URL pública completa para compartilhamento com Prestadores e Clientes.
 * Em ambiente de desenvolvimento local, utiliza a origem ativa ou localhost:9002 como fallback.
 */
export function getPublicDomainUrl(path: string = ""): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (typeof window !== "undefined") {
    // Se o hostname do navegador for o oficial ou local
    const origin = window.location.origin;
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return `${OFFICIAL_BASE_URL}${cleanPath}`;
    }
    return `${origin}${cleanPath}`;
  }

  return `${OFFICIAL_BASE_URL}${cleanPath}`;
}

/**
 * Gera a mensagem profissional com link direto de convite para envio via WhatsApp aos prestadores.
 */
export function generateProviderInviteMessage(providerName: string, email: string): string {
  const loginUrl = `${OFFICIAL_BASE_URL}/login`;

  return `Olá, ${providerName}! Seu acesso ao Portal NAI está liberado: ${loginUrl} E-mail: ${email} Use a opção Esqueci minha senha para definir seu acesso. Atenciosamente, Equipe Nextcon Saúde Empresarial`;
}

/**
 * Gera a mensagem profissional de proposta de credenciamento via WhatsApp para qualquer clínica ocupacional do Brasil.
 */
export function generateClinicProposalMessage(clinicName: string): string {
  const name = clinicName ? clinicName.trim() : "[Nome da Clínica]";
  return `Olá, equipe da ${name}! 🏥\n\nFalo em nome da Nextcon Saúde Empresarial. Estamos expandindo nossa Rede Credenciada para atendimento a clientes parceiros em todo o Brasil\n\nGostaríamos de credenciar sua clínica para realização de exames ocupacionais (ASO, Audiometria, Análises Clínicas, Raio-X OIT) e envio de demandas corporativas.\n\n📌 Poderia nos informar com quem podemos falar do setor Comercial ou de Credenciamento?\n\nAtenciosamente,\nEquipe de Credenciamento Nextcon Saúde Empresarial\n🌐 https://www.nextconsaude.com.br`;
}
