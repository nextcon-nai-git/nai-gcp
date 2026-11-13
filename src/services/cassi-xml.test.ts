// @vitest-environment node
import { expect, it } from "vitest";
import type { CassiGuideData } from "@/lib/cassi-automation";
import { generateCassiXml } from "./cassi-xml";
const g = {
  authorizationNumber: "SENHA1",
  authorizationDate: "2026-11-11",
  providerGuideNumber: "100",
  beneficiaryCardNumber: "123",
  isNewbornCare: false,
  operatorCode: "1234",
  cnesCode: "1234567",
  contractedName: "Empresa de teste",
  requesterName: "Profissional Teste",
  requesterCouncilType: "CRM",
  requesterCouncilNumber: "123456",
  requesterCouncilUf: "SP",
  requesterCbo: "225125",
  careCharacter: "1",
  attendanceType: "04",
  primaryCid: "",
  totalGuideValue: 123,
  procedures: [
    {
      code: "10101012",
      description: "Consulta sintética",
      date: "2026-11-11",
      quantity: 1,
      unitValue: 123,
      totalValue: 123,
    },
  ],
  otherExpenses: [],
  attachments: [],
} as unknown as CassiGuideData;
const fields = {
  regime: "01",
  requesterCode: "1234",
  requesterUnit: "Solicitante",
  accident: "9",
  admissionGuide: "999",
  billing: "1",
  start: "2026-11-10",
  end: "2026-11-12",
  startTime: "08:00:00",
  endTime: "12:00:00",
  admissionType: "1",
  admissionRegime: "1",
  endReason: "11",
  participation: "00",
  professionalCode: "555",
  siteCode: "123",
  siteName: "Local teste",
  siteCnes: "1234567",
  issued: "2026-11-13",
};
it.each([
  ["SP_SADT", "guiaSP-SADT"],
  ["INTERNACAO", "guiaResumoInternacao"],
  ["HONORARIOS", "guiaHonorarios"],
] as const)(
  "valida o documento completo %s e recusa códigos incompatíveis",
  async (guideType, tag) => {
    const xml = await generateCassiXml({ ...g, guideType }, fields);
    expect(xml.toString("latin1")).toContain("<ans:" + tag + ">");
    await expect(
      generateCassiXml({ ...g, guideType, cnesCode: "inválido demorado" }, fields)
    ).rejects.toThrow();
  }
);

it("produz um script CASSI com sintaxe válida mesmo com caracteres em observações", async () => {
  const { generateCassiRpaScript } = await import("@/lib/cassi-automation");
  expect(
    () =>
      new Function(
        generateCassiRpaScript({ ...g, requesterName: "Teste */ com aspas ' e quebra\nde linha" })
      )
  ).not.toThrow();
});
