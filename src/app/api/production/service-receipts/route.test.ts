import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  central: vi.fn(),
  finance: vi.fn(),
  snapshot: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/services/production-central", () => ({ getProductionBook: mocks.central }));
vi.mock("@/services/financial-operations", () => ({
  getFinanceBook: mocks.finance,
  saveFinanceCommand: mocks.save,
}));
vi.mock("@/lib/production/service-receipts", () => ({
  buildServiceReceiptsSnapshot: mocks.snapshot,
}));
import { GET, POST } from "./route";

const url = "https://nai.test/api/production/service-receipts";
const get = (version = "4") => new NextRequest(`${url}?expectedVersion=${version}`);
const command = () => ({
  action: "allocateServiceTitle",
  id: "allocation1",
  requestId: randomUUID(),
  expectedVersion: 7,
  expectedCentralVersion: 4,
  reviewed: true,
  reason: "Conferência sintética aprovada",
  recordId: "record1",
  cycleId: "cycle1",
  taskId: "task1",
  sourceFingerprint: "a".repeat(64),
  titleId: "title1",
  amountCents: 10000,
  evidence: "Medição sintética aprovada",
});
const post = (body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ uid: "admin", role: "SUPER_ADMIN", tenantId: null });
  mocks.central.mockResolvedValue({ version: 4, records: [], audit: [] });
  mocks.finance.mockResolvedValue({ version: 7 });
  mocks.save.mockResolvedValue({ version: 8 });
  mocks.snapshot.mockImplementation((central, finance, generatedAt) => ({
    centralVersion: central.version,
    financeVersion: finance.version,
    generatedAt,
    items: [],
  }));
});

describe("service receipts API boundary", () => {
  it("returns a private versioned projection of the two current books", async () => {
    const response = await GET(get());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      centralVersion: 4,
      financeVersion: 7,
      generatedAt: expect.any(String),
      items: [],
    });
    expect(mocks.snapshot).toHaveBeenCalledWith(
      { version: 4, records: [], audit: [] },
      { version: 7 },
      expect.any(String)
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
  });

  it("rejects a stale Central before reading finance or projecting values", async () => {
    const response = await GET(get("3"));
    expect(response.status).toBe(409);
    expect(mocks.finance).not.toHaveBeenCalled();
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });

  it.each(["", "-1", "1.5", "01", "9007199254740992", "abc"])(
    "rejects invalid expected Central version %s",
    async (version) => {
      expect((await GET(get(version))).status).toBe(400);
      expect(mocks.central).not.toHaveBeenCalled();
      expect(mocks.finance).not.toHaveBeenCalled();
    }
  );

  it.each(["CLIENT_ADMIN", "OPERATIONS", "DOCTOR", "PROVIDER", "ADMIN"])(
    "denies %s before reading books or parsing a mutation",
    async (role) => {
      mocks.auth.mockResolvedValue({ uid: "limited", role, tenantId: "client" });
      expect((await GET(get())).status).toBe(403);
      expect(
        (
          await POST(
            new NextRequest(url, {
              method: "POST",
              headers: { "Content-Type": "text/plain" },
              body: "not json",
            })
          )
        ).status
      ).toBe(403);
      expect(mocks.central).not.toHaveBeenCalled();
      expect(mocks.finance).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
    }
  );

  it("saves a reviewed allocation through the shared financial service", async () => {
    const payload = command();
    const response = await POST(post(payload));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ book: { version: 8 } });
    expect(mocks.save).toHaveBeenCalledWith(
      { uid: "admin", role: "SUPER_ADMIN", tenantId: null },
      payload
    );
    expect(mocks.central).not.toHaveBeenCalled();
    expect(mocks.finance).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("does not accept unrelated financial mutations or an unreviewed association", async () => {
    expect(
      (
        await POST(
          post({
            action: "account",
            name: "Conta sintética",
            requestId: randomUUID(),
            expectedVersion: 7,
          })
        )
      ).status
    ).toBe(400);
    expect((await POST(post({ ...command(), reviewed: false }))).status).toBe(400);
    expect((await POST(post({ ...command(), unexpected: "field" }))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each([
    ["text/plain", "{}", 400],
    ["application/json", "{broken", 400],
    ["application/json", "x".repeat(256 * 1024 + 1), 413],
  ] as const)("bounds the mutation body (%s, %i)", async (contentType, body, status) => {
    expect(
      (
        await POST(
          new NextRequest(url, {
            method: "POST",
            headers: { "Content-Type": contentType },
            body,
          })
        )
      ).status
    ).toBe(status);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("preserves authentication and conflict errors without exposing internal details", async () => {
    mocks.auth.mockRejectedValueOnce(new AuthError("Sessão expirada", 401));
    expect((await GET(get())).status).toBe(401);
    mocks.save.mockRejectedValueOnce(new AuthError("Os dados mudaram", 409));
    expect((await POST(post(command()))).status).toBe(409);
    mocks.finance.mockRejectedValueOnce(new Error("private bucket credential details"));
    const failed = await GET(get());
    expect(failed.status).toBe(503);
    expect(JSON.stringify(await failed.json())).not.toContain("credential");
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
});
