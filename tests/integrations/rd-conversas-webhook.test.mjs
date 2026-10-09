import test from "node:test";
import assert from "node:assert/strict";
import {
  receiveRdWebhook,
  normalizeRdPhone,
} from "../../src/lib/integrations/rd-conversas-webhook.ts";

const secret = "s".repeat(64);
const phone = "5511999990000"; // synthetic test data
const payload = { direction: "inbound", phone, message_id: "m1", message: "Agendamento de exame" };
const req = (body = payload, headers = {}) =>
  new Request("https://example.test/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-nai-webhook-secret": secret, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
function setup(overrides = {}) {
  const stored = new Map();
  return {
    stored,
    config: {
      secret,
      allowedPhones: [phone],
      save: async (key, value) => {
        if (stored.has(key)) return false;
        stored.set(key, value);
        return true;
      },
      ...overrides,
    },
  };
}
test("normalizes exact numbers without adding digits", () => {
  assert.equal(normalizeRdPhone("+55 (11) 99999-0000"), phone);
  assert.equal(normalizeRdPhone("551199990000"), "551199990000");
  assert.equal(normalizeRdPhone("bad"), "");
});
test("missing configuration fails closed", async () => {
  for (const config of [{ secret: undefined }, { secret: "short" }, { allowedPhones: [] }]) {
    const s = setup(config);
    assert.equal((await receiveRdWebhook(req(), s.config)).status, 503);
    assert.equal(s.stored.size, 0);
  }
});
test("wrong or absent header rejected", async () => {
  for (const value of ["", "wrong", "s".repeat(65)]) {
    const s = setup();
    assert.equal(
      (await receiveRdWebhook(req(payload, { "x-nai-webhook-secret": value }), s.config)).status,
      401
    );
    assert.equal(s.stored.size, 0);
  }
});
test("stores authorized incoming message once on repeated delivery", async () => {
  const s = setup();
  assert.deepEqual(await (await receiveRdWebhook(req(), s.config)).json(), {
    accepted: true,
    duplicate: false,
  });
  assert.deepEqual(await (await receiveRdWebhook(req(), s.config)).json(), {
    accepted: true,
    duplicate: true,
  });
  assert.equal(s.stored.size, 1);
  const stored = [...s.stored.values()][0];
  assert.equal(stored.text, payload.message);
});
test("nested adapter stores customer message", async () => {
  const s = setup();
  const r = await receiveRdWebhook(
    req({
      data: {
        sent_by: "customer",
        customer: { cel_phone: phone },
        message: { id: "nested", text: "Olá" },
      },
    }),
    s.config
  );
  assert.equal(r.status, 200);
  assert.equal(s.stored.size, 1);
});
test("outside AVP and outgoing messages ignored", async () => {
  for (const body of [
    { ...payload, phone: "5521999990000" },
    { ...payload, direction: "outbound" },
    { ...payload, sent_by: "operator" },
  ]) {
    const s = setup();
    const r = await receiveRdWebhook(req(body), s.config);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).accepted, false);
    assert.equal(s.stored.size, 0);
  }
});
test("unknown direction, missing ID, empty text, array rejected", async () => {
  for (const body of [
    { ...payload, direction: undefined },
    { ...payload, message_id: undefined },
    { ...payload, message: "" },
    [],
  ]) {
    const s = setup();
    assert.equal((await receiveRdWebhook(req(body), s.config)).status, 422);
    assert.equal(s.stored.size, 0);
  }
});
test("invalid JSON and content type rejected", async () => {
  const s = setup();
  assert.equal((await receiveRdWebhook(req("{"), s.config)).status, 400);
  assert.equal(
    (await receiveRdWebhook(req(payload, { "content-type": "text/plain" }), s.config)).status,
    415
  );
});
test("oversized body rejected even without content-length", async () => {
  const s = setup();
  assert.equal((await receiveRdWebhook(req("x".repeat(65537)), s.config)).status, 413);
});
test("database failure returns retryable 503 without exposing exception", async () => {
  const s = setup({
    save: async () => {
      throw new Error("private backend details");
    },
  });
  const r = await receiveRdWebhook(req(), s.config);
  assert.equal(r.status, 503);
  assert.ok(!(await r.text()).includes("private"));
});
