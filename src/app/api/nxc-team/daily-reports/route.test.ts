import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(),
  create: vi.fn(),
  existing: false,
  text: "",
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mock.auth }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({ doc: (id: string) => ({ id }) }),
    runTransaction: mock.transaction,
  },
}));
import { POST } from "./route";
const body = {
  employeeName: "Kelly Tassiane",
  contractType: "CLT",
  date: "2026-10-07",
  reportText: "- NF enviada\n- Aguardando retorno",
};
const req = () =>
  new NextRequest("https://nai.example/api/nxc-team/daily-reports", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.existing = false;
  mock.text = "";
  mock.auth.mockResolvedValue({ uid: "admin", role: "SUPER_ADMIN" });
  mock.transaction.mockImplementation((fn) =>
    fn({
      get: async () => ({ exists: mock.existing, data: () => ({ reportText: mock.text }) }),
      create: mock.create,
    })
  );
});
describe("Daily reports write boundary", () => {
  it("blocks tenant administrators", async () => {
    mock.auth.mockResolvedValue({ role: "ADMIN", tenantId: "client" });
    expect((await POST(req())).status).toBe(403);
    expect(mock.transaction).not.toHaveBeenCalled();
  });
  it("saves explicit date and text with author audit", async () => {
    expect((await POST(req())).status).toBe(200);
    expect(mock.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ...body,
        activities: ["NF enviada", "Aguardando retorno"],
        recordedBy: "admin",
      })
    );
  });
  it("does not overwrite a different existing report", async () => {
    mock.existing = true;
    mock.text = "Outro relato";
    expect((await POST(req())).status).toBe(409);
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("retries the same submission without duplicates", async () => {
    mock.existing = true;
    mock.text = body.reportText;
    expect((await POST(req())).status).toBe(200);
    expect(mock.create).not.toHaveBeenCalled();
  });
});
