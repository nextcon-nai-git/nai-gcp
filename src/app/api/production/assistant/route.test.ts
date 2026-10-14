import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const mock = vi.hoisted(() => ({ auth: vi.fn(), generate: vi.fn(), read: vi.fn(), book: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mock.auth }));
vi.mock("@/ai/genkit", () => ({ ai: { generate: mock.generate } }));
vi.mock("@/services/production-central", () => ({
  readProductionSource: mock.read,
  getProductionBook: mock.book,
}));
import { POST } from "./route";
const req = (body: unknown) =>
  new NextRequest("https://nai.test/api/production/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ uid: "admin", role: "SUPER_ADMIN", tenantId: null });
  mock.book.mockResolvedValue({
    version: 2,
    records: [{ id: "r1", companyName: "Cliente autorizado", documents: [] }],
  });
  mock.generate.mockResolvedValue({ text: "Rascunho para revisão" });
});
describe("production agents boundary", () => {
  it("authenticates before reading body or invoking AI", async () => {
    mock.auth.mockRejectedValue(new AuthError("Sessão inválida", 401));
    const r = await POST(req({ action: "consult" }));
    expect(r.status).toBe(401);
    expect(mock.generate).not.toHaveBeenCalled();
    expect(mock.book).not.toHaveBeenCalled();
  });
  it("denies tenant users and operational access to the full financial context", async () => {
    mock.auth.mockResolvedValue({ role: "OPERATIONS", tenantId: null });
    const r = await POST(
      req({ action: "consult", stage: "operacional", recordId: "r1", question: "Revisar" })
    );
    expect(r.status).toBe(403);
    expect(mock.generate).not.toHaveBeenCalled();
  });
  it.each(["comercial", "operacional", "faturamento"])(
    "runs %s with server-resolved context and no action tools",
    async (stage) => {
      const r = await POST(
        req({ action: "consult", stage, recordId: "r1", question: "Revisar pendências" })
      );
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toBe("private, no-store");
      const options = mock.generate.mock.calls[0][0];
      expect(options.system).toContain("não tem ferramentas");
      expect(options.prompt).toContain("Cliente autorizado");
      expect(options.tools).toBeUndefined();
      expect(await r.json()).toMatchObject({ advisory: true, basedOnVersion: 2, stage });
    }
  );
  it("rejects injected context and unknown records", async () => {
    expect(
      (
        await POST(
          req({
            action: "consult",
            stage: "comercial",
            recordId: "r1",
            question: "Revisar",
            companyContext: "Outro cliente",
          })
        )
      ).status
    ).toBe(400);
    expect(
      (
        await POST(
          req({ action: "consult", stage: "comercial", recordId: "other", question: "Revisar" })
        )
      ).status
    ).toBe(400);
    expect(mock.generate).not.toHaveBeenCalled();
  });
  it("does not extract a source whose integrity was not verified", async () => {
    mock.read.mockRejectedValue(new AuthError("Fonte divergente", 400));
    const r = await POST(
      req({
        action: "extract",
        source: {
          sha256: "a".repeat(64),
          storagePath: "internos_nextcon/contract-sources/" + "a".repeat(64),
          generation: "1",
          sizeBytes: 100,
        },
      })
    );
    expect(r.status).toBe(400);
    expect(mock.generate).not.toHaveBeenCalled();
  });
  it("rejects oversized questions without invoking provider", async () => {
    expect(
      (
        await POST(
          req({
            action: "consult",
            stage: "comercial",
            recordId: "r1",
            question: "x".repeat(65536),
          })
        )
      ).status
    ).toBe(413);
    expect(mock.generate).not.toHaveBeenCalled();
  });
});
