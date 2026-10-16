// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Papa from "papaparse";
import { AuthError } from "@/lib/auth/errors";
import { convocationFields, CONVOCATION_MAX_BYTES } from "@/lib/integrations/soc-convocations";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  batchSet: vi.fn(),
  commit: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/lib/firebase-admin", () => {
  const ref = { get: m.get, set: m.set, collection: () => ({ doc: () => ref }) };
  return {
    adminDb: {
      collection: () => ({ doc: () => ref }),
      batch: () => ({ set: m.batchSet, commit: m.commit }),
    },
  };
});
import { GET, POST } from "./route";
const row = {
  ...Object.fromEntries(convocationFields.map((f) => [f, ""])),
  "Código Funcionario": "001",
  "CNPJ DA UNIDADE": "11.918.109/0008-03",
  Nome: "Exemplo",
  UNIDADE: "AESA",
  Exame: "Clínico",
};
const request = (body = Papa.unparse([row])) =>
  new NextRequest("https://nai.test/api/integrations/soc/convocations", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body,
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ uid: "admin", role: "ADMIN", tenantId: null });
  m.get.mockResolvedValue({ exists: false });
});
describe("convocation import access and persistence", () => {
  it("rejects unauthenticated access and client tenants before storage", async () => {
    m.auth.mockRejectedValue(new AuthError("Entre novamente", 401));
    expect((await GET(request())).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    m.auth.mockResolvedValue({ role: "ADMIN", tenantId: "client" });
    expect((await GET(request())).status).toBe(403);
    expect((await POST(request())).status).toBe(403);
    expect(m.get).not.toHaveBeenCalled();
    expect(m.commit).not.toHaveBeenCalled();
  });
  it("allows internal operations to read but not import", async () => {
    m.auth.mockResolvedValue({ role: "OPERATIONS", tenantId: null });
    expect((await GET(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(403);
  });
  it("rejects invalid or oversized CSV without mutation", async () => {
    expect((await POST(request("wrong\nlayout"))).status).toBe(400);
    expect((await POST(request("x".repeat(CONVOCATION_MAX_BYTES + 1)))).status).toBe(413);
    expect(m.commit).not.toHaveBeenCalled();
  });
  it("only publishes the pointer after committing validated chunks", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(m.batchSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ rows: [row] })
    );
    expect(m.set).toHaveBeenCalledWith(
      expect.objectContaining({ group: "GRUPO_AVP", importedBy: "admin" })
    );
    expect(m.commit.mock.invocationCallOrder[0]).toBeLessThan(m.set.mock.invocationCallOrder[0]);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not publish a partial import after a batch failure", async () => {
    m.commit.mockRejectedValue(Error("unavailable"));
    expect((await POST(request())).status).toBe(500);
    expect(m.set).not.toHaveBeenCalled();
  });
});
