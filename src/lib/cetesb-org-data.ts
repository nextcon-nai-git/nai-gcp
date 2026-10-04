/**
 * NEXTCON SST - MATRIZ ORGANIZACIONAL CETESB 2026
 * Estrutura física e administrativa mapeada para o PGR (NR-01).
 */

export const CETESB_ORG_STRUCTURE = {
  id: "CETESB_080680",
  locations: [
    {
      id: "predio_principal",
      name: "PRÉDIO PRINCIPAL",
      sectors: [
        // 1º Andar
        { id: "pp_1_conselho", name: "Conselho de Administração", floor: "1º Andar" },
        {
          id: "pp_1_rh_gestao",
          name: "Dep. Pessoas e Cultura - Divisão de Gestão de Pessoas",
          floor: "1º Andar",
        },
        {
          id: "pp_1_rh_dev",
          name: "Dep. Pessoas e Cultura - ARD - Divisão de Desenvolvimento",
          floor: "1º Andar",
        },
        { id: "pp_1_rh_beneficios", name: "Setor de Benefícios Corporativos", floor: "1º Andar" },
        { id: "pp_1_rh_dados", name: "Setor de Dados de Capital Humano", floor: "1º Andar" },
        { id: "pp_1_rh_org", name: "Setor de Desenvolvimento Organizacional", floor: "1º Andar" },
        { id: "pp_1_rh_folha", name: "Setor de Administração de Folha", floor: "1º Andar" },
        { id: "pp_1_rh_sst", name: "Setor de Saúde e Segurança do Trabalho", floor: "1º Andar" },
        // 2º Andar
        {
          id: "pp_2_financeiro",
          name: "Departamento Econômico Financeiro (AF)",
          floor: "2º Andar",
        },
        {
          id: "pp_2_controladoria",
          name: "Divisão de Operações de Controladoria (AFC)",
          floor: "2º Andar",
        },
        { id: "pp_2_fin_ops", name: "Divisão de Operações Financeiras (AFF)", floor: "2º Andar" },
        { id: "pp_2_tesouraria", name: "Tesouraria", floor: "2º Andar" },
        { id: "pp_2_auditoria", name: "PA - Departamento de Auditoria Interna", floor: "2º Andar" },
      ],
    },
    {
      id: "anexo_1",
      name: "ANEXO 1",
      sectors: [
        // Térreo
        { id: "a1_0_ambulatorio", name: "Ambulatório", floor: "Térreo" },
        {
          id: "a1_0_emergencias",
          name: "CEEQ - Setor de Atendimento a Emergências",
          floor: "Térreo",
        },
        {
          id: "a1_0_risco_solo",
          name: "IPR - Divisão de Avaliação de Risco e Solo",
          floor: "Térreo",
        },
        { id: "a1_0_risco_tec", name: "IPRR - Setor de Riscos Tecnológicos", floor: "Térreo" },
        // 1º Andar
        {
          id: "a1_1_areas_cont",
          name: "Departamento de Áreas Contaminadas (EC-ECAI-ECAP-ECRU)",
          floor: "1º Andar",
        },
        {
          id: "a1_1_qualidade",
          name: "PDPQ - Setor de Qualidade Organizacional e Normatização",
          floor: "1º Andar",
        },
        {
          id: "a1_1_planejamento",
          name: "PDPI - Setor de Planejamento Institucional",
          floor: "1º Andar",
        },
        // 2º Andar
        { id: "a1_2_conselho_apoio", name: "Conselho de Administração (Apoio)", floor: "2º Andar" },
        {
          id: "a1_2_rh_apoio",
          name: "AR - Departamento de Pessoal e Cultura (Apoio)",
          floor: "2º Andar",
        },
      ],
    },
  ],
};
