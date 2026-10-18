// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  receiveRdWebhook,
  normalizeRdPhone,
  rdPayloadShape,
  type RdWebhookConfig,
} from "./rd-conversas-webhook";
const secret = "synthetic-secret-".repeat(3),
  phone = "5541999999999";
const payload = () => ({
  direction: "inbound",
  phone,
  message_id: "synthetic-id",
  message: "Mensagem sintética",
});
let config: RdWebhookConfig;
const req = (value: unknown, headers: Record<string, string> = {}) =>
  new Request("https://test.invalid/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-nai-webhook-secret": secret, ...headers },
    body: JSON.stringify(value),
  });
beforeEach(() => {
  config = {
    secret,
    allowedPhones: [phone],
    save: vi.fn().mockResolvedValue(true),
    diagnose: vi.fn(),
  };
});
describe("RD receipt boundary", () => {
  it.each([
    ["+55 (41) 99999-9999", phone],
    ["41999999999", ""],
    ["55/41999999999", ""],
    [null, ""],
    [123, ""],
  ])("normalizes only explicit country-coded phone %s", (v, w) =>
    expect(normalizeRdPhone(v)).toBe(w)
  );
  it.each([
    [undefined, 503],
    ["short", 503],
  ])("requires configured secret %s", async (s, status) => {
    config.secret = s;
    expect((await receiveRdWebhook(req(payload()), config)).status).toBe(status);
    expect(config.save).not.toHaveBeenCalled();
  });
  it.each(["wrong", "x".repeat(1025), ""])("rejects invalid auth before save", async (value) => {
    expect(
      (await receiveRdWebhook(req(payload(), { "x-nai-webhook-secret": value }), config)).status
    ).toBe(401);
    expect(config.save).not.toHaveBeenCalled();
  });
  it("requires allowed contacts and JSON media type", async () => {
    config.allowedPhones = [];
    expect((await receiveRdWebhook(req(payload()), config)).status).toBe(503);
    config.allowedPhones = [phone];
    expect(
      (await receiveRdWebhook(req(payload(), { "content-type": "text/plain" }), config)).status
    ).toBe(415);
  });
  it.each([null, [], "text", 12])("rejects non-object envelopes %s", async (p) => {
    expect((await receiveRdWebhook(req(p), config)).status).toBe(422);
    expect(config.save).not.toHaveBeenCalled();
  });
  it.each([{ direction: "outbound" }, { sent_by: "operator" }, { sent_by: "bot" }])(
    "ignores outgoing %j",
    async (fields) => {
      const r = await receiveRdWebhook(req({ ...payload(), ...fields }), config);
      expect(await r.json()).toMatchObject({ accepted: false, reason: "outgoing" });
      expect(config.save).not.toHaveBeenCalled();
    }
  );
  it.each([
    { direction: "unknown" },
    { phone: "invalid" },
    { message_id: "" },
    { message: "" },
    { message: "x".repeat(16001) },
  ])("rejects invalid message fields %j", async (fields) => {
    expect((await receiveRdWebhook(req({ ...payload(), ...fields }), config)).status).toBe(422);
    expect(config.save).not.toHaveBeenCalled();
  });
  it("ignores a contact outside the authorized portfolio", async () => {
    const r = await receiveRdWebhook(req({ ...payload(), phone: "5511999999999" }), config);
    expect(await r.json()).toMatchObject({ reason: "outside_avp" });
    expect(config.save).not.toHaveBeenCalled();
  });
  it("stores flat and nested envelopes under stable idempotency keys", async () => {
    await receiveRdWebhook(req(payload()), config);
    await receiveRdWebhook(
      req({
        data: {
          sent_by: "customer",
          customer: { cel_phone: phone },
          message: { _id: "synthetic-id", content: "Mensagem sintética" },
        },
      }),
      config
    );
    const save = vi.mocked(config.save);
    expect(save.mock.calls[0][0]).toBe(save.mock.calls[1][0]);
    expect(save.mock.calls[0][1]).toMatchObject({
      messageId: "synthetic-id",
      phone,
      text: "Mensagem sintética",
    });
  });
  it("acknowledges duplicates without creating a second record", async () => {
    vi.mocked(config.save).mockResolvedValue(false);
    const r = await receiveRdWebhook(req(payload()), config);
    expect(await r.json()).toEqual({ accepted: true, duplicate: true });
  });
  it("returns retryable failure on storage errors without leaking details", async () => {
    vi.mocked(config.save).mockRejectedValue(new Error("private value"));
    const r = await receiveRdWebhook(req(payload()), config);
    expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toContain("private value");
  });
  it("does not turn diagnostic failure into a failed receipt", async () => {
    vi.mocked(config.diagnose!).mockRejectedValue(Error("diagnostic"));
    expect((await receiveRdWebhook(req(payload()), config)).status).toBe(200);
  });
  it("validates completed ASO adapter and request id", async () => {
    const body = {
      event: "aso.request.completed",
      phone,
      request_id: "r",
      aso_request: { synthetic: true },
    };
    expect((await receiveRdWebhook(req(body), config)).status).toBe(422);
    config.parseCompletedAso = () => "ASO sintético";
    expect((await receiveRdWebhook(req({ ...body, request_id: "" }), config)).status).toBe(422);
    expect((await receiveRdWebhook(req(body), config)).status).toBe(200);
    expect(config.save).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ messageId: "aso-request:r", text: "ASO sintético" })
    );
  });
  it("bounds streamed size even without a trustworthy content length", async () => {
    expect(
      (
        await receiveRdWebhook(
          req({ message: "x".repeat(65537) }, { "content-length": "1" }),
          config
        )
      ).status
    ).toBe(413);
    expect(config.save).not.toHaveBeenCalled();
  });
  it("rejects invalid JSON and missing body", async () => {
    const headers = { "x-nai-webhook-secret": secret, "content-type": "application/json" };
    expect(
      (
        await receiveRdWebhook(
          new Request("https://test.invalid", { method: "POST", headers, body: "{" }),
          config
        )
      ).status
    ).toBe(400);
    expect(
      (
        await receiveRdWebhook(
          new Request("https://test.invalid", { method: "POST", headers }),
          config
        )
      ).status
    ).toBe(400);
  });
  it("diagnostic inventory omits values, redacts secrets, and bounds breadth", () => {
    const shape = rdPayloadShape({
      name: "PRIVATE",
      secret: { value: "SECRET" },
      nested: [{ phone: "PHONE" }],
      ...Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`key${i}`, "VALUE"])),
    });
    expect(shape.length).toBeLessThanOrEqual(100);
    expect(shape.join()).not.toMatch(/PRIVATE|SECRET|PHONE|VALUE/);
    expect(shape).toContain("$.secret:redacted");
  });
});
