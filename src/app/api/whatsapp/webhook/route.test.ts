// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const processMessage = vi.hoisted(() => vi.fn());
vi.mock("@/ai/flows/whatsapp-agent-flow", () => ({ processWhatsappMessage: processMessage }));
import { POST } from "./route";

function request(body: string, authorized = true, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/whatsapp/webhook", {
    method: "POST",
    body,
    headers: { ...(authorized ? { authorization: "Bearer synthetic-secret" } : {}), ...headers },
  });
}
beforeEach(() => {
  vi.stubEnv("WHATSAPP_WEBHOOK_SECRET", "synthetic-secret");
  processMessage.mockReset();
  processMessage.mockResolvedValue({ replyText: "Resposta simulada", isHumanHandoff: false });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("WhatsApp webhook input boundary", () => {
  it("rejects unauthorized requests before parsing or processing", async () => {
    expect((await POST(request("invalid", false))).status).toBe(401);
    vi.stubEnv("WHATSAPP_WEBHOOK_SECRET", "");
    expect((await POST(request("{}"))).status).toBe(401);
    expect(processMessage).not.toHaveBeenCalled();
  });
  it.each([
    "{",
    "null",
    "[]",
    JSON.stringify({ phone: 5541999999999, message: "menu" }),
    JSON.stringify({ phone: "5541999999999", message: {} }),
    JSON.stringify({ phone: "5541999999999", message: "   " }),
    JSON.stringify({ phone: "5541999999999", message: "x".repeat(16001) }),
    JSON.stringify({ data: { key: { remoteJid: {} }, message: { conversation: "menu" } } }),
    JSON.stringify({
      data: { key: { remoteJid: "123456789@g.us" }, message: { conversation: "menu" } },
    }),
  ])("rejects malformed payload without invoking AI: %s", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(processMessage).not.toHaveBeenCalled();
  });
  it.each<Record<string, string>>([{}, { "content-length": "1" }, { "content-length": "9999999" }])(
    "bounds payload bytes even without a trustworthy length header",
    async (headers) => {
      expect((await POST(request(" ".repeat(65537), true, headers))).status).toBe(413);
      expect(processMessage).not.toHaveBeenCalled();
    }
  );
  it.each([
    { phone: "5541999999999", message: " menu " },
    {
      data: {
        key: { remoteJid: "5541999999999@s.whatsapp.net" },
        message: { conversation: "menu" },
      },
    },
    {
      data: {
        key: { remoteJid: "5541999999999@s.whatsapp.net" },
        message: { extendedTextMessage: { text: "menu" } },
      },
    },
    {
      entry: [
        { changes: [{ value: { messages: [{ from: "5541999999999", text: { body: "menu" } }] } }] },
      ],
    },
  ])("preserves supported message formats without sending messages", async (body) => {
    const response = await POST(request(JSON.stringify(body)));
    expect(response.status).toBe(200);
    expect(processMessage).toHaveBeenCalledExactlyOnceWith("menu", "5541999999999");
    expect(await response.json()).toMatchObject({ success: true, replyText: "Resposta simulada" });
  });
  it("does not disclose provider errors in responses or logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    processMessage.mockRejectedValue(new Error("sensitive-internal-token-and-patient-data"));
    const response = await POST(
      request(JSON.stringify({ phone: "5541999999999", message: "menu" }))
    );
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("sensitive-internal");
    expect(JSON.stringify(log.mock.calls)).not.toContain("sensitive-internal");
  });
});
