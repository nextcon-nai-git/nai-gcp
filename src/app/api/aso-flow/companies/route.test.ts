// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  current: vi.fn(),
  collection: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(),
  select: vi.fn(),
  limit: vi.fn(),
  doc: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/services/aso-flow", () => ({
  requireAsoFlowAccess: m.access,
  currentAsoFlowUser: m.current,
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: m.collection, getAll: m.getAll },
}));
import { GET } from "./route";
const request = () => new NextRequest("https://nai.example.test/api/aso-flow/companies");
const company = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  exists: true,
  data: () => ({ name, active: true, ...extra }),
});
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({
    uid: "operator",
    role: "SUPER_ADMIN",
    tenantId: null,
    servedCompanies: [],
  });
  m.access.mockReturnValue(undefined);
  m.current.mockImplementation(async () => m.auth());
  const query = { select: m.select, limit: m.limit, get: m.get, doc: m.doc };
  m.collection.mockReturnValue(query);
  m.select.mockReturnValue(query);
  m.limit.mockReturnValue(query);
  m.doc.mockImplementation((id: string) => ({ id }));
  m.get.mockResolvedValue({
    size: 1,
    docs: [
      company("company-test", "Cliente teste", {
        cnpj: "not-for-response",
        email: "private@example.invalid",
        cpf: "not-for-response",
      }),
    ],
  });
});
it("nega acesso antes de consultar clientes e mantém resposta privada", async () => {
  m.access.mockImplementation(() => {
    throw new AuthError("Restrito", 403);
  });
  const response = await GET(request());
  expect(response.status).toBe(403);
  expect(m.collection).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("retorna apenas id, nome e situação sem expor contatos ou documentos", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    companies: [{ id: "company-test", name: "Cliente teste", active: true }],
    requiresSelection: false,
  });
  expect(m.select).toHaveBeenCalledWith("name", "active", "isDeleted");
});
it("consulta somente IDs autorizados e permite selecionar carteiras com mais de30 clientes", async () => {
  const ids = Array.from({ length: 31 }, (_, i) => `company-${i}`);
  m.auth.mockResolvedValue({
    uid: "operator",
    role: "OPERATIONS",
    tenantId: null,
    servedCompanies: ids,
  });
  m.getAll.mockResolvedValue(ids.map((id) => company(id, id)));
  const response = await GET(request());
  const data = await response.json();
  expect(data.requiresSelection).toBe(true);
  expect(data.companies).toHaveLength(31);
  expect(m.get).not.toHaveBeenCalled();
  expect(m.getAll.mock.calls[0].slice(0, -1)).toEqual(ids.map((id) => ({ id })));
  expect(m.getAll.mock.calls[0].at(-1)).toEqual({ fieldMask: ["name", "active", "isDeleted"] });
});
it("não consulta uma coleção inteira quando não há clientes autorizados", async () => {
  m.auth.mockResolvedValue({
    uid: "operator",
    role: "DOCTOR",
    tenantId: null,
    servedCompanies: [],
  });
  const response = await GET(request());
  expect(await response.json()).toEqual({ companies: [], requiresSelection: false });
  expect(m.collection).not.toHaveBeenCalled();
  expect(m.getAll).not.toHaveBeenCalled();
});
it("não libera o diretório após revogação durante a consulta de clientes", async () => {
  m.get.mockImplementation(async () => {
    m.current.mockRejectedValue(new AuthError("Acesso revogado", 403));
    return { size: 1, docs: [company("company-test", "PRIVATE_COMPANY_NAME")] };
  });
  const response = await GET(request());
  expect(response.status).toBe(403);
  expect(await response.text()).not.toContain("PRIVATE_COMPANY_NAME");
});
