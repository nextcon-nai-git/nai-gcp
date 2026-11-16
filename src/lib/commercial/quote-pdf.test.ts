import { expect, it } from "vitest";
import { createQuotePdf, quoteActivities } from "./quote-pdf";

it("exports the confirmed scope, full pricing and a multipage legacy schedule", async () => {
  const pdf = await createQuotePdf("Empresa Sintética", "PGR - 2 unidades", {
    propostaExecutiva: {
      apresentacao: "Escopo revisado",
      justificativaNormativa: "GRO",
      analiseImpactoFinanceiro: "Estimativa",
    },
    roiEstimado: { valorEconomiaAnual: 1500, descricaoBeneficio: "Exemplo" },
    pacotes: [
      {
        nome: "Pacote A",
        servicosInclusos: ["Programa de riscos"],
        valorImplementacao: 450,
        valorMensal: 0,
        destaque: "Sintético",
      },
    ],
    cronograma: [
      {
        fase: "Entrega",
        prazo: "30 dias",
        atactivities: Array.from({ length: 110 }, (_, n) => "Atividade " + n),
      },
    ],
    dicaEstrategica: "Observação interna para o vendedor",
  });
  const bytes = pdf.output();
  expect(bytes).toMatch(/^%PDF-/);
  for (const phrase of ["PGR - 2 unidades", "Pacote A", "Mensalidade", "Atividade 109"])
    expect(bytes).toContain(phrase);
  expect(bytes).not.toContain("interna para o vendedor");
  expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
  expect(quoteActivities({ atividades: ["Etapa"] })).toEqual(["Etapa"]);
});
