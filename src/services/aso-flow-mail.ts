import "server-only";
import { createHash } from "node:crypto";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { z } from "zod/v3";
import { adminDb } from "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { asoClientEmailSendingEnabled } from "@/lib/aso-email-policy";
import type { AuthContext } from "@/lib/auth/auth-context";
import {
  AsoFlowDaySchema,
  AsoFlowIdSchema,
  ASO_FLOW_MAX_PDF_BYTES,
  type AsoFlowCard,
} from "@/lib/aso-flow";
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
} from "@/lib/integrations/aso-gmail";
import {
  getAsoFlowCard,
  readAsoFlowDocument,
  recordAsoFlowSent,
  reserveAsoFlowMail,
  uploadAsoFlowDocument,
} from "@/services/aso-flow";

const root = () => adminDb.collection("clinic_portal_private").doc("aso-flow");
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const bucket = () => getStorage().bucket(firebaseConfig.storageBucket);
type Outbox = {
  caseId: string;
  version: number;
  kind: "kit" | "aso";
  recipient: string;
  documentHash: string;
  mailbox: string;
  messageId: string;
  state: "sending" | "sent" | "uncertain";
  startedAt: string;
  providerMessageId?: string;
  sentAt?: string;
};
type Candidate = {
  caseId: string;
  companyId: string;
  id: string;
  hash: string;
  fileName: string;
  size: number;
  from: string;
  subject: string;
  receivedAt: string;
  discoveredAt: string;
  messageId: string;
  partId: string;
  mailbox: string;
  acceptedAt?: string;
  acceptedBy?: string;
};
const candidatePath = (caseId: string, id: string) => `aso-mail-private/${caseId}/${id}.pdf`;

export const AsoFlowMailSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("send"),
      id: AsoFlowIdSchema,
      version: z.number().int().positive(),
      kind: z.enum(["kit", "aso"]),
      recipient: z.string().trim().email().max(254),
      confirmed: z.literal(true),
    })
    .strict(),
  z.object({ action: z.literal("sync"), id: AsoFlowIdSchema }).strict(),
  z.object({ action: z.literal("reconcile"), id: AsoFlowIdSchema }).strict(),
  z
    .object({
      action: z.literal("receive"),
      id: AsoFlowIdSchema,
      version: z.number().int().positive(),
      candidateId: AsoFlowIdSchema,
      examDate: AsoFlowDaySchema,
      identityConfirmed: z.literal(true),
      documentChecked: z.literal(true),
    })
    .strict(),
]);

/** Always reread the recipient from the current register immediately before sending. */
async function expectedRecipient(card: AsoFlowCard, kind: "kit" | "aso") {
  if (kind === "kit") {
    if (!card.clinic?.id) throw badRequest("Confirme a clínica antes de enviar o kit.");
    const provider = (await adminDb.collection("providers").doc(card.clinic.id).get()).data();
    if (!provider || provider.isDeleted === true || provider.active !== true)
      throw new AuthError("Clínica inativa ou não encontrada. Atualize o agendamento.", 409);
    const recipient = asoMailAddress(provider.email);
    if (recipient !== asoMailAddress(card.clinic.email))
      throw new AuthError("O e-mail da clínica mudou. Confira novamente o agendamento.", 409);
    return recipient;
  }
  const company = (await adminDb.collection("companies").doc(card.companyId).get()).data();
  if (!company || company.isDeleted === true) throw new AuthError("Cliente indisponível.", 409);
  const registered = [company.contactEmail, company.email].flatMap((value) => {
    try {
      return [asoMailAddress(value)];
    } catch {
      return [];
    }
  });
  if (!registered.length) throw badRequest("Cadastre o e-mail do cliente antes do envio.");
  const recipient = registered[0];
  if (recipient !== asoMailAddress(card.clientEmail))
    throw new AuthError(
      "O e-mail do cliente mudou. Atualize o destinatário do card antes do envio.",
      409
    );
  return recipient;
}

export function validateAsoMailStage(card: AsoFlowCard, kind: "kit" | "aso") {
  if (["cancelled", "no_show", "delivered"].includes(card.status))
    throw new AuthError("Este card não permite um novo envio.", 409);
  if (
    kind === "kit" &&
    (!card.kit?.nativeSocDeclared ||
      !card.appointment ||
      !["scheduled", "kit_sent"].includes(card.status))
  )
    throw badRequest("Confirme o agendamento e anexe o kit emitido no SOC.");
  if (kind === "kit" && card.kitDelivery?.hash === card.kit?.hash)
    throw new AuthError(
      "Este kit já possui comprovante de envio. Consulte o histórico para evitar duplicidade.",
      409
    );
  if (
    kind === "aso" &&
    (card.status !== "reviewed" ||
      !card.aso ||
      card.review?.hash !== card.aso.hash ||
      card.archive?.hash !== card.aso.hash)
  )
    throw badRequest("Confira e arquive este ASO antes de enviar ao cliente.");
}

export async function sendAsoFlowMail(
  user: AuthContext,
  input: Extract<z.infer<typeof AsoFlowMailSchema>, { action: "send" }>
) {
  if (input.kind === "aso" && !asoClientEmailSendingEnabled())
    throw new AuthError(
      "O envio de e-mail aos clientes está desativado. O documento permanece disponível no card.",
      403
    );
  const card = await getAsoFlowCard(user, input.id);
  if (card.version !== input.version)
    throw new AuthError("O card mudou. Atualize antes de enviar.", 409);
  validateAsoMailStage(card, input.kind);
  const recipient = await expectedRecipient(card, input.kind);
  if (recipient !== asoMailAddress(input.recipient))
    throw badRequest("Confirme o destinatário cadastrado desta clínica ou cliente.");
  const document = await readAsoFlowDocument(user, input.id, input.kind);
  const { client, mailbox } = await verifiedAsoGmail();
  const outboxId = hash(JSON.stringify([input.id, input.kind, document.hash, recipient, mailbox]));
  const ref = root().collection("outbox").doc(outboxId);
  const messageId = `<nai-aso-${outboxId}@${mailbox.split("@")[1]}>`;
  const subject = `[NAI-ASO:${card.id}] ${input.kind === "kit" ? "Kit SOC" : "ASO conferido"} — ${card.employeeName.slice(0, 100)}`;
  const body =
    input.kind === "kit"
      ? `Prezados,\n\nSegue o kit emitido no SOC de ${card.employeeName}, ${card.companyName}, unidade ${card.unit}, ${card.city}/${card.state}.\nAtendimento confirmado para ${card.appointment!.date} às ${card.appointment!.time}. Pedido SOC: ${card.kit!.socOrder}.\n\nFavor responder a este e-mail mantendo o assunto e anexar somente o ASO correspondente após o atendimento.\n\nNextcon Saúde`
      : `Prezados,\n\nSegue o ASO conferido de ${card.employeeName}, ${card.companyName}, unidade ${card.unit}, referente ao exame de ${card.aso!.examDate}.\n\nNextcon Saúde`;
  const raw = buildAsoMail({
    from: mailbox,
    to: recipient,
    subject,
    body,
    messageId,
    bytes: document.bytes,
    fileName: document.fileName,
  });
  await reserveAsoFlowMail(user, {
    id: input.id,
    version: input.version,
    kind: input.kind,
    recipient,
    documentHash: document.hash,
    outboxId,
    mailbox,
    messageId,
    startedAt: new Date().toISOString(),
  });
  try {
    // A reserved operation is never retried automatically, even after process failure.
    const sent = await sendAsoGmail(client, raw);
    const sentAt = new Date().toISOString();
    await ref.update({ providerMessageId: sent.messageId, threadId: sent.threadId, sentAt });
    return await recordAsoFlowSent(user, {
      id: input.id,
      version: input.version,
      kind: input.kind,
      recipient,
      providerMessageId: sent.messageId,
      sentAt,
      documentHash: document.hash,
      outboxId,
    });
  } catch {
    const confirmed = await adminDb
      .runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (current.data()?.state === "sent") return current.data() as Outbox;
        if (current.exists)
          tx.update(ref, { state: "uncertain", lastCheckedAt: new Date().toISOString() });
        return null;
      })
      .catch(() => null);
    if (confirmed?.providerMessageId) {
      const current = await getAsoFlowCard(user, input.id);
      const receipt = input.kind === "kit" ? current.kitDelivery : current.delivery;
      if (
        receipt?.hash === document.hash &&
        receipt.recipient === recipient &&
        receipt.reference === confirmed.providerMessageId
      )
        return current;
    }
    throw new AuthError(
      "O resultado do envio precisa de conferência. Use Verificar envio; o NAI não repetirá a mensagem automaticamente.",
      409
    );
  }
}

export async function reconcileAsoFlowMail(user: AuthContext, id: string) {
  const card = (await getAsoFlowCard(user, id)) as AsoFlowCard & {
    mailLock?: { outboxId: string };
  };
  if (!card.mailLock?.outboxId)
    return { card, reconciled: false, message: "Nenhum envio pendente de conferência." };
  const ref = root().collection("outbox").doc(card.mailLock.outboxId);
  const outbox = (await ref.get()).data() as Outbox | undefined;
  if (!outbox || outbox.caseId !== id)
    throw new AuthError("Comprovante de envio não encontrado.", 409);
  const { client, mailbox } = await verifiedAsoGmail();
  if (outbox.mailbox !== mailbox)
    throw new AuthError(
      "O envio pertence a outra caixa de e-mail. Reconfigure a caixa original para conferir.",
      409
    );
  let sent: { messageId: string; sentAt: string } | null = null;
  if (outbox.providerMessageId && outbox.sentAt)
    sent = { messageId: outbox.providerMessageId, sentAt: outbox.sentAt };
  else sent = await findSentAsoGmail(client, outbox.messageId, outbox.recipient);
  if (!sent)
    throw new AuthError(
      "Envio ainda não localizado no Gmail. O card permanece aberto; confira a caixa antes de liberar qualquer repetição.",
      409
    );
  const next = await recordAsoFlowSent(user, {
    id,
    version: outbox.version,
    kind: outbox.kind,
    recipient: outbox.recipient,
    providerMessageId: sent.messageId,
    sentAt: sent.sentAt,
    documentHash: outbox.documentHash,
    outboxId: card.mailLock.outboxId,
  });
  return { card: next, reconciled: true };
}

export async function asoFlowMailbox(user: AuthContext, id: string, cursor?: string) {
  await getAsoFlowCard(user, id);
  if (cursor && !AsoFlowIdSchema.safeParse(cursor).success)
    throw badRequest("Página de anexos inválida.");
  let query = root().collection("inbox").where("caseId", "==", id).orderBy(FieldPath.documentId());
  if (cursor) query = query.startAfter(cursor);
  const records = await query.limit(201).get();
  const page = records.docs.slice(0, 200);
  const candidates = page
    .map((record) => record.data() as Candidate)
    .filter((c) => !c.acceptedAt)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return {
    status: asoGmailConfiguration(),
    candidates: candidates.map(({ id, fileName, from, subject, receivedAt }) => ({
      id,
      fileName,
      from,
      subject,
      receivedAt,
    })),
    nextCursor: records.size > 200 ? page.at(-1)!.id : null,
    truncated: records.size > 200,
  };
}

export async function readAsoMailCandidate(user: AuthContext, id: string, candidateId: string) {
  const card = await getAsoFlowCard(user, id);
  const candidate = (await root().collection("inbox").doc(candidateId).get()).data() as
    Candidate | undefined;
  if (!candidate || candidate.caseId !== id || candidate.companyId !== card.companyId)
    throw new AuthError("Anexo não encontrado neste card.", 404);
  const file = bucket().file(candidatePath(id, candidateId));
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size) !== candidate.size || candidate.size > ASO_FLOW_MAX_PDF_BYTES)
    throw new AuthError("Integridade do anexo não confirmada.", 409);
  const [bytes] = await file.download();
  if (hash(bytes) !== candidate.hash)
    throw new AuthError("Integridade do anexo não confirmada.", 409);
  return { candidate, bytes };
}

export async function acceptAsoMailCandidate(
  user: AuthContext,
  input: Extract<z.infer<typeof AsoFlowMailSchema>, { action: "receive" }>
) {
  const { candidate, bytes } = await readAsoMailCandidate(user, input.id, input.candidateId);
  const card = await getAsoFlowCard(user, input.id);
  const reference = `Gmail ${candidate.messageId} / anexo ${candidate.partId}`;
  // Recover a lost acknowledgement without replacing/reopening an already reviewed PDF.
  if (
    card.aso?.hash === candidate.hash &&
    card.aso.source === "email" &&
    card.aso.reference === reference
  ) {
    if (!candidate.acceptedAt)
      await root()
        .collection("inbox")
        .doc(candidate.id)
        .update({ acceptedAt: new Date().toISOString(), acceptedBy: user.uid });
    return card;
  }
  if (candidate.acceptedAt) {
    if (card.aso?.hash === candidate.hash) return card;
    throw new AuthError("Este anexo já foi conferido anteriormente. Atualize o card.", 409);
  }
  const next = await uploadAsoFlowDocument(
    user,
    {
      action: "receive_aso",
      id: input.id,
      version: input.version,
      identityConfirmed: true,
      examDate: input.examDate,
      source: "email",
      reference,
    },
    bytes,
    candidate.fileName
  );
  await root()
    .collection("inbox")
    .doc(candidate.id)
    .update({ acceptedAt: new Date().toISOString(), acceptedBy: user.uid });
  return next;
}

/** Receives candidates only. A subject, a filename or a PDF is never proof of an ASO. */
export async function syncAsoFlowMail(user: AuthContext, id?: string) {
  if (id) await getAsoFlowCard(user, id);
  const { client, mailbox } = await verifiedAsoGmail();
  const syncRef = root()
    .collection("mailSync")
    .doc(hash(JSON.stringify([mailbox, user.uid, id || "all"])));
  const lease = hash(`${Date.now()}-${Math.random()}`);
  const state = await adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(syncRef);
    const data = snapshot.data() || {};
    if (data.leaseUntil && Date.parse(data.leaseUntil) > Date.now())
      throw new AuthError("A caixa já está sendo consultada. Aguarde a conclusão.", 409);
    const after =
      data.after ||
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10).replace(/-/g, "/");
    tx.set(syncRef, {
      ...data,
      after,
      lease,
      leaseUntil: new Date(Date.now() + 120000).toISOString(),
      lastAttemptAt: new Date().toISOString(),
    });
    return {
      after: String(after),
      pageToken: typeof data.pageToken === "string" ? data.pageToken : undefined,
    };
  });
  let saved = 0,
    skipped = 0,
    examined = 0;
  try {
    const result = await client.users.messages.list(
      {
        userId: "me",
        q: `after:${state.after} has:attachment filename:pdf -in:sent ${id ? `"[NAI-ASO:${id}]"` : 'subject:"NAI-ASO"'}`,
        maxResults: 20,
        pageToken: state.pageToken,
      },
      { timeout: 15000, retry: false }
    );
    for (const hit of result.data.messages || []) {
      if (!hit.id) continue;
      examined++;
      const message = (
        await client.users.messages.get(
          { userId: "me", id: hit.id, format: "full" },
          { timeout: 15000, retry: false }
        )
      ).data;
      const subject = asoMailHeader(message, "Subject"),
        caseId = asoMailCaseId(subject);
      const from = singleAsoMailSender(asoMailHeader(message, "From"));
      if (
        !caseId ||
        !from ||
        from === mailbox ||
        (id && caseId !== id) ||
        message.labelIds?.some((label) => ["SENT", "TRASH", "SPAM"].includes(label))
      ) {
        skipped++;
        continue;
      }
      let card: AsoFlowCard;
      try {
        card = await getAsoFlowCard(user, caseId);
      } catch (error) {
        if (error instanceof AuthError && [403, 404].includes(error.status)) {
          skipped++;
          continue;
        }
        throw error;
      }
      if (
        !card.clinic?.email ||
        from !== asoMailAddress(card.clinic.email) ||
        ["delivered", "cancelled", "no_show"].includes(card.status)
      ) {
        skipped++;
        continue;
      }
      const receivedAt = new Date(Number(message.internalDate));
      if (!Number.isFinite(receivedAt.getTime())) {
        skipped++;
        continue;
      }
      let parts;
      try {
        parts = asoMailPdfParts(message);
      } catch (error) {
        if (error instanceof AuthError && error.status === 400) {
          skipped++;
          continue;
        }
        throw error;
      }
      for (const part of parts) {
        const partId = part.partId || part.body?.attachmentId || "inline";
        const candidateId = hash(JSON.stringify([mailbox, hit.id, partId, caseId]));
        const ref = root().collection("inbox").doc(candidateId);
        if ((await ref.get()).exists) continue;
        const data = part.body?.attachmentId
          ? (
              await client.users.messages.attachments.get(
                { userId: "me", messageId: hit.id, id: part.body.attachmentId },
                { timeout: 15000, retry: false }
              )
            ).data.data
          : part.body?.data;
        if (!data || data.length > Math.ceil((ASO_FLOW_MAX_PDF_BYTES * 4) / 3) + 8) {
          skipped++;
          continue;
        }
        const bytes = Buffer.from(data, "base64url");
        if (
          bytes.length < 100 ||
          bytes.length > ASO_FLOW_MAX_PDF_BYTES ||
          bytes.subarray(0, 5).toString() !== "%PDF-"
        ) {
          skipped++;
          continue;
        }
        const candidate: Candidate = {
          id: candidateId,
          caseId,
          companyId: card.companyId,
          hash: hash(bytes),
          size: bytes.length,
          fileName: (part.filename || "anexo.pdf")
            .replace(/[\u0000-\u001f/\\]/g, "_")
            .slice(0, 200),
          from,
          subject: subject.slice(0, 400),
          receivedAt: receivedAt.toISOString(),
          discoveredAt: new Date().toISOString(),
          messageId: hit.id,
          partId,
          mailbox,
        };
        try {
          await bucket()
            .file(candidatePath(caseId, candidateId))
            .save(bytes, {
              resumable: false,
              contentType: "application/pdf",
              preconditionOpts: { ifGenerationMatch: 0 },
              metadata: { cacheControl: "private, no-store" },
            });
        } catch (error) {
          if (!(
            error &&
            typeof error === "object" &&
            "code" in error &&
            Number(error.code) === 412
          ))
            throw error;
        }
        await adminDb.runTransaction(async (tx) => {
          if (!(await tx.get(ref)).exists) tx.create(ref, candidate);
        });
        saved++;
      }
    }
    const nextPage = result.data.nextPageToken || null;
    await adminDb.runTransaction(async (tx) => {
      const current = (await tx.get(syncRef)).data();
      if (current?.lease !== lease)
        throw new AuthError(
          "Outra consulta assumiu a caixa. Confira o resultado antes de repetir.",
          409
        );
      tx.update(syncRef, {
        lease: FieldValue.delete(),
        leaseUntil: FieldValue.delete(),
        pageToken: nextPage || FieldValue.delete(),
        lastSuccessAt: new Date().toISOString(),
        ...(nextPage
          ? {}
          : {
              after: new Date(Date.now() - 2 * 86400000)
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, "/"),
            }),
        lastResult: { saved, skipped, examined, hasMore: Boolean(nextPage) },
      });
    });
    return { saved, skipped, examined, hasMore: Boolean(nextPage) };
  } catch (error) {
    await adminDb
      .runTransaction(async (tx) => {
        if ((await tx.get(syncRef)).data()?.lease === lease)
          tx.update(syncRef, {
            lease: FieldValue.delete(),
            leaseUntil: FieldValue.delete(),
            lastErrorAt: new Date().toISOString(),
          });
      })
      .catch(() => undefined);
    if (error instanceof AuthError) throw error;
    throw new AuthError(
      "Falha na consulta da caixa. Os anexos já recebidos foram preservados; nenhuma entrega foi encerrada.",
      503
    );
  }
}
