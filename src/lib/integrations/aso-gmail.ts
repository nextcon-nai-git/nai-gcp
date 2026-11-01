import "server-only";
import { createHash } from "node:crypto";
import { auth, gmail, type gmail_v1 } from "googleapis/build/src/apis/gmail";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { ASO_FLOW_MAX_PDF_BYTES } from "@/lib/aso-flow";

const address =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
export function asoMailAddress(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > 254 || !address.test(text) || /[\r\n]/.test(text))
    throw badRequest("Confira o endereço de e-mail cadastrado.");
  return text.toLowerCase();
}

/** Presence is configuration only; a real profile check verifies mailbox identity. */
export function asoGmailConfiguration(env: Record<string, string | undefined> = process.env) {
  let mailbox = "";
  try {
    mailbox = asoMailAddress(env.ASO_GMAIL_MAILBOX);
  } catch {
    /* Not configured. */
  }
  const configured =
    env.ASO_GMAIL_ENABLED === "true" &&
    Boolean(
      mailbox &&
      env.ASO_GMAIL_CLIENT_ID &&
      env.ASO_GMAIL_CLIENT_SECRET &&
      env.ASO_GMAIL_REFRESH_TOKEN
    );
  return {
    configured,
    mailbox: configured ? mailbox : null,
    monitoringConfigured:
      configured &&
      Boolean(
        env.ASO_MAIL_SYNC_INVOKER_EMAIL && env.ASO_MAIL_SYNC_AUDIENCE && env.ASO_MAIL_OPERATOR_UID
      ),
    reason: configured
      ? null
      : "Conecte a caixa de e-mail do NAI para enviar e consultar retornos.",
  };
}

export async function verifiedAsoGmail() {
  const config = asoGmailConfiguration();
  if (!config.configured || !config.mailbox)
    throw new AuthError(config.reason || "E-mail indisponível.", 503);
  const oauth = new auth.OAuth2(
    process.env.ASO_GMAIL_CLIENT_ID,
    process.env.ASO_GMAIL_CLIENT_SECRET
  );
  oauth.setCredentials({ refresh_token: process.env.ASO_GMAIL_REFRESH_TOKEN });
  const client = gmail({ version: "v1", auth: oauth });
  try {
    const profile = await client.users.getProfile(
      { userId: "me" },
      { timeout: 15000, retry: false }
    );
    if (asoMailAddress(profile.data.emailAddress) !== config.mailbox)
      throw new AuthError("A conta Gmail autorizada difere da caixa configurada no NAI.", 503);
  } catch (error) {
    if (error instanceof AuthError) throw error;
    // Provider errors can contain request headers. Never log or return them.
    throw new AuthError("Não foi possível validar o acesso à caixa Gmail configurada.", 503);
  }
  return { client, mailbox: config.mailbox };
}

export function asoMailCaseId(subject: string): string | null {
  const ids = new Set(
    [...subject.matchAll(/\[NAI-ASO:([a-f0-9]{64})\]/g)].map((match) => match[1])
  );
  return ids.size === 1 ? [...ids][0] : null;
}

export function singleAsoMailSender(header: string): string | null {
  const match = header.trim().match(/^(?:[^<>\r\n,]*<([^<>]+)>|([^<>\s,]+))$/);
  if (!match) return null;
  try {
    return asoMailAddress(match[1] || match[2]);
  } catch {
    return null;
  }
}

export function asoMailHeader(message: gmail_v1.Schema$Message, name: string) {
  const matching = (message.payload?.headers || []).filter(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return matching.length === 1 ? matching[0].value || "" : "";
}

export function asoMailPdfParts(message: gmail_v1.Schema$Message) {
  const result: gmail_v1.Schema$MessagePart[] = [];
  let visited = 0;
  function visit(part: gmail_v1.Schema$MessagePart | undefined, depth: number) {
    if (!part) return;
    if (++visited > 100 || depth > 10)
      throw badRequest("Estrutura de anexos acima do limite de conferência.");
    if (part.filename && /\.pdf$/i.test(part.filename) && part.mimeType === "application/pdf") {
      const size = part.body?.size || 0;
      if (
        size >= 100 &&
        size <= ASO_FLOW_MAX_PDF_BYTES &&
        (part.body?.attachmentId || part.body?.data)
      )
        result.push(part);
    }
    for (const child of part.parts || []) visit(child, depth + 1);
  }
  visit(message.payload, 0);
  if (result.length > 10)
    throw badRequest("Mais de dez PDFs no e-mail. Separe os anexos para conferência.");
  return result;
}

const foldBase64 = (bytes: Buffer) =>
  bytes
    .toString("base64")
    .match(/.{1,76}/g)
    ?.join("\r\n") || "";
export function buildAsoMail(input: {
  from: string;
  to: string;
  subject: string;
  body: string;
  messageId: string;
  bytes: Buffer;
  fileName: string;
}) {
  const from = asoMailAddress(input.from),
    to = asoMailAddress(input.to);
  if (!/^<nai-aso-[a-f0-9]{64}@[a-zA-Z0-9.-]+>$/.test(input.messageId))
    throw badRequest("Identificador de envio inválido.");
  if (input.subject.length > 300 || /[\r\n]/.test(input.subject) || input.body.length > 10000)
    throw badRequest("Conteúdo de e-mail inválido.");
  if (
    input.bytes.length < 100 ||
    input.bytes.length > ASO_FLOW_MAX_PDF_BYTES ||
    input.bytes.subarray(0, 5).toString() !== "%PDF-"
  )
    throw badRequest("Anexe um PDF válido com até 5 MB.");
  const fileName =
    input.fileName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._ -]/g, "_")
      .slice(0, 180) || "documento.pdf";
  const boundary = `nai_${createHash("sha256").update(input.messageId).digest("hex")}`;
  // Encoded words are folded independently, preserving UTF-8 code points.
  const chunks: string[] = [];
  let chunk = "";
  for (const character of input.subject) {
    if (Buffer.byteLength(chunk + character) > 42) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  const subject = chunks
    .map((value) => `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`)
    .join("\r\n ");
  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${input.messageId}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(Buffer.from(input.body, "utf8")),
    `--${boundary}`,
    `Content-Type: application/pdf; name="${fileName}"`,
    `Content-Disposition: attachment; filename="${fileName}"`,
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(input.bytes),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return Buffer.from(raw).toString("base64url");
}

/** No retries here: an ambiguous send result must be reconciled before another send. */
export async function sendAsoGmail(client: gmail_v1.Gmail, raw: string) {
  const sent = await client.users.messages.send(
    { userId: "me", requestBody: { raw } },
    { timeout: 25000, retry: false }
  );
  if (!sent.data.id) throw new Error("Gmail did not return a message id");
  return { messageId: sent.data.id, threadId: sent.data.threadId || "" };
}

export async function findSentAsoGmail(
  client: gmail_v1.Gmail,
  messageId: string,
  recipient: string
) {
  const sent = await client.users.messages.list(
    { userId: "me", labelIds: ["SENT"], q: `rfc822msgid:${messageId}`, maxResults: 2 },
    { timeout: 15000, retry: false }
  );
  if (sent.data.messages?.length !== 1 || !sent.data.messages[0].id) return null;
  const message = (
    await client.users.messages.get(
      {
        userId: "me",
        id: sent.data.messages[0].id,
        format: "metadata",
        metadataHeaders: ["Message-ID", "To"],
      },
      { timeout: 15000, retry: false }
    )
  ).data;
  if (
    asoMailHeader(message, "Message-ID") !== messageId ||
    singleAsoMailSender(asoMailHeader(message, "To")) !== asoMailAddress(recipient)
  )
    return null;
  const sentAt = new Date(Number(message.internalDate)).toISOString();
  return { messageId: message.id!, threadId: message.threadId || "", sentAt };
}
