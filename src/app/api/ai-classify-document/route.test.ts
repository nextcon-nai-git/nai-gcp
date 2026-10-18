import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: auth }));
import { GET, POST } from "./route";
import { GET as saveGET, POST as savePOST } from "./save/route";

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ uid: "test-reviewer" });
});

describe("retirada do classificador legado sem dados presumidos", () => {
  it.each([GET, POST, saveGET, savePOST])(
    "orienta a usar o fluxo vigente sem ler o arquivo",
    async (handler) => {
      const request = new NextRequest("https://nai.example/api/ai-classify-document", {
        method: "POST",
        body: JSON.stringify({ fileName: "ASO_CETESB.pdf", activeClientName: "Empresa da sessão" }),
      });
      const readBody = vi.spyOn(request, "json");
      const response = await handler(request);
      expect(response.status).toBe(410);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toMatchObject({
        success: false,
        code: "ENDPOINT_RETIRED",
        destinationRoute: "/nai-importa",
      });
      expect(readBody).not.toHaveBeenCalled();
      expect(request.bodyUsed).toBe(false);
    }
  );

  it.each([401, 403])("preserva a negativa de acesso %i", async (status) => {
    auth.mockRejectedValue(new AuthError("Acesso negado", status));
    const response = await POST(new NextRequest("https://nai.example/api/ai-classify-document"));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: "Acesso negado" });
  });

  it("não expõe informações internas quando a autenticação está indisponível", async () => {
    auth.mockRejectedValue(new Error("credential-private-diagnostic"));
    const response = await POST(new NextRequest("https://nai.example/api/ai-classify-document"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("credential-private-diagnostic");
  });
});
