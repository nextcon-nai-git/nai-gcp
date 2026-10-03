/**
 * NEXTCON PLATFORM - HIERARQUIA DE STORAGE 2026
 * Estrutura oficial para conformidade LGPD e isolamento de dados.
 */

export const STORAGE_PATHS = {
  // 1. ÁREA PÚBLICA (Logos, Templates)
  PUBLIC_ASSET: (filename: string) => `public/assets/${filename}`,
  PUBLIC_TEMPLATE: (filename: string) => `public/modelos_documentos/${filename}`,

  // 2. INTERNOS NEXTCON (Gestão Própria)
  INTERNAL_PROJECT: (projectId: string, filename: string) =>
    `internos_nextcon/projetos_internos/${projectId}/${filename}`,
  INTERNAL_PROVIDER: (providerId: string, filename: string) =>
    `internos_nextcon/fornecedores/${providerId}/${filename}`,

  // 3. CLIENTES (O Coração do Sistema - Isolamento Total)

  // Documentos Legais (CNPJ, Alvarás)
  CLIENT_LEGAL: (clientId: string, filename: string) =>
    `clientes/${clientId}/docs_legais/${filename}`,

  // Núcleo SST / NRs
  CLIENT_SST_NR: (
    clientId: string,
    nr: "nr01_pgr" | "nr04_sesmt" | "nr05_cipa" | "nr06_epis" | "nr07_pcmso" | "nr17_ergo",
    filename: string
  ) => `clientes/${clientId}/sst_nrs/${nr}/${filename}`,

  // Gestão de Saúde (Financeiro / Previdenciário)
  CLIENT_HEALTH_MNG: (clientId: string, type: "afastados" | "fap" | "pericias", filename: string) =>
    `clientes/${clientId}/saude_gestao/${type}/${filename}`,

  // Certificações (ISO)
  CLIENT_CERT: (clientId: string, cert: string, filename: string) =>
    `clientes/${clientId}/certificacoes/${cert}/${filename}`,

  // Prontuários e Arquivos de Colaboradores
  CLIENT_EMPLOYEE: (clientId: string, employeeId: string, filename: string) =>
    `clientes/${clientId}/colaboradores/${employeeId}/${filename}`,
};
