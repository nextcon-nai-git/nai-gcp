import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ fail: false }));
vi.mock("@/actions/banks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/actions/banks")>();
  return {
    consultarBancosBrasil: (...args: Parameters<typeof actual.consultarBancosBrasil>) => {
      if (m.fail) throw new Error("internal sensitive details");
      return actual.consultarBancosBrasil(...args);
    },
  };
});
import { GET, OPTIONS } from "./route";
const fetchMock = vi.fn();
beforeEach(() => {
  m.fail = false;
  fetchMock
    .mockReset()
    .mockResolvedValue(
      new Response(
        JSON.stringify([
          { code: 1, ispb: "00000000", name: "Banco sintético", fullName: "Banco sintético" },
        ])
      )
    );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
describe("Public bank query validation", () => {
  it.each([
    "code=abc",
    "code=1234",
    "ispb=abcdef",
    "ispb=123456789",
    "limit=1.2",
    "limit=2x",
    "limit=-1",
    "limit=0",
    "limit=9007199254740992",
    "offset=2x",
    "offset=0.5",
    "offset=-1",
    "limit=",
    "offset=",
  ])("returns a readable cross-origin client error for %s", async (query) => {
    const r = await GET(new Request("https://example.com/api/v1/bancos?" + query));
    expect(r.status).toBe(400);
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect((await r.json()).sucesso).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("preserves valid padded COMPE and pagination results", async () => {
    const r = await GET(
      new Request("https://example.com/api/v1/bancos?code=001&limit=10&offset=0")
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect(await r.json()).toMatchObject({
      sucesso: true,
      total: 1,
      limit: 10,
      offset: 0,
      bancos: [{ code: 1 }],
    });
  });
  it("distinguishes server failure and retains CORS without exposing internals", async () => {
    m.fail = true;
    const r = await GET(new Request("https://example.com/api/v1/bancos"));
    expect(r.status).toBe(500);
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect(await r.text()).not.toContain("sensitive");
  });
  it("answers preflight with the same public origin policy", async () => {
    const r = await OPTIONS();
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
  });
});
