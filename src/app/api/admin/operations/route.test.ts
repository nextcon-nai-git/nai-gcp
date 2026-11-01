// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";

const m = vi.hoisted(() => ({ auth: vi.fn(), status: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/services/operational-runs", () => ({ getOperationalStatus: m.status }));
import { GET } from "./route";

const actor = { uid: "synthetic-admin", role: "SUPER_ADMIN", tenantId: null };
const request = () => new NextRequest("https://nai.example.test/api/admin/operations");
beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue(actor); });

describe("read-only operational evidence endpoint", () => {
  it("requires a current authenticated profile before consulting evidence", async () => {
    m.auth.mockRejectedValue(new AuthError("Autenticação necessária.", 401));
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(m.status).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("preserves the global administrator restriction", async () => {
    m.status.mockRejectedValue(new AuthError("Administração global necessária.", 403));
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(m.status).toHaveBeenCalledWith(actor);
  });
  it("returns recorded evidence with private, non-cacheable headers", async () => {
    const status = { generatedAt: "2026-11-01T16:00:00.000Z", controls: { esocialTransmissionBlocked: true, clientEmailBlocked: true }, operations: [] };
    m.status.mockResolvedValue(status);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(m.status).toHaveBeenCalledOnce();
  });
  it("does not expose database or credential errors", async () => {
    m.status.mockRejectedValue(new Error("private service-account clinical-name"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toMatch(/service-account|clinical-name/);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
