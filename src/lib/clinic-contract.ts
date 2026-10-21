import { z } from "zod";

export const CLINIC_CONTRACT_VERSION = "nextcon-v2-2026-10-21";
export const CLINIC_CONTRACT_HASH =
  "5e8c090daa0569983e32185e86257c7060f209a46109284fc06f1f626344765d";
export const CLINIC_CONTRACT_NAME = "Contrato_Credenciamento_Clinicas_Nextcon_v2.docx";
export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const CONTRACT_FIELDS = [
  ["contractNumber", "Número do contrato"],
  ["legalName", "Razão social da clínica"],
  ["cnpj", "CNPJ da clínica"],
  ["address", "Endereço da clínica"],
  ["cityUf", "Município/UF da clínica"],
  ["postalCode", "CEP da clínica"],
  ["email", "E-mail da clínica para revisão"],
  ["nextconEmail", "E-mail da NEXTCON para comunicações"],
  ["representative", "Representante legal da clínica"],
  ["representativeRole", "Cargo do representante"],
  ["representativeCpf", "CPF do representante"],
  ["crmPj", "CRM-PJ da clínica"],
  ["cnes", "CNES da clínica"],
  ["rtName", "Responsável técnico da clínica"],
  ["rtUf", "UF do CRM do responsável técnico"],
  ["rtCrm", "CRM do responsável técnico"],
  ["lgpdName", "Responsável por proteção de dados"],
  ["lgpdContact", "Contato de proteção de dados"],
  ["deliveryChannel", "Canal seguro alternativo ao SOCNET"],
] as const;
export type ContractField = (typeof CONTRACT_FIELDS)[number][0];
export type ClinicContractFields = Record<ContractField, string>;
export const emptyContractFields = () =>
  Object.fromEntries(CONTRACT_FIELDS.map(([key]) => [key, ""])) as ClinicContractFields;
const field = z
  .string()
  .trim()
  .max(300)
  .refine((v) => !/[\x00-\x1f\x7f\[\]]/.test(v), {
    message: "Use texto sem quebras de linha ou colchetes.",
  });
export const ClinicContractFieldsSchema = z
  .object(
    Object.fromEntries(CONTRACT_FIELDS.map(([key]) => [key, field])) as Record<
      ContractField,
      typeof field
    >
  )
  .strict()
  .refine((v) => !v.email || z.string().email().safeParse(v.email).success, {
    message: "Confira o e-mail da clínica.",
    path: ["email"],
  });

export const CONTRACT_REVIEW_NOTES = [
  "Preencher os campos entre colchetes, a qualificação da clínica, os contatos e a tabela de exames complementares. Conferir os poderes dos representantes e os registros profissionais antes da assinatura.",
  "Cláusulas 6.4, 6.5 e 7.4: harmonizar o faturamento das clínicas sem SOCNET. A vedação de pagamento sem registro no SOC precisa contemplar a entrega pelo canal alternativo aceito.",
  "Cláusulas 12.1 e 12.3: definir os papéis de proteção de dados conforme a atuação real de cada parte; restringir prontuários ao acesso médico autorizado e explicitar guarda e transferência conforme a NR-07. Acesso administrativo ao ASO não equivale a acesso à ficha clínica.",
  "Cláusulas 11 e 13: submeter a revisão jurídica a multa de 20% ao dia (até 100%), a cumulação de multas e a restrição de captação por 24 meses. Proporcionalidade e limites dependem do caso concreto.",
  "Cláusulas 6.7 e 7.2 e Anexo II: esclarecer a contagem das horas, feriados, indisponibilidade do SOC e exceções técnicas; a meta de adesão ao SOCNET deve manter o caráter não obrigatório da cláusula 6.5.",
] as const;

export const CONTRACT_REVIEW_SOURCES = [
  {
    label: "NR-07 — documentação e prontuários",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/arquivos/normas-regulamentadoras/nr-07-atualizada-2022.pdf",
  },
  {
    label: "ANPD — agentes de tratamento",
    url: "https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/Segunda_Versao_do_Guia_de_Agentes_de_Tratamento_retificada.pdf/@@display-file/file",
  },
  {
    label: "Código Civil — artigos 412 e 413",
    url: "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm",
  },
  {
    label: "Código de Ética Médica — sigilo",
    url: "https://sistemas.cfm.org.br/normas/visualizar/resolucoes/BR/2018/2217",
  },
] as const;
