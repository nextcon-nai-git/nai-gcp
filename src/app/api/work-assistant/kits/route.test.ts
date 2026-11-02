// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  prepare: vi.fn(),
  confirm: vi.fn(),
  catalog: vi.fn(),
  download: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/services/operational-kits", () => ({
  prepareKitBatch: m.prepare,
  confirmKitBatch: m.confirm,
  getKitCatalog: m.catalog,
  downloadKit: m.download,
}));
import { GET, POST } from "./route";
const request = (body: unknown) =>
  new NextRequest("https://nai.test/api/work-assistant/kits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const command = {
  action: "confirm",
  companyId: "ONE",
  proposalId: "11111111-1111-4111-8111-111111111111",
  reviewed: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ uid: "u1" });
  m.confirm.mockResolvedValue([]);
});
describe("kit API", () => {
  it("requires authentication before any access", async () => {
    m.auth.mockRejectedValue(new AuthError("Login", 401));
    expect(
      (await GET(new NextRequest("https://nai.test/api/work-assistant/kits?companyId=ONE"))).status
    ).toBe(401);
    expect((await POST(request(command))).status).toBe(401);
    expect(m.catalog).not.toHaveBeenCalled();
    expect(m.confirm).not.toHaveBeenCalled();
  });
  it.each([
    { reviewed: false },
    { reviewed: undefined },
    { selection: { exams: ["forged"] } },
    { companyId: "../OTHER" },
  ])(
    "requires explicit confirmation and rejects tampered confirmation bodies %o",
    async (patch) => {
      expect((await POST(request({ ...command, ...patch }))).status).toBe(400);
      expect(m.confirm).not.toHaveBeenCalled();
    }
  );
  it("passes only authenticated actor, company and saved proposal to confirmation", async () => {
    const result = await POST(request(command));
    expect(result.status).toBe(200);
    expect(m.confirm).toHaveBeenCalledWith({ uid: "u1" }, "ONE", command.proposalId);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("does not expose internal failure details", async () => {
    m.confirm.mockRejectedValue(Error("private secret"));
    const result = await POST(request(command));
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain("private secret");
  });
  it("returns authenticated binary PDF without a public token URL", async () => {
    m.download.mockResolvedValue({ bytes: Buffer.from("%PDF-test"), filename: "Kit-Teste.pdf" });
    const r = await GET(
      new NextRequest("https://nai.test/api/work-assistant/kits?companyId=ONE&download=kit-1")
    );
    expect(r.headers.get("Content-Type")).toBe("application/pdf");
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(m.download).toHaveBeenCalledWith({ uid: "u1" }, "ONE", "kit-1");
  });
});
