import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
import { S2220AuditPanel } from "./s2220-audit-panel";
const m = vi.hoisted(() => ({ run: vi.fn(), token: vi.fn().mockResolvedValue("TESTE") }));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: { getIdToken: m.token } }) }));
vi.mock("@/app/actions/audit-s2220", () => ({ executeS2220AuditAction: m.run }));
const v = ui();
afterEach(() => v.cleanup());
it("envia o formulário da empresa para o provedor escolhido e invalida o resultado após edição", async () => {
  const payload = {
    eventType: "S2220",
    ideVinculo: { cpfTrab: "123.456.789-09" },
    aso: {
      tpAso: 9,
      dtAso: "2026-05-13",
      resAso: 1,
      medico: { nmMed: "MÉDICO TESTE", nrCrm: "1234", ufCrm: "PR" },
      exames: [{ dtExm: "2026-05-14", procRealizado: "0281" }],
    },
  };
  m.run.mockResolvedValue({
    success: true,
    data: {
      modeloUtilizado: "vertexai/gemini-4-argon",
      fallbackAcionado: true,
      scoreRisco: 50,
      statusConformidade: "NAO_CONFORME",
      revisaoMedicaPrioritaria: false,
      inconsistenciasDetectadas: [
        { campo: "examesComplementares.0.dataExame", descricaoErro: "Exame posterior ao ASO." },
      ],
      recomendacoesCorrecao: ["Confira as datas."],
      escopo: "Validação documental.",
    },
  });
  await v.render(
    <S2220AuditPanel companyId="TESTE" payload={payload} cleanPayload={() => payload} />
  );
  await v.input("select", "claude");
  await v.click("Auditar evento");
  expect(m.run).toHaveBeenCalledWith(
    "TESTE",
    "TESTE",
    expect.objectContaining({
      selectedProvider: "claude",
      tipoExame: "9",
      cpfTrabalhador: "12345678909",
    })
  );
  expect(v.container.textContent).toContain("Exame posterior ao ASO.");
  expect(v.container.textContent).toContain("Modelo alternativo");
  const revised = { ...payload, aso: { ...payload.aso, dtAso: "2026-05-15" } };
  await v.render(
    <S2220AuditPanel companyId="TESTE" payload={revised} cleanPayload={() => revised} />
  );
  expect(v.container.textContent).not.toContain("Exame posterior ao ASO.");
});
