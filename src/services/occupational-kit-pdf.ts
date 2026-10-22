import { jsPDF } from "jspdf";
import type { DigitalKit, ExamType } from "@/types/aso-scheduler-types";

export interface KitRegistration {
  registration: string;
  birthDate: string;
  admissionDate: string;
  unit: string;
  companyAddress: string;
  pcmsoDoctor: string;
  pcmsoCrm: string;
}
export const EMPTY_KIT_REGISTRATION: KitRegistration = {
  registration: "",
  birthDate: "",
  admissionDate: "",
  unit: "",
  companyAddress: "",
  pcmsoDoctor: "",
  pcmsoCrm: "",
};
const examLabels: Record<ExamType, string> = {
  admissional: "Admissional",
  periodico: "Periódico",
  demissional: "Demissional",
  retorno_trabalho: "Retorno ao trabalho",
  mudanca_funcao: "Mudança de função",
};

/** Administrative draft only. Never copies clinical findings or signatures from a reference. */
export function generateOccupationalKitPdf(
  kit: DigitalKit,
  registration: KitRegistration = EMPTY_KIT_REGISTRATION,
  emittedAt = new Date()
) {
  if (!kit.employeeDetails.name.trim() || !kit.companyDetails.name.trim()) {
    throw new Error("Informe empresa e colaborador antes de gerar o kit.");
  }
  const doc = new jsPDF();
  const issueDate = emittedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  let y = 0;
  const text = (value: string, size = 10) => {
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(value, 176);
    for (const line of lines) {
      if (y > 266) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 17, y);
      y += 5;
    }
    y += 2;
  };
  const section = (label: string) => {
    if (y > 248) {
      doc.addPage();
      y = 20;
    }
    doc.setFillColor(231, 239, 247);
    doc.rect(15, y - 4, 180, 8, "F");
    doc.setFont("helvetica", "bold");
    text(label, 11);
    doc.setFont("helvetica", "normal");
    y += 3;
  };
  const field = (label: string, value?: string) =>
    text(`${label}: ${value?.trim() || "________________________________"}`);
  const blank = (label: string, lines = 2) => {
    text(label);
    for (let i = 0; i < lines; i++) {
      text("________________________________________________________________________________");
    }
  };
  const page = (title: string, confidential = false) => {
    if (y) doc.addPage();
    y = 20;
    doc.setTextColor(20, 42, 68);
    doc.setFont("helvetica", "bold");
    text(`NEXTCON | NAI - ${title}`, 16);
    doc.setFont("helvetica", "normal");
    text(`MINUTA PARA PREENCHIMENTO | Emissão: ${issueDate}`, 9);
    text(`Referência NAI: ${kit.requestId} / ${kit.guiaNumber}`, 9);
    if (confidential) text("CONFIDENCIAL - acesso restrito à equipe de saúde e ao trabalhador.", 9);
    section("Identificação");
    field("Empresa", kit.companyDetails.name);
    field("CNPJ", kit.companyDetails.cnpj);
    field("Colaborador", kit.employeeDetails.name);
    field("CPF", kit.employeeDetails.cpf);
    field("Cargo / setor", `${kit.employeeDetails.roleTitle} / ${kit.employeeDetails.department}`);
    field("Tipo de exame", examLabels[kit.examType]);
  };
  page("PEDIDO DE EXAMES");
  field("Unidade", registration.unit);
  field("Matrícula", registration.registration);
  field("Nascimento", registration.birthDate);
  field("Admissão", registration.admissionDate);
  section("Clínica e atendimento");
  field("Clínica", kit.clinicDetails.name);
  field("Endereço", kit.clinicDetails.address);
  field("Telefone", kit.clinicDetails.phone);
  field("Agendamento", kit.appointmentDateTime);
  section("Exames propostos - conferir com o PCMSO antes do atendimento");
  if (!kit.examList.length) text("Exames pendentes de definição pelo responsável pelo PCMSO.");
  kit.examList.forEach((exam) => {
    text(`${exam.code} - ${exam.name}`);
    if (exam.patientPreparo) text(`Preparo informado: ${exam.patientPreparo}`);
  });
  section("Riscos declarados - conferir com PGR / PCMSO");
  text(
    kit.asoTemplate.declaredRisks.join("; ") ||
      "Não informados - conferir documentação ocupacional."
  );
  section("Orientações");
  [...kit.patientInstructions, ...kit.clinicInstructions].forEach((instruction) =>
    text(instruction)
  );
  text("Documento gerado no NAI. Não comprova registro ou agendamento no SOC.", 9);

  page("FICHA CLÍNICA - ANAMNESE", true);
  field("Data da ficha (emissão)", issueDate);
  field("Data do atendimento");
  field("Nascimento", registration.birthDate);
  field("Médico examinador / CRM-UF");
  section("Preenchimento pelo trabalhador e conferência médica");
  blank("Histórico pessoal e familiar / doenças prévias", 3);
  blank("Medicamentos em uso / alergias / cirurgias", 3);
  blank("História ocupacional / acidentes / afastamentos", 3);
  blank("Hábitos de saúde / atividade física / queixas atuais", 3);
  field("Assinatura do trabalhador / data");

  page("FICHA CLÍNICA - AVALIAÇÃO MÉDICA", true);
  field("Data do atendimento");
  field("Médico examinador / CRM-UF");
  section("Sinais vitais e exame físico - preenchimento médico");
  field("PA / pulso / frequência respiratória / temperatura");
  field("Peso / altura / IMC");
  blank("Exame físico e avaliação por sistemas", 5);
  blank("Resultados de exames / avaliação complementar", 4);
  blank("Conduta / orientações / encaminhamentos", 4);
  field("Assinatura e carimbo do médico / data");

  page("ASO - ATESTADO DE SAÚDE OCUPACIONAL");
  text("PENDENTE DE AVALIAÇÃO E ASSINATURA MÉDICA - SEM VALIDADE COMO ASO EMITIDO", 9);
  field("Endereço da empresa", registration.companyAddress);
  field(
    "Unidade / matrícula",
    `${registration.unit || "________"} / ${registration.registration || "________"}`
  );
  field("Nascimento", registration.birthDate);
  section("Responsável pelo PCMSO");
  field("Médico", registration.pcmsoDoctor);
  field("CRM / UF", registration.pcmsoCrm);
  section("Perigos / fatores de risco declarados");
  text(
    kit.asoTemplate.declaredRisks.join("; ") || "Não informados - preencher conforme PGR / PCMSO."
  );
  section("Exames realizados - datas a preencher pelo médico");
  if (!kit.examList.length) blank("Exames / datas");
  kit.examList.forEach((exam) => text(`${exam.name} - Realizado em: ____/____/________`));
  section("Conclusão exclusiva do médico examinador");
  text("[  ] APTO para a função     [  ] INAPTO para a função");
  blank("Observações", 2);
  field("Local e data do exame");
  field("Nome do médico examinador / CRM-UF");
  y += 10;
  field("Assinatura e carimbo do médico");
  y += 8;
  field("Ciência do trabalhador / data");
  const count = doc.getNumberOfPages();
  for (let p = 1; p <= count; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`NAI | Minuta ocupacional | ${issueDate} | Página ${p}/${count}`, 17, 285);
  }
  return doc;
}

export function occupationalKitFilename(kit: DigitalKit) {
  const name =
    kit.employeeDetails.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 -]/g, "")
      .trim()
      .slice(0, 100) || "colaborador";
  return `Kit-NAI-${name}.pdf`;
}
