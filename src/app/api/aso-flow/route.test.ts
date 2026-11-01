// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  list: vi.fn(),
  preview: vi.fn(),
  imports: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/services/aso-flow", () => ({
  requireAsoFlowAccess: m.access,
  listAsoFlowCards: m.list,
  previewAsoFlowImport: m.preview,
  importAsoFlowRows: m.imports,
  updateAsoFlowCard: m.update,
}));
import { GET, POST } from "./route";
const request = (body: unknown) =>
  new NextRequest("https://nai.example.test/api/aso-flow", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ uid: "operator" });
  m.list.mockResolvedValue({ cards: [], nextCursor: null });
  m.access.mockReturnValue(undefined);
});
it("exige autenticação antes de ler ou importar identificações", async () => {
  m.auth.mockRejectedValue(new AuthError("Entre novamente", 401));
  expect((await GET(new NextRequest("https://nai.example.test/api/aso-flow"))).status).toBe(401);
  expect((await POST(request({ action: "import", rows: [] }))).status).toBe(401);
  expect(m.list).not.toHaveBeenCalled();
  expect(m.imports).not.toHaveBeenCalled();
});
it("nega acesso antes de processar upload JSON e mantém respostas privadas", async () => {
  m.access.mockImplementation(() => {
    throw new AuthError("Restrito", 403);
  });
  const denied = await POST(request({ action: "preview", rows: [] }));
  expect(denied.status).toBe(403);
  expect(m.preview).not.toHaveBeenCalled();
  expect(denied.headers.get("cache-control")).toBe("private, no-store");
});
it("limita tamanho efetivo de corpo mesmo sem Content-Length", async () => {
  const response = await POST(request({ action: "preview", sourceName: "x".repeat(750001) }));
  expect(response.status).toBe(413);
  expect(m.preview).not.toHaveBeenCalled();
});
it("não transforma falhas internas em confirmação de sucesso ou expõe detalhes", async () => {
  m.update.mockRejectedValue(new Error("private-provider-payload"));
  const response = await POST(request({ action: "schedule" }));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private-provider-payload");
});
