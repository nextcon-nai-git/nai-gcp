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
  deletes: vi.fn(),
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
        // Commit only after success, and reject reads after the first write as Firestore does.
        const pending: Array<() => void> = [];
        let writing = false;
        const set = (r: { path: string }, value: Record<string, unknown>) => {
          writing = true;
          mocks.writes(r, value);
          pending.push(() => mocks.data.set(r.path, structuredClone(value)));
        };
        const result = await fn({
          get: async (r: { path: string }) => {
            if (writing) throw new Error("Transaction read after write");
            return {
              exists: mocks.data.has(r.path),
              data: () => mocks.data.get(r.path),
            };
          },
          set,
          create: (r: { path: string }, value: Record<string, unknown>) => {
            if (mocks.data.has(r.path)) throw new Error("History already exists");
            set(r, value);
          },
          delete: (r: { path: string }) => {
            writing = true;
            mocks.deletes(r);
            pending.push(() => mocks.data.delete(r.path));
          },
        });
        pending.forEach((commit) => commit());
        return result;
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

describe("correções de pedido e documento", () => {
  const caseId = () =>
    createHash("sha256")
      .update(JSON.stringify([base().sourceId, base().unit, base().admission]))
      .digest("hex");
  const orderPath = (order: string) =>
    `webhook_deliveries/grupo-avp-workflow/orders/${createHash("sha256").update(order).digest("hex")}`;
  it.each(["456", ""])("libera reserva anterior ao corrigir pedido para %s", async (socOrder) => {
    const id = caseId();
    mocks.data.set(`webhook_deliveries/grupo-avp-workflow/cases/${id}`, {
      ...base(),
      version: 1,
      socOrder: "123",
    });
    mocks.data.set(orderPath("123"), { caseId: id });
    const response = await POST(request({ record: { ...base(), socOrder }, version: 1 }));
    expect(response.status).toBe(200);
    expect(mocks.deletes).toHaveBeenCalledWith(expect.objectContaining({ path: orderPath("123") }));
  });
  it("preserva reserva que pertence a outro caso", async () => {
    mocks.data.set(`webhook_deliveries/grupo-avp-workflow/cases/${caseId()}`, {
      ...base(),
      version: 1,
      socOrder: "123",
    });
    mocks.data.set(orderPath("123"), { caseId: "outro" });
    expect((await POST(request({ record: base(), version: 1 }))).status).toBe(200);
    expect(mocks.deletes).not.toHaveBeenCalled();
  });
  it.each([{ documentChecked: true }, { deliveryReference: "envio anterior" }])(
    "recusa confirmação herdada de outro PDF: %o",
    async (confirmation) => {
      mocks.data.set(`webhook_deliveries/grupo-avp-workflow/cases/${caseId()}`, {
        ...base(),
        version: 1,
        evidenceId: "a".repeat(64),
      });
      const response = await POST(request({ record: { ...base(), ...confirmation }, version: 1 }));
      expect(response.status).toBe(400);
      expect(mocks.writes).not.toHaveBeenCalled();
      expect(mocks.deletes).not.toHaveBeenCalled();
    }
  );
  it.each(["456", ""])(
    "permite reutilizar 123 depois de alterar para %s sem perder histórico",
    async (socOrder) => {
      const first = { ...base(), socOrder: "123" };
      const initial = await POST(request({ record: first, version: 0 }));
      expect(initial.status).toBe(200);
      const { record: before } = await initial.json();
      const history = `webhook_deliveries/grupo-avp-workflow/cases/${before.id}/history`;
      expect((await POST(request({ record: { ...base(), socOrder }, version: 1 }))).status).toBe(
        200
      );
      expect(mocks.data.has(orderPath("123"))).toBe(false);
      const other = { ...base(), sourceId: "campaign-2", socOrder: "123" };
      const response = await POST(request({ record: other, version: 0 }));
      expect(response.status).toBe(200);
      const { record: second } = await response.json();
      expect(mocks.data.get(orderPath("123"))?.caseId).toBe(second.id);
      expect(mocks.data.get(`${history}/1`)).toEqual(before);
      expect(mocks.data.get(`${history}/2`)).toMatchObject({
        socOrder,
        version: 2,
        updatedBy: "operator",
      });
    }
  );
  it("não libera a reserva nem grava histórico quando o novo pedido está ocupado", async () => {
    expect(
      (await POST(request({ record: { ...base(), socOrder: "123" }, version: 0 }))).status
    ).toBe(200);
    mocks.data.set(orderPath("456"), { caseId: "outro" });
    const before = structuredClone(mocks.data);
    expect(
      (await POST(request({ record: { ...base(), socOrder: "456" }, version: 1 }))).status
    ).toBe(409);
    expect(mocks.data).toEqual(before);
    expect(mocks.deletes).not.toHaveBeenCalled();
  });
  it("mantém a reserva ao salvar o mesmo pedido e rejeita um segundo editor com versão antiga", async () => {
    const record = { ...base(), socOrder: "123" };
    expect((await POST(request({ record, version: 0 }))).status).toBe(200);
    expect((await POST(request({ record, version: 1 }))).status).toBe(200);
    const before = structuredClone(mocks.data);
    expect(
      (await POST(request({ record: { ...record, socOrder: "456" }, version: 1 }))).status
    ).toBe(409);
    expect(mocks.data).toEqual(before);
    expect(mocks.deletes).not.toHaveBeenCalled();
  });
  it("exige salvar a substituição antes de nova revisão e conserva a entrega antiga no histórico", async () => {
    const a = "a".repeat(64),
      b = "b".repeat(64);
    for (const id of [a, b])
      mocks.data.set(`webhook_deliveries/grupo-avp-evidence/records/${id}`, {
        kind: "aso",
        uploaded: true,
        review: "Recebido",
        employee: base().employee,
      });
    const delivered = {
      ...base(),
      stage: "delivered",
      identityChecked: true,
      socCheck: "existing-order",
      socReference: "consulta sintética",
      socOrder: "123",
      clinic: "Clínica Teste",
      clinicEmail: "clinica@example.test",
      owner: "operator",
      scheduledDate: "2026-10-20",
      attendedDate: "2026-10-20",
      dueDate: "2026-10-23",
      coordinator: "Teste",
      coordinatorEmail: "coordenador@example.test",
      evidenceId: a,
      documentChecked: true,
      deliveryReference: "envio sintético antigo",
    };
    expect((await POST(request({ record: delivered, version: 0 }))).status).toBe(200);
    const previous = structuredClone(mocks.data);
    expect(
      (await POST(request({ record: { ...delivered, evidenceId: b }, version: 1 }))).status
    ).toBe(400);
    expect(mocks.data).toEqual(previous);
    const replacement = {
      ...delivered,
      evidenceId: b,
      stage: "review",
      documentChecked: false,
      deliveryReference: "",
    };
    const response = await POST(request({ record: replacement, version: 1 }));
    expect(response.status).toBe(200);
    const { record: saved } = await response.json();
    expect(saved).toMatchObject({
      evidenceId: b,
      documentChecked: false,
      deliveryReference: "",
      stage: "review",
      version: 2,
    });
    const history = `webhook_deliveries/grupo-avp-workflow/cases/${saved.id}/history`;
    expect(mocks.data.get(`${history}/1`)).toMatchObject({
      evidenceId: a,
      documentChecked: true,
      deliveryReference: delivered.deliveryReference,
    });
    expect(
      (await POST(request({ record: { ...replacement, stage: "ready" }, version: 2 }))).status
    ).toBe(400);
    expect(
      (
        await POST(
          request({ record: { ...replacement, stage: "ready", documentChecked: true }, version: 2 })
        )
      ).status
    ).toBe(200);
    expect(
      (
        await POST(
          request({
            record: { ...replacement, stage: "delivered", documentChecked: true },
            version: 3,
          })
        )
      ).status
    ).toBe(400);
  });
});
