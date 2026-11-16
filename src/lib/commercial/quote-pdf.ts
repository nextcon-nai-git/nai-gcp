import type { OrcamentoOutput } from "@/ai/flows/nai-quote-flow";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function quoteActivities(phase: { atividades?: string[]; atactivities?: string[] }) {
  return phase.atividades ?? phase.atactivities ?? [];
}

export async function createQuotePdf(company: string, scope: string, quote: OrcamentoOutput) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  let y = 22;
  function paragraph(text: string, heading = false) {
    if (!text) return;
    pdf.setFont("helvetica", heading ? "bold" : "normal");
    pdf.setFontSize(heading ? 13 : 10);
    for (const line of pdf.splitTextToSize(text, 172) as string[]) {
      if (y > 274) {
        pdf.addPage();
        y = 22;
      }
      pdf.text(line, 19, y);
      y += heading ? 7 : 5;
    }
    y += 3;
  }
  paragraph("NEXTCON | Proposta comercial", true);
  paragraph(company, true);
  const executive = quote.propostaExecutiva;
  paragraph(executive.apresentacao);
  if (scope) {
    paragraph("Escopo solicitado", true);
    paragraph(scope);
  }
  paragraph("Fundamentação e impacto", true);
  paragraph(executive.justificativaNormativa);
  paragraph(executive.analiseImpactoFinanceiro);
  paragraph("Estimativa de economia anual", true);
  paragraph(currency.format(quote.roiEstimado.valorEconomiaAnual));
  paragraph(quote.roiEstimado.descricaoBeneficio);
  for (const pkg of quote.pacotes) {
    paragraph(pkg.nome, true);
    paragraph(pkg.destaque);
    paragraph("Implementação: " + currency.format(pkg.valorImplementacao));
    if (pkg.valorMensal != null) paragraph("Mensalidade: " + currency.format(pkg.valorMensal));
    for (const service of pkg.servicosInclusos) paragraph(service);
  }
  paragraph("Cronograma", true);
  for (const phase of quote.cronograma) {
    paragraph(phase.fase + " - " + phase.prazo, true);
    for (const activity of quoteActivities(phase)) paragraph(activity);
  }
  return pdf;
}
