import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, ui } from "../../../tests/ui/harness";
import { ClinicPaymentBatchesWorkspace } from "./clinic-payment-batches-workspace";

const identity = vi.hoisted(() => ({
  user: { uid: "finance", getIdToken: async () => "synthetic" } as {
    uid: string;
    getIdToken: () => Promise<string>;
  } | null,
  role: "ADMIN",
  tenantId: null,
}));
vi.mock("@/firebase", () => ({ useUser: () => identity }));
const fetcher = vi.fn();
let view: ReturnType<typeof ui>;
const preview = {
  hash: "a".repeat(64),
  dueDate: "2026-11-10",
  sourceStatus: "CONNECTED",
  sourceError: null,
  refreshInProgress: false,
  closedCompetences: [],
  ignored: 0,
  totals: { clinics: 1, asos: 1, amountCents: 2500 },
  batches: [
    {
      key: "one",
      clinicName: "Clínica de teste",
      clinicDocument: "11222333000181",
      competence: "2026-11",
      amountCents: 2500,
      items: [],
      warnings: [],
    },
  ],
  blocked: Array.from({ length: 26 }, (_, i) => ({
    asoId: "item-" + i,
    collaborator: "Pessoa " + (i + 1),
    clinicName: "Clínica de teste",
    code: "SOURCE_CONFLICT",
    reason: "Divergência na origem.",
  })),
};
beforeEach(() => {
  view = ui();
  identity.user = { uid: "finance", getIdToken: async () => "synthetic" };
  identity.role = "ADMIN";
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(async () => {
  await view.cleanup();
  vi.unstubAllGlobals();
});
const render = () => view.render(<ClinicPaymentBatchesWorkspace />);
const createLabel = "Gerar rascunhos no financeiro";

describe("conferência de rascunhos de ASOs", () => {
  it.each([
    { sourceStatus: "ERROR", sourceError: "Falha na leitura." },
    { refreshInProgress: true },
  ])("desabilita a geração enquanto a origem requer nova consulta", async (state) => {
    fetcher.mockResolvedValue(Response.json({ ...preview, ...state }));
    await render();
    expect(view.button(createLabel).disabled).toBe(true);
    expect(view.container.textContent).toContain(state.sourceError || "atualização");
  });
  it("permite conferir quem ficou fora do lote depois da 25ª linha", async () => {
    fetcher.mockResolvedValue(Response.json(preview));
    await render();
    expect(view.container.textContent).not.toContain("Pessoa 26");
    await view.click("Próxima");
    expect(view.container.textContent).toContain("Pessoa 26");
    await view.click("Anterior");
    expect(view.container.textContent).toContain("Pessoa 25");
  });
  it("limpa a prévia e ignora uma resposta atrasada após a troca de perfil", async () => {
    const waiting = deferred<Response>();
    fetcher.mockReturnValueOnce(waiting.promise);
    await render();
    identity.role = "OPERATIONS";
    fetcher.mockResolvedValueOnce(Response.json({ error: "Perfil sem acesso." }, { status: 403 }));
    await render();
    await act(async () => waiting.resolve(Response.json(preview)));
    expect(view.container.textContent).not.toContain("Clínica de teste");
    expect(view.container.textContent).toContain("Perfil sem acesso.");
  });
  it("exige atualizar a prévia quando a gravação recebe conflito", async () => {
    fetcher
      .mockResolvedValueOnce(Response.json(preview))
      .mockResolvedValueOnce(Response.json({ error: "A fila mudou." }, { status: 409 }));
    await render();
    await view.click(createLabel);
    expect(view.container.textContent).toContain("A fila mudou.");
    expect(view.button(createLabel).disabled).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
