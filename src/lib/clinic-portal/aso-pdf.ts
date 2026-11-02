import { jsPDF } from "jspdf";
import type { ClinicalData, PortalRecord } from "./schema";
/** ASO only. Never includes confidential history, findings, medications or diagnoses. */
export function downloadAsoForSignature(
  record: Pick<PortalRecord, "identity" | "exams" | "risks" | "doctorName" | "crm" | "uf">,
  clinical: ClinicalData
) {
  const pdf = new jsPDF();
  let y = 20;
  const line = (text: string) => {
    for (const piece of pdf.splitTextToSize(text, 175) as string[]) {
      if (y > 265) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(piece, 17, y);
      y += 6;
    }
    y += 3;
  };
  pdf.setFontSize(15);
  line("NEXTCON | NAI - ASO");
  pdf.setFontSize(10);
  line("MINUTA PARA REVISAO E ASSINATURA MEDICA - SEM ASSINATURA");
  line(`Empresa: ${record.identity.companyName} | CNPJ: ${record.identity.cnpj}`);
  line(`Colaborador: ${record.identity.employeeName} | CPF: ${record.identity.cpf}`);
  line(`Cargo: ${record.identity.roleTitle} | Setor: ${record.identity.department}`);
  line(`Tipo de exame: ${record.identity.examType} | Atendimento: ${clinical.attendanceDate}`);
  line(
    `Perigos/fatores de risco informados: ${record.risks.join("; ") || "Pendente de conferencia com PGR/PCMSO"}`
  );
  line("Exames solicitados (conferir realizacao e preencher datas):");
  record.exams.forEach((e) => line(`${e.name} - Realizado em: ____/____/________`));
  line("Medico responsavel pelo PCMSO: ____________________________________");
  line("CRM/UF: __________________________");
  line(`Conclusao registrada pelo medico: ${clinical.conclusion.toUpperCase()}`);
  line(`Medico examinador: ${record.doctorName} | CRM ${record.crm}/${record.uf}`);
  line("Local e data: _____________________________________________________");
  line("Assinatura do medico: _____________________________________________");
  line("Ciencia do trabalhador: ___________________________________________");
  pdf.save("ASO-NAI-para-assinatura.pdf");
}
