// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
import { emptyWorkflow } from "@/lib/avp-workflow";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  data: new Map<string, Record<string, unknown>>(),
  writes: vi.fn(),
  tx: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/firebase-admin", () => {
  function ref(path: string): object {
    return {
      path,
      collection: (n: string) => ref(`${path}/${n}`),
      doc: (n: string) => ref(`${path}/${n}`),
      limit: () => ({ get: async () => ({ size: 0, docs: [] }) }),
    };
  }
  return {
    adminDb: {
      collection: (n: string) => ref(n),
      runTransaction: async (fn: (tx: unknown) => unknown) => {
        mocks.tx();
        return fn({
          get: async (r: { path: string }) => ({
            exists: mocks.data.has(r.path),
            data: () => mocks.data.get(r.path),
          }),
          set: mocks.writes,
          create: mocks.writes,
        });
      },
    },
  };
});
import { GET, POST } from "./route";
const base = () =>
  emptyWorkflow({
    id: "campaign-1",
    name: "Pessoa Teste",
    unit: "ASSOBES MARABÁ",
    admission: "2025-01-01",
    city: "Marabá",
  });
const request = (body?: unknown) =>
  new NextRequest(
    "https://example.test/api/clients/grupo-avp/workflow",
    body
      ? {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      : undefined
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.data.clear();
  mocks.auth.mockResolvedValue({
    uid: "operator",
    role: "SUPER_ADMIN",
    tenantId: null,
    servedCompanies: [],
  });
});
describe("API da esteira AVP", () => {
  it("exige autenticação antes de consultar ou gravar", async () => {
    mocks.auth.mockRejectedValue(new AuthError("Entre", 401));
    expect((await GET(request())).status).toBe(401);
    expect((await POST(request({ record: base(), version: 0 }))).status).toBe(401);
    expect(mocks.tx).not.toHaveBeenCalled();
  });
  it("recusa administrador do cliente e usuário de outra carteira", async () => {
    mocks.auth.mockResolvedValue({
      uid: "tenant",
      role: "ADMIN",
      tenantId: "GRUPO_AVP",
      servedCompanies: [],
    });
    expect((await GET(request())).status).toBe(403);
    expect((await POST(request({ record: base(), version: 0 }))).status).toBe(403);
    expect(mocks.tx).not.toHaveBeenCalled();
  });
  it("salva pendência com versão e histórico sem enviar mensagem", async () => {
    const response = await POST(request({ record: base(), version: 0 }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const { record } = await response.json();
    expect(record.version).toBe(1);
    expect(record.updatedBy).toBe("operator");
    expect(mocks.writes).toHaveBeenCalledTimes(2);
  });
  it("recusa atualização com versão desatualizada", async () => {
    const response = await POST(request({ record: base(), version: 2 }));
    expect(response.status).toBe(409);
    expect(mocks.writes).not.toHaveBeenCalled();
  });
  it("recusa avanço sem consulta SOC", async () => {
    expect((await POST(request({ record: { ...base(), stage: "kit" }, version: 0 }))).status).toBe(
      400
    );
    expect(mocks.tx).not.toHaveBeenCalled();
  });
  it("impede usar o mesmo pedido SOC em dois casos", async () => {
    const order = "381936314";
    const key = createHash("sha256").update(order).digest("hex");
    mocks.data.set(`webhook_deliveries/grupo-avp-workflow/orders/${key}`, { caseId: "outro-caso" });
    const response = await POST(request({ record: { ...base(), socOrder: order }, version: 0 }));
    expect(response.status).toBe(409);
    expect(mocks.writes).not.toHaveBeenCalled();
  });
  it("recusa PDF inexistente ou sem anexo", async () => {
    expect(
      (await POST(request({ record: { ...base(), evidenceId: "a".repeat(64) }, version: 0 })))
        .status
    ).toBe(400);
    expect(mocks.writes).not.toHaveBeenCalled();
  });
  it("recusa ASO de outra pessoa e retificação pendente", async () => {
    const evidenceId = "a".repeat(64),
      path = `webhook_deliveries/grupo-avp-evidence/records/${evidenceId}`;
    for (const evidence of [
      { kind: "aso", uploaded: true, review: "Recebido", employee: "Outra Pessoa" },
      { kind: "aso", uploaded: true, review: "Conferir retificação", employee: "Pessoa Teste" },
    ]) {
      mocks.data.set(path, evidence);
      expect((await POST(request({ record: { ...base(), evidenceId }, version: 0 }))).status).toBe(
        400
      );
    }
    expect(mocks.writes).not.toHaveBeenCalled();
  });
});
