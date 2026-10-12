import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  get: vi.fn(),
  catalog: vi.fn(),
  preview: vi.fn(),
  execute: vi.fn(),
  reconcile: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/services/omie-connectors", () => ({
  connectorOverview: m.get,
  connectorCatalog: m.catalog,
  previewConnectorExport: m.preview,
  executeConnectorExport: m.execute,
  reconcileConnectorExport: m.reconcile,
}));
import { GET, POST } from "./route";
const request = (body?: string) =>
  new NextRequest("https://example.test/api/financial/omie/connectors", {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ uid: "admin", role: "SUPER_ADMIN", tenantId: null });
});
describe("connector API", () => {
  it.each(["PROVIDER", "CLIENT_ADMIN", "DOCTOR"])(
    "blocks %s before accessing finance",
    async (role) => {
      m.auth.mockResolvedValue({ role, tenantId: null });
      expect((await GET(request())).status).toBe(403);
      expect((await POST(request("invalid"))).status).toBe(403);
      expect(m.get).not.toHaveBeenCalled();
      expect(m.execute).not.toHaveBeenCalled();
    }
  );
  it("does not accept arbitrary Omie methods or unbounded bodies", async () => {
    expect(
      (await POST(request(JSON.stringify({ action: "ExcluirCliente", data: {} })))).status
    ).toBe(400);
    expect((await POST(request(" ".repeat(65537)))).status).toBe(413);
    expect(m.execute).not.toHaveBeenCalled();
  });
  it("routes preview without executing and keeps responses private", async () => {
    m.preview.mockResolvedValue({ hash: "synthetic" });
    const r = await POST(request(JSON.stringify({ action: "preview", data: {} })));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(m.preview).toHaveBeenCalledOnce();
    expect(m.execute).not.toHaveBeenCalled();
  });
});
