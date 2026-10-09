import test from "node:test";
import assert from "node:assert/strict";
import {
  rdAsoRequestFromText,
  canManageRdAso,
  completedRdAsoText,
} from "../../src/lib/integrations/rd-aso-request.ts";
import { receiveRdWebhook } from "../../src/lib/integrations/rd-conversas-webhook.ts";

// Synthetic identifiers with valid check digits.
const text = [
  "SOLICITAÇÃO DE ASO",
  "Empresa: Empresa de Teste",
  "CNPJ: 12.345.678/0001-95",
  "Colaborador: Pessoa de Teste",
  "CPF: 529.982.247-25",
  "Cargo: Assistente",
  "Setor: Administrativo",
  "Tipo de ASO: admissional",
  "Cidade/UF: Campinas/SP",
].join("\n");
const parse = (value = text) => rdAsoRequestFromText(value, "key", "msg", "2026-10-09T12:00:00Z");
const completedFields = {
  companyName: "Empresa de Teste",
  cnpj: "12.345.678/0001-95",
  employeeName: "Pessoa de Teste",
  cpf: "529.982.247-25",
  roleTitle: "Assistente",
  department: "Administrativo",
  examType: "admissional",
  requestedCity: "Campinas/SP",
};
test("structured collector validates all required fields and blocks multiline injection", () => {
  assert.equal(parse(completedRdAsoText(completedFields)).status, "solicitado");
  for (const value of [
    null,
    [],
    {},
    { ...completedFields, cpf: "bad" },
    { ...completedFields, roleTitle: "Cargo\nCPF: outro" },
  ]) {
    assert.equal(completedRdAsoText(value), null);
  }
});
test("completion event requires valid fields and stable request ID, and uses existing authorization", async () => {
  const secret = "s".repeat(64);
  let saved = null;
  const config = {
    secret,
    allowedPhones: ["5511999990000"],
    parseCompletedAso: completedRdAsoText,
    save: async (_key, message) => {
      saved = message;
      return true;
    },
  };
  const request = (overrides = {}, header = secret) =>
    new Request("https://example.test/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nai-webhook-secret": header,
      },
      body: JSON.stringify({
        event: "aso.request.completed",
        phone: "5511999990000",
        request_id: "solicitacao-1",
        aso_request: completedFields,
        ...overrides,
      }),
    });
  assert.equal((await receiveRdWebhook(request(), config)).status, 200);
  assert.equal(saved.messageId, "aso-request:solicitacao-1");
  assert.equal(parse(saved.text).status, "solicitado");
  saved = null;
  assert.equal((await receiveRdWebhook(request({ request_id: "" }), config)).status, 422);
  assert.equal((await receiveRdWebhook(request({ aso_request: {} }), config)).status, 422);
  assert.equal((await receiveRdWebhook(request({}, "wrong"), config)).status, 401);
  await receiveRdWebhook(request({ phone: "5521999990000" }), config);
  assert.equal(saved, null);
});
test("complete request creates an unvalidated card in Solicitado without fabricated exams or clinic", () => {
  const card = parse();
  assert.equal(card.status, "solicitado");
  assert.equal(card.cnpj, "12345678000195");
  assert.equal(card.cpf, "52998224725");
  assert.equal(card.source, "rd-conversas");
  assert.equal(card.requestedCity, "Campinas/SP");
  assert.equal(card.validationPassed, false);
  assert.deepEqual(card.exams, []);
  assert.equal(card.clinicId, undefined);
});
test("incomplete, ordinary, ambiguous or invalid requests never create cards", () => {
  for (const value of [
    "Quero um ASO",
    text.replace("SOLICITAÇÃO DE ASO", "Bom dia"),
    text.replace("Cidade/UF: Campinas/SP", ""),
    text.replace("529.982.247-25", "529.982.247-26"),
    text.replace("12.345.678/0001-95", "00.000.000/0000-00"),
    text.replace("admissional", "qualquer"),
    text.replace("admissional", "constructor"),
    text + "\nCPF: 529.982.247-25",
    text.replace("Cargo: Assistente", "Cargo: " + "x".repeat(201)),
  ])
    assert.equal(parse(value), null);
});
test("supported exam labels accept accents", () => {
  for (const [label, value] of [
    ["periódico", "periodico"],
    ["demissional", "demissional"],
    ["retorno ao trabalho", "retorno_trabalho"],
    ["mudança de função", "mudanca_funcao"],
  ]) {
    assert.equal(parse(text.replace("admissional", label)).examType, value);
  }
});
test("only the operational team can access shared RD requests", () => {
  for (const role of ["SUPER_ADMIN", "ADMIN", "OPERATIONS"])
    assert.equal(canManageRdAso(role), true);
  for (const role of ["CLIENT_ADMIN", "GUEST", "DOCTOR", "", "ADMINISTRATOR"])
    assert.equal(canManageRdAso(role), false);
});
test("authorized webhook to card mapping is idempotent for repeated delivery", async () => {
  const secret = "s".repeat(64);
  const cards = new Map();
  const messages = new Set();
  const config = {
    secret,
    allowedPhones: ["5511999990000"],
    save: async (key, incoming) => {
      if (messages.has(key)) return false;
      const card = rdAsoRequestFromText(
        incoming.text,
        key,
        incoming.messageId,
        incoming.receivedAt
      );
      if (card) cards.set(card.id, card);
      messages.add(key);
      return true;
    },
  };
  const request = (overrides = {}) =>
    new Request("https://example.test/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nai-webhook-secret": secret,
      },
      body: JSON.stringify({
        direction: "inbound",
        phone: "5511999990000",
        message_id: "msg1",
        message: text,
        ...overrides,
      }),
    });
  assert.equal((await receiveRdWebhook(request(), config)).status, 200);
  assert.equal((await (await receiveRdWebhook(request(), config)).json()).duplicate, true);
  assert.equal(cards.size, 1);
  assert.equal([...cards.values()][0].status, "solicitado");
  await receiveRdWebhook(request({ message_id: "msg2", direction: "outbound" }), config);
  await receiveRdWebhook(request({ message_id: "msg3", phone: "5521999990000" }), config);
  await receiveRdWebhook(request({ message_id: "msg4", message: "Bom dia" }), config);
  assert.equal(cards.size, 1);
});
