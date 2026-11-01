// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { gmail_v1 } from "googleapis/build/src/apis/gmail";
import { ASO_FLOW_MAX_PDF_BYTES } from "@/lib/aso-flow";

const mocks = vi.hoisted(() => ({
  oauth: vi.fn(),
  credentials: vi.fn(),
  gmail: vi.fn(),
  profile: vi.fn(),
  send: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  attachment: vi.fn(),
}));
vi.mock("googleapis/build/src/apis/gmail", () => ({
  auth: {
    OAuth2: class {
      constructor(id: string, secret: string) {
        mocks.oauth(id, secret);
      }
      setCredentials(value: unknown) {
        mocks.credentials(value);
      }
    },
  },
  gmail: (config: unknown) => {
    mocks.gmail(config);
    return {
      users: {
        getProfile: mocks.profile,
        messages: {
          send: mocks.send,
          list: mocks.list,
          get: mocks.get,
          attachments: { get: mocks.attachment },
        },
      },
    };
  },
}));
import {
  asoGmailConfiguration,
  asoMailAddress,
  asoMailCaseId,
  asoMailHeader,
  asoMailPdfParts,
  buildAsoMail,
  findSentAsoGmail,
  sendAsoGmail,
  singleAsoMailSender,
  verifiedAsoGmail,
} from "./aso-gmail";

const secrets = {
  client: "synthetic-client-id",
  secret: "synthetic-client-secret",
  token: "synthetic-refresh-token",
};
const complete = () => ({
  ASO_GMAIL_ENABLED: "true",
  ASO_GMAIL_MAILBOX: "Nextcon@Example.test",
  ASO_GMAIL_CLIENT_ID: secrets.client,
  ASO_GMAIL_CLIENT_SECRET: secrets.secret,
  ASO_GMAIL_REFRESH_TOKEN: secrets.token,
});
const mockClient = () =>
  ({
    users: { messages: { send: mocks.send, list: mocks.list, get: mocks.get } },
  }) as unknown as gmail_v1.Gmail;
const pdf = (size = 213) => {
  const bytes = Buffer.alloc(size, 255);
  bytes.write("%PDF-1.7\n");
  return bytes;
};
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const messageId = `<nai-aso-${"a".repeat(64)}@example.test>`;
const input = () => ({
  from: "sender@example.test",
  to: "clinic@example.test",
  subject: "ASO — João e Ágatha",
  body: "Prezados,\nSegue o ASO conferido.\n\nNEXTCON Saúde",
  messageId,
  bytes: pdf(),
  fileName: "ASO - João.pdf",
});
beforeEach(() => {
  vi.resetAllMocks();
  for (const [name, value] of Object.entries(complete())) vi.stubEnv(name, value);
  vi.stubEnv("ASO_MAIL_SYNC_INVOKER_EMAIL", "");
  vi.stubEnv("ASO_MAIL_SYNC_AUDIENCE", "");
  vi.stubEnv("ASO_MAIL_OPERATOR_UID", "");
  mocks.profile.mockResolvedValue({ data: { emailAddress: "nextcon@example.test" } });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("configuração e identidade da caixa Gmail ASO", () => {
  it.each([
    "ASO_GMAIL_ENABLED",
    "ASO_GMAIL_MAILBOX",
    "ASO_GMAIL_CLIENT_ID",
    "ASO_GMAIL_CLIENT_SECRET",
    "ASO_GMAIL_REFRESH_TOKEN",
  ])("mantém envio desabilitado quando falta %s sem retornar segredos", (missing) => {
    const env: Record<string, string | undefined> = { ...complete(), [missing]: "" };
    const result = asoGmailConfiguration(env);
    expect(result).toMatchObject({ configured: false, mailbox: null, monitoringConfigured: false });
    for (const secret of Object.values(secrets))
      expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("distingue configuração do envio e do monitoramento sem fazer chamadas de rede", () => {
    const env = complete();
    expect(asoGmailConfiguration(env)).toMatchObject({
      configured: true,
      mailbox: "nextcon@example.test",
      monitoringConfigured: false,
    });
    const monitoring = {
      ASO_MAIL_SYNC_INVOKER_EMAIL: "scheduler@example.test",
      ASO_MAIL_SYNC_AUDIENCE: "https://nai.example.test/api/internal/aso-mail-sync",
      ASO_MAIL_OPERATOR_UID: "operator",
    };
    expect(asoGmailConfiguration({ ...env, ...monitoring }).monitoringConfigured).toBe(true);
    for (const missing of Object.keys(monitoring))
      expect(
        asoGmailConfiguration({ ...env, ...monitoring, [missing]: "" }).monitoringConfigured
      ).toBe(false);
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it("não inicia OAuth nem Gmail quando envio não está habilitado", async () => {
    vi.stubEnv("ASO_GMAIL_ENABLED", "false");
    await expect(verifiedAsoGmail()).rejects.toMatchObject({ status: 503 });
    expect(mocks.oauth).not.toHaveBeenCalled();
    expect(mocks.gmail).not.toHaveBeenCalled();
  });
  it("consulta a identidade real sem retentativa e usa a caixa verificada", async () => {
    const result = await verifiedAsoGmail();
    expect(result.mailbox).toBe("nextcon@example.test");
    expect(mocks.oauth).toHaveBeenCalledWith(secrets.client, secrets.secret);
    expect(mocks.credentials).toHaveBeenCalledWith({ refresh_token: secrets.token });
    expect(mocks.profile).toHaveBeenCalledWith({ userId: "me" }, { timeout: 15000, retry: false });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("bloqueia caixa autorizada diferente sem vazar sua identidade", async () => {
    mocks.profile.mockResolvedValue({
      data: { emailAddress: "another-private-mailbox@example.test" },
    });
    const error = await verifiedAsoGmail().catch((error: unknown) => error);
    expect(error).toMatchObject({ status: 503 });
    expect(String(error)).toContain("difere");
    expect(String(error)).not.toContain("another-private-mailbox");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("não registra nem devolve token, headers ou conteúdo privado de erro do provedor", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.profile.mockRejectedValue(
      new Error(`Authorization: Bearer ${secrets.token}; ${secrets.secret}`)
    );
    const error = await verifiedAsoGmail().catch((error: unknown) => error);
    expect(error).toMatchObject({ status: 503 });
    expect(String(error)).toContain("validar o acesso");
    expect(String(error)).not.toContain(secrets.token);
    expect(String(error)).not.toContain(secrets.secret);
    expect(log).not.toHaveBeenCalled();
  });
});

describe("endereços, identificador do caso e anexos recebidos", () => {
  it("aceita um endereço sem permitir cabeçalhos, destinatários extras ou caracteres de controle", () => {
    expect(asoMailAddress("  Clinic+asos@Example.test  ")).toBe("clinic+asos@example.test");
    for (const value of [
      "a@example.test\r\nBcc: third@example.test",
      "a@example.test\nCc: x@example.test",
      "a@example.test,b@example.test",
      "Name <a@example.test>",
      "abc\0@example.test",
      "",
      null,
      "a".repeat(250) + "@example.test",
    ])
      expect(() => asoMailAddress(value)).toThrow();
  });
  it("associa apenas um marcador válido e rejeita associação ambígua", () => {
    const a = "a".repeat(64),
      b = "b".repeat(64);
    expect(asoMailCaseId(`Re: [NAI-ASO:${a}] ASO`)).toBe(a);
    expect(asoMailCaseId(`[NAI-ASO:${a}] Re: [NAI-ASO:${a}]`)).toBe(a);
    expect(asoMailCaseId(`[NAI-ASO:${a}] [NAI-ASO:${b}]`)).toBeNull();
    expect(asoMailCaseId(`[NAI-ASO:${a.slice(1)}]`)).toBeNull();
    expect(asoMailCaseId("ASO de uma pessoa")).toBeNull();
  });
  it("não escolhe um remetente quando o cabeçalho contém mais de um endereço", () => {
    expect(singleAsoMailSender("Clínica Teste <CLINIC@example.test>")).toBe("clinic@example.test");
    expect(singleAsoMailSender("clinic@example.test")).toBe("clinic@example.test");
    for (const header of [
      "a@example.test,b@example.test",
      "A <a@example.test>, B <b@example.test>",
      "A <a@example.test> <b@example.test>",
      "A <a@example.test>\r\nCc: b@example.test",
      "<a@example.test,b@example.test>",
      "group: a@example.test;",
      "",
    ])
      expect(singleAsoMailSender(header)).toBeNull();
  });
  it("trata cabeçalhos duplicados como ambíguos mesmo com capitalização diferente", () => {
    expect(
      asoMailHeader({ payload: { headers: [{ name: "SUBJECT", value: "ASO" }] } }, "Subject")
    ).toBe("ASO");
    expect(
      asoMailHeader(
        {
          payload: {
            headers: [
              { name: "From", value: "a@example.test" },
              { name: "from", value: "b@example.test" },
            ],
          },
        },
        "From"
      )
    ).toBe("");
    expect(asoMailHeader({}, "Subject")).toBe("");
  });
  const part = (
    changes: Partial<gmail_v1.Schema$MessagePart> = {}
  ): gmail_v1.Schema$MessagePart => ({
    partId: "1",
    filename: "ASO.PDF",
    mimeType: "application/pdf",
    body: { size: 200, attachmentId: "attachment-1" },
    ...changes,
  });
  it("seleciona somente PDFs com nome, MIME, tamanho e conteúdo referenciado", () => {
    const good = part();
    const inline = part({
      partId: "2",
      body: { size: ASO_FLOW_MAX_PDF_BYTES, data: "synthetic-inline" },
    });
    const ignored = [
      part({ filename: "arquivo.exe" }),
      part({ mimeType: "text/plain" }),
      part({ body: { size: 99, attachmentId: "small" } }),
      part({ body: { size: ASO_FLOW_MAX_PDF_BYTES + 1, attachmentId: "large" } }),
      part({ body: { size: 200 } }),
    ];
    expect(
      asoMailPdfParts({ payload: { parts: [good, { parts: [inline] }, ...ignored] } })
    ).toEqual([good, inline]);
    expect(asoMailPdfParts({})).toEqual([]);
  });
  it("limita dez PDFs e a complexidade de partes para não percorrer mensagens arbitrárias", () => {
    expect(
      asoMailPdfParts({ payload: { parts: Array.from({ length: 10 }, () => part()) } })
    ).toHaveLength(10);
    expect(() =>
      asoMailPdfParts({ payload: { parts: Array.from({ length: 11 }, () => part()) } })
    ).toThrow("dez PDFs");
    expect(
      asoMailPdfParts({
        payload: { parts: Array.from({ length: 99 }, () => ({ mimeType: "text/plain" })) },
      })
    ).toEqual([]);
    expect(() =>
      asoMailPdfParts({
        payload: { parts: Array.from({ length: 100 }, () => ({ mimeType: "text/plain" })) },
      })
    ).toThrow("Estrutura");
    let nested = part();
    for (let depth = 0; depth < 10; depth++) nested = { parts: [nested] };
    expect(asoMailPdfParts({ payload: nested })).toHaveLength(1);
    expect(() => asoMailPdfParts({ payload: { parts: [nested] } })).toThrow("Estrutura");
  });
});

describe("MIME do envio de ASO", () => {
  it("preserva Unicode no assunto/corpo e os bytes exatos do PDF após folding", () => {
    const data = {
      ...input(),
      subject: "[NAI-ASO:" + "a".repeat(64) + "] João — à clínica 🧑🏽‍⚕️ " + "á💙".repeat(30),
    };
    const encoded = buildAsoMail(data);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    expect(raw).toContain(`Message-ID: ${messageId}\r\n`);
    const subjectLine = raw.slice(raw.indexOf("Subject: ") + 9, raw.indexOf("\r\nMessage-ID:"));
    const words = [...subjectLine.matchAll(/=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/g)];
    expect(words.length).toBeGreaterThan(1);
    expect(words.map((match) => Buffer.from(match[1], "base64").toString("utf8")).join("")).toBe(
      data.subject
    );
    expect(subjectLine.split("\r\n").every((line) => line.length <= 75)).toBe(true);
    const boundary = raw.match(/boundary="([^"]+)"/)![1];
    const parts = raw.split(`--${boundary}`);
    const bodyPart = parts[1].split("\r\n\r\n")[1].trim();
    const pdfPart = parts[2].split("\r\n\r\n")[1].trim();
    expect(Buffer.from(bodyPart.replace(/\r\n/g, ""), "base64").toString("utf8")).toBe(data.body);
    expect(digest(Buffer.from(pdfPart.replace(/\r\n/g, ""), "base64"))).toBe(digest(data.bytes));
    expect(pdfPart.split("\r\n").every((line) => line.length <= 76)).toBe(true);
    expect(raw).toContain('filename="ASO - Joao.pdf"');
    for (const secret of Object.values(secrets)) expect(raw).not.toContain(secret);
  });
  it("rejeita injeção em assunto/endereço/Message-ID e neutraliza nome de arquivo", () => {
    for (const changes of [
      { subject: "ASO\r\nBcc: third@example.test" },
      { from: "a@example.test\nCc: third@example.test" },
      { to: "b@example.test\r\nBcc: third@example.test" },
      { messageId: `${messageId}\r\nBcc: third@example.test` },
      { messageId: "not-an-id" },
    ])
      expect(() => buildAsoMail({ ...input(), ...changes })).toThrow();
    const raw = Buffer.from(
      buildAsoMail({ ...input(), fileName: 'ASO"\r\nBcc: third@example.test.pdf' }),
      "base64url"
    ).toString();
    expect(raw).not.toMatch(/\r\nBcc:/);
    expect(raw.match(/Content-Disposition: attachment;/g)).toHaveLength(1);
    expect(() => buildAsoMail({ ...input(), subject: "a".repeat(301) })).toThrow();
    expect(() => buildAsoMail({ ...input(), body: "a".repeat(10001) })).toThrow();
  });
  it("recusa conteúdo que não é PDF e tamanho fora dos limites", () => {
    expect(() => buildAsoMail({ ...input(), bytes: Buffer.alloc(200) })).toThrow("PDF");
    expect(() => buildAsoMail({ ...input(), bytes: pdf(99) })).toThrow("PDF");
    expect(() => buildAsoMail({ ...input(), bytes: pdf(ASO_FLOW_MAX_PDF_BYTES + 1) })).toThrow(
      "5 MB"
    );
    expect(() => buildAsoMail({ ...input(), bytes: pdf(ASO_FLOW_MAX_PDF_BYTES) })).not.toThrow();
  });
});

describe("envio e reconciliação Gmail sem repetição automática", () => {
  it("faz uma chamada sem retry e exige identificador do provedor", async () => {
    mocks.send.mockResolvedValueOnce({ data: { id: "gmail-1", threadId: "thread-1" } });
    expect(await sendAsoGmail(mockClient(), "raw")).toEqual({
      messageId: "gmail-1",
      threadId: "thread-1",
    });
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith(
      { userId: "me", requestBody: { raw: "raw" } },
      { timeout: 25000, retry: false }
    );
    mocks.send.mockResolvedValueOnce({ data: {} });
    await expect(sendAsoGmail(mockClient(), "raw")).rejects.toThrow("message id");
    expect(mocks.send).toHaveBeenCalledTimes(2);
    mocks.send.mockRejectedValueOnce(new Error("network timeout"));
    await expect(sendAsoGmail(mockClient(), "raw")).rejects.toThrow("network timeout");
    expect(mocks.send).toHaveBeenCalledTimes(3);
  });
  const found = () => ({
    data: {
      id: "gmail-1",
      threadId: "thread-1",
      internalDate: String(Date.parse("2026-11-01T12:00:00Z")),
      payload: {
        headers: [
          { name: "Message-ID", value: messageId },
          { name: "To", value: "clinic@example.test" },
        ],
      },
    },
  });
  it("reconcilia somente resultado único em Enviados com Message-ID e destinatário exatos", async () => {
    mocks.list.mockResolvedValue({ data: { messages: [{ id: "gmail-1" }] } });
    mocks.get.mockResolvedValue(found());
    expect(await findSentAsoGmail(mockClient(), messageId, "CLINIC@example.test")).toEqual({
      messageId: "gmail-1",
      threadId: "thread-1",
      sentAt: "2026-11-01T12:00:00.000Z",
    });
    expect(mocks.list).toHaveBeenCalledWith(
      { userId: "me", labelIds: ["SENT"], q: `rfc822msgid:${messageId}`, maxResults: 2 },
      { timeout: 15000, retry: false }
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("não inventa comprovante para zero, múltiplos ou destinatários divergentes", async () => {
    for (const messages of [[], [{ id: "one" }, { id: "two" }], [{}]]) {
      mocks.list.mockResolvedValueOnce({ data: { messages } });
      expect(await findSentAsoGmail(mockClient(), messageId, "clinic@example.test")).toBeNull();
    }
    expect(mocks.get).not.toHaveBeenCalled();
    mocks.list.mockResolvedValue({ data: { messages: [{ id: "gmail-1" }] } });
    for (const headers of [
      [
        { name: "Message-ID", value: messageId },
        { name: "To", value: "other@example.test" },
      ],
      [
        { name: "Message-ID", value: messageId },
        { name: "To", value: "clinic@example.test, other@example.test" },
      ],
      [
        { name: "Message-ID", value: "different" },
        { name: "To", value: "clinic@example.test" },
      ],
      [
        { name: "Message-ID", value: messageId },
        { name: "To", value: "clinic@example.test" },
        { name: "to", value: "clinic@example.test" },
      ],
    ]) {
      mocks.get.mockResolvedValueOnce({ data: { ...found().data, payload: { headers } } });
      expect(await findSentAsoGmail(mockClient(), messageId, "clinic@example.test")).toBeNull();
    }
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
