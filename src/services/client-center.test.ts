import { beforeEach, describe, it, expect, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
const m = vi.hoisted(() => ({
  collection: vi.fn(),
  create: vi.fn(),
  previous: null as Record<string, unknown> | null,
  failEmployees: false,
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: m.collection,
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ get: async () => ({ exists: !!m.previous, data: () => m.previous }), create: m.create }),
  },
}));
import { createClientRequest, getClientCenter } from "./client-center";
const user: AuthContext = {
  uid: "u",
  email: "test@example.test",
  role: "CLIENT_ADMIN",
  tenantId: "a",
  permissions: [],
  servedCompanies: [],
};
const request = {
  companyId: "a",
  requestId: "11223344-1234-4234-8234-112233445566",
  department: "support",
  title: "Suporte ao sistema",
  description: "Preciso de apoio para o cadastro.",
  priority: "medium",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.previous = null;
  m.failEmployees = false;
  const sub = (name: string) => {
    const q = {
      select: () => q,
      orderBy: () => q,
      limit: () => q,
      doc: (id: string) => ({ id }),
      get: async () => {
        if (name === "employees" && m.failEmployees) throw new Error("private error");
        return {
          size: 1,
          docs: [
            {
              id: "x",
              data: () =>
                name === "employees"
                  ? {
                      name: "Colaborador",
                      cpf: "PRIVATE_CPF",
                      medicalHistory: "PRIVATE_HISTORY",
                      nextAsoDate: "2026-01-01",
                    }
                  : name === "tasks"
                    ? {
                        title: "Apoio",
                        sourceType: "client_request",
                        status: "todo",
                        description: "PRIVATE_DETAIL",
                      }
                    : { name: "Relatório", url: "PRIVATE_URL" },
            },
          ],
        };
      },
    };
    return q;
  };
  m.collection.mockReturnValue({
    doc: () => ({
      get: async () => ({
        exists: true,
        data: () => ({ name: "Empresa A", secret: "PRIVATE_SECRET" }),
      }),
      collection: sub,
    }),
  });
});
describe("Client center access and persistence", () => {
  it("blocks foreign tenants before any database read", async () => {
    await expect(getClientCenter(user, "b")).rejects.toMatchObject({ status: 403 });
    expect(m.collection).not.toHaveBeenCalled();
  });
  it("blocks global scope and guests", async () => {
    await expect(
      getClientCenter({ ...user, role: "SUPER_ADMIN", tenantId: null }, "all")
    ).rejects.toMatchObject({ status: 400 });
    await expect(getClientCenter({ ...user, role: "GUEST" }, "a")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("projects only administrative fields", async () => {
    const result = await getClientCenter(user, "a");
    expect(result.company.id).toBe("a");
    expect(result.requests).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
  });
  it("keeps failed source unknown instead of showing zero", async () => {
    m.failEmployees = true;
    const result = await getClientCenter(user, "a");
    expect(result.periodics).toBeNull();
    expect(result.issues).toHaveLength(1);
    expect(result.tasks).not.toBeNull();
  });
  it("creates a real operational card with session author and initial status", async () => {
    const result = await createClientRequest(user, request);
    expect(result.id).toBe(`portal_${request.requestId}`);
    expect(m.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        createdBy: "u",
        companyId: "a",
        status: "todo",
        sourceType: "client_request",
        dueDate: "",
        description: request.description,
      })
    );
  });
  it("retries the same request without creating duplicate cards", async () => {
    await createClientRequest(user, request);
    m.previous = m.create.mock.calls[0][1];
    m.create.mockClear();
    await createClientRequest(user, request);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("rejects a reused request ID with different content", async () => {
    await createClientRequest(user, request);
    m.previous = m.create.mock.calls[0][1];
    await expect(
      createClientRequest(user, { ...request, title: "Outro assunto" })
    ).rejects.toMatchObject({ status: 409 });
  });
  it("does not write a request for a foreign client", async () => {
    await expect(createClientRequest(user, { ...request, companyId: "b" })).rejects.toMatchObject({
      status: 403,
    });
    expect(m.create).not.toHaveBeenCalled();
  });
});
