// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
import type { AsoFlowCard } from "@/lib/aso-flow";
const m = vi.hoisted(() => ({
  getCard: vi.fn(),
  readDocument: vi.fn(),
  recordSent: vi.fn(),
  reserve: vi.fn(),
  upload: vi.fn(),
  verified: vi.fn(),
  send: vi.fn(),
  find: vi.fn(),
  collection: vi.fn(),
  transaction: vi.fn(),
  file: vi.fn(),
}));
vi.mock("@/services/aso-flow", () => ({
  getAsoFlowCard: m.getCard,
  readAsoFlowDocument: m.readDocument,
  recordAsoFlowSent: m.recordSent,
  reserveAsoFlowMail: m.reserve,
  uploadAsoFlowDocument: m.upload,
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: m.collection, runTransaction: m.transaction },
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ file: m.file }) }),
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { delete: () => ({ __delete: true }) },
  FieldPath: { documentId: () => "__name__" },
}));
vi.mock("@/lib/integrations/aso-gmail", async (original) => ({
  ...(await original<object>()),
  verifiedAsoGmail: m.verified,
  sendAsoGmail: m.send,
  findSentAsoGmail: m.find,
}));
import { AuthError } from "@/lib/auth/errors";
import {
  acceptAsoMailCandidate,
  asoFlowMailbox,
  readAsoMailCandidate,
  reconcileAsoFlowMail,
  sendAsoFlowMail,
  syncAsoFlowMail,
  validateAsoMailStage,
} from "./aso-flow-mail";

const id = "a".repeat(64),
  candidateId = "b".repeat(64),
  root = "clinic_portal_private/aso-flow";
const bytes = Buffer.from("%PDF-1.7\n" + "synthetic test content\n".repeat(12));
const documentHash = createHash("sha256").update(bytes).digest("hex");
const user = {
  uid: "operator-test",
  role: "SUPER_ADMIN",
  tenantId: null,
  servedCompanies: [],
  permissions: [],
  email: "operator@example.test",
} as AuthContext;
let card: AsoFlowCard,
  db: Map<string, Record<string, any>>,
  files: Map<string, Buffer>,
  client: any;
let afterInboxQuery: (() => void) | undefined;
function snapshot(path: string) {
  return {
    exists: db.has(path),
    id: path.split("/").at(-1),
    data: () => (db.has(path) ? structuredClone(db.get(path)) : undefined),
  };
}
function apply(path: string, value: Record<string, any>) {
  const next = { ...db.get(path) };
  for (const [key, item] of Object.entries(value)) {
    if (item?.__delete) delete next[key];
    else next[key] = item;
  }
  db.set(path, next);
}
function ref(path: string): any {
  return {
    path,
    collection: (name: string) => collection(`${path}/${name}`),
    get: async () => snapshot(path),
    update: async (value: any) => apply(path, value),
  };
}
function collection(path: string, field?: string, value?: any, max = Infinity, cursor = ""): any {
  return {
    doc: (id: string) => ref(`${path}/${id}`),
    where: (f: string, _op: string, v: any) => collection(path, f, v, max, cursor),
    orderBy: () => collection(path, field, value, max, cursor),
    startAfter: (after: string) => collection(path, field, value, max, after),
    limit: (count: number) => collection(path, field, value, count, cursor),
    get: async () => {
      const paths = [...db.keys()]
        .sort()
        .filter(
          (p) =>
            p.startsWith(`${path}/`) &&
            p.split("/").length === path.split("/").length + 1 &&
            p.split("/").at(-1)! > cursor &&
            (!field || db.get(p)?.[field] === value)
        )
        .slice(0, max);
      const result = { size: paths.length, docs: paths.map(snapshot) };
      if (path === `${root}/inbox`) afterInboxQuery?.();
      return result;
    },
  };
}
function seedCandidate() {
  db.set(`${root}/inbox/${candidateId}`, {
    id: candidateId,
    caseId: id,
    companyId: "CLIENT",
    hash: documentHash,
    size: bytes.length,
    fileName: "anexo.pdf",
    from: "clinic@example.test",
    subject: `Re: [NAI-ASO:${id}]`,
    receivedAt: "2026-10-20T12:00:00.000Z",
    discoveredAt: "2026-10-20T12:01:00.000Z",
    messageId: "msg-in",
    partId: "1",
    mailbox: "sender@example.test",
  });
  files.set(`aso-mail-private/${id}/${candidateId}.pdf`, Buffer.from(bytes));
}
beforeEach(() => {
  vi.stubEnv("ASO_CLIENT_EMAIL_SEND_ENABLED", "true");
  vi.clearAllMocks();
  db = new Map();
  files = new Map();
  afterInboxQuery = undefined;
  card = {
    id,
    version: 3,
    companyId: "CLIENT",
    companyName: "Cliente Sintético",
    cnpj: "11222333000181",
    employeeId: "EMP",
    employeeName: "Pessoa Teste",
    city: "Curitiba",
    state: "PR",
    unit: "Sede",
    examType: "periodico",
    cycle: "2026-10",
    status: "scheduled",
    clientEmail: "client@example.test",
    clinic: { id: "CLINIC", name: "Clínica Teste", email: "clinic@example.test" },
    appointment: {
      date: "2026-10-20",
      time: "09:00",
      reference: "confirmado",
      confirmedAt: "2026-10-19T12:00:00Z",
      confirmedBy: user.uid,
    },
    kit: {
      hash: documentHash,
      fileName: "kit.pdf",
      size: bytes.length,
      receivedAt: "2026-10-19T12:00:00Z",
      receivedBy: user.uid,
      reference: "SOC 100",
      source: "soc",
      socOrder: "100",
      socCompanyId: "200",
      nativeSocDeclared: true,
    },
    events: [],
    sourceName: "sintetico.csv",
    sourceRow: 2,
    roleTitle: "Assistente",
    department: "Administrativo",
    createdAt: "2026-10-19T12:00:00Z",
    updatedAt: "2026-10-19T12:00:00Z",
    createdBy: user.uid,
    updatedBy: user.uid,
  };
  db.set(`${root}/cases/${id}`, structuredClone(card));
  db.set("providers/CLINIC", { active: true, email: "clinic@example.test" });
  db.set("companies/CLIENT", { active: true, email: "client@example.test" });
  m.getCard.mockImplementation(async (_user, wanted) => {
    if (wanted !== id) throw new AuthError("not found", 404);
    return structuredClone(card);
  });
  m.readDocument.mockImplementation(async () => ({
    bytes,
    hash: documentHash,
    fileName: "kit.pdf",
    card,
  }));
  m.collection.mockImplementation(collection);
  m.transaction.mockImplementation(async (fn) =>
    fn({
      get: async (target: any) => snapshot(target.path),
      create: (target: any, data: any) => {
        if (db.has(target.path)) throw Error("already exists");
        db.set(target.path, structuredClone(data));
      },
      set: (target: any, data: any) => db.set(target.path, structuredClone(data)),
      update: (target: any, data: any) => apply(target.path, data),
    })
  );
  m.file.mockImplementation((path) => ({
    getMetadata: async () => [{ size: files.get(path)?.length }],
    download: async () => [files.get(path)],
    save: async (data: Buffer) => {
      if (files.has(path)) throw { code: 412 };
      files.set(path, Buffer.from(data));
    },
  }));
  client = {
    users: {
      messages: {
        list: vi.fn().mockResolvedValue({ data: { messages: [] } }),
        get: vi.fn(),
        attachments: { get: vi.fn() },
      },
    },
  };
  m.verified.mockResolvedValue({ client, mailbox: "sender@example.test" });
  m.send.mockResolvedValue({ messageId: "gmail-100", threadId: "thread-100" });
  m.recordSent.mockResolvedValue({ ...card, status: "kit_sent", version: 4 });
  m.reserve.mockImplementation(async (_user, value) => {
    const path = `${root}/outbox/${value.outboxId}`;
    if (db.has(path)) throw new AuthError("existing operation", 409);
    db.set(path, { ...value, caseId: value.id, state: "sending" });
    apply(`${root}/cases/${id}`, { mailLock: value });
  });
  m.upload.mockResolvedValue({ ...card, version: 4, status: "received" });
});

afterEach(() => vi.unstubAllEnvs());

describe("ASO email evidence and delivery", () => {
  it("blocks client email before touching Gmail when client delivery is disabled", async () => {
    vi.stubEnv("ASO_CLIENT_EMAIL_SEND_ENABLED", "false");
    await expect(
      sendAsoFlowMail(user, {
        action: "send",
        id,
        version: 3,
        kind: "aso",
        recipient: "client@example.test",
        confirmed: true,
      })
    ).rejects.toThrow("desativado");
    expect(m.verified).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
    expect(m.reserve).not.toHaveBeenCalled();
  });
  const sendInput = () => ({
    action: "send" as const,
    id,
    version: card.version,
    kind: "kit" as const,
    recipient: "clinic@example.test",
    confirmed: true as const,
  });
  it("sends the native kit once and binds confirmation to hash, recipient and provider id", async () => {
    const result = await sendAsoFlowMail(user, sendInput());
    expect(result.status).toBe("kit_sent");
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.recordSent).toHaveBeenCalledWith(
      user,
      expect.objectContaining({
        id,
        version: 3,
        documentHash,
        recipient: "clinic@example.test",
        providerMessageId: "gmail-100",
      })
    );
    expect(Buffer.from(m.send.mock.calls[0][1], "base64url").toString()).toContain(
      "Content-Type: application/pdf"
    );
    await expect(sendAsoFlowMail(user, sendInput())).rejects.toMatchObject({ status: 409 });
    expect(m.send).toHaveBeenCalledTimes(1);
  });
  it("does not send to a typed address differing from the current clinic record", async () => {
    await expect(
      sendAsoFlowMail(user, { ...sendInput(), recipient: "outsider@example.test" })
    ).rejects.toMatchObject({ status: 400 });
    expect(m.send).not.toHaveBeenCalled();
    expect(m.verified).not.toHaveBeenCalled();
  });
  it("does not repeat a kit with a manual proof of sending", async () => {
    card.kitDelivery = {
      recipient: "clinic@example.test",
      reference: "external-message-1",
      hash: documentHash,
      method: "manual",
      sentAt: "2026-10-19T13:00:00Z",
    };
    await expect(sendAsoFlowMail(user, sendInput())).rejects.toMatchObject({ status: 409 });
    expect(m.send).not.toHaveBeenCalled();
  });
  it("leaves an ambiguous transport result reserved and does not close the card", async () => {
    m.send.mockRejectedValueOnce(new Error("network outcome unknown"));
    await expect(sendAsoFlowMail(user, sendInput())).rejects.toMatchObject({ status: 409 });
    expect([...db.values()].some((value) => value.state === "uncertain")).toBe(true);
    expect(m.recordSent).not.toHaveBeenCalled();
    await expect(sendAsoFlowMail(user, sendInput())).rejects.toMatchObject({ status: 409 });
    expect(m.send).toHaveBeenCalledTimes(1);
  });
  it("recovers a lost database acknowledgement without downgrading a confirmed send", async () => {
    m.recordSent.mockImplementationOnce(async (_actor, sent) => {
      card.status = "kit_sent";
      card.kitDelivery = {
        recipient: sent.recipient,
        reference: sent.providerMessageId,
        sentAt: sent.sentAt,
        hash: documentHash,
        method: "gmail",
      };
      apply(`${root}/outbox/${sent.outboxId}`, {
        state: "sent",
        providerMessageId: sent.providerMessageId,
      });
      throw new Error("commit acknowledgement lost");
    });
    expect((await sendAsoFlowMail(user, sendInput())).status).toBe("kit_sent");
    expect([...db.values()].some((value) => value.state === "uncertain")).toBe(false);
    expect(m.send).toHaveBeenCalledTimes(1);
  });
  it("requires current review and archive of the same ASO before client sending", () => {
    expect(() => validateAsoMailStage(card, "aso")).toThrow();
    card.status = "reviewed";
    card.aso = { ...card.kit!, examDate: "2026-10-20" };
    card.review = {
      hash: documentHash,
      reviewedAt: "2026-10-20T12:00:00Z",
      reviewedBy: user.uid,
      identityConfirmed: true,
      documentChecked: true,
    };
    card.archive = {
      companyId: "CLIENT",
      employeeId: "EMP",
      hash: "other",
      fileName: "aso.pdf",
      archivedAt: "2026-10-20T12:00:00Z",
    };
    expect(() => validateAsoMailStage(card, "aso")).toThrow();
    card.archive.hash = documentHash;
    expect(() => validateAsoMailStage(card, "aso")).not.toThrow();
  });
  it("reconciles an ambiguous accepted send without invoking the send API again", async () => {
    const outboxId = "c".repeat(64);
    card.mailLock = {
      outboxId,
      documentHash,
      kind: "kit",
      recipient: "clinic@example.test",
      version: 3,
      startedAt: "2026-10-19T12:00:00Z",
    };
    db.set(`${root}/outbox/${outboxId}`, {
      caseId: id,
      version: 3,
      kind: "kit",
      recipient: "clinic@example.test",
      documentHash,
      mailbox: "sender@example.test",
      messageId: `<nai-aso-${outboxId}@example.test>`,
      state: "uncertain",
    });
    m.find.mockResolvedValue({ messageId: "gmail-found", sentAt: "2026-10-19T12:00:00Z" });
    expect((await reconcileAsoFlowMail(user, id)).reconciled).toBe(true);
    expect(m.send).not.toHaveBeenCalled();
    expect(m.recordSent).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ providerMessageId: "gmail-found", outboxId })
    );
  });
});

describe("incoming PDFs remain candidates until reviewed", () => {
  it("does not release candidate metadata after access is revoked during the inbox query", async () => {
    seedCandidate();
    afterInboxQuery = () => {
      m.getCard.mockRejectedValue(new AuthError("access revoked", 403));
    };
    await expect(asoFlowMailbox(user, id)).rejects.toMatchObject({ status: 403 });
  });

  it("does not release attachment bytes after permission is revoked during download", async () => {
    seedCandidate();
    m.getCard.mockResolvedValueOnce(structuredClone(card));
    m.getCard.mockRejectedValueOnce(new AuthError("Acesso revogado.", 403));
    await expect(readAsoMailCandidate(user, id, candidateId)).rejects.toMatchObject({
      status: 403,
    });
    expect(m.file).toHaveBeenCalled();
    expect(m.upload).not.toHaveBeenCalled();
    expect(db.get(`${root}/inbox/${candidateId}`)?.acceptedAt).toBeUndefined();
  });
  it("can reach pending attachments after a full page of previously accepted candidates", async () => {
    for (let number = 1; number <= 201; number++) {
      const key = number.toString(16).padStart(64, "0");
      db.set(`${root}/inbox/${key}`, {
        id: key,
        caseId: id,
        fileName: "aso.pdf",
        receivedAt: "2026-10-20T12:00:00Z",
        ...(number <= 200 ? { acceptedAt: "2026-10-20T13:00:00Z" } : {}),
      });
    }
    const first = await asoFlowMailbox(user, id);
    expect(first.candidates).toHaveLength(0);
    expect(first.nextCursor).toBeTruthy();
    const last = await asoFlowMailbox(user, id, first.nextCursor!);
    expect(last.candidates).toHaveLength(1);
    expect(last.nextCursor).toBeNull();
  });
  it("checks candidate ownership and PDF integrity before offering the original", async () => {
    seedCandidate();
    files.set(
      `aso-mail-private/${id}/${candidateId}.pdf`,
      Buffer.from(bytes.toString().replace("synthetic", "tampering"))
    );
    await expect(readAsoMailCandidate(user, id, candidateId)).rejects.toMatchObject({
      status: 409,
    });
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("recovers an intake acknowledgement without resetting a reviewed ASO", async () => {
    seedCandidate();
    card.status = "reviewed";
    card.aso = {
      ...card.kit!,
      source: "email",
      reference: "Gmail msg-in / anexo 1",
      examDate: "2026-10-20",
    };
    const accepted = await acceptAsoMailCandidate(user, {
      action: "receive",
      id,
      version: 2,
      candidateId,
      examDate: "2026-10-20",
      identityConfirmed: true,
      documentChecked: true,
    });
    expect(accepted.status).toBe("reviewed");
    expect(m.upload).not.toHaveBeenCalled();
    expect(db.get(`${root}/inbox/${candidateId}`)?.acceptedAt).toBeTruthy();
  });
  it("stores a matched clinic reply privately but never changes card status by itself", async () => {
    client.users.messages.list.mockResolvedValue({
      data: { messages: [{ id: "msg-new" }], nextPageToken: "next-page" },
    });
    client.users.messages.get.mockResolvedValue({
      data: {
        id: "msg-new",
        internalDate: "1792497600000",
        payload: {
          headers: [
            { name: "Subject", value: `Re: [NAI-ASO:${id}] Kit` },
            { name: "From", value: "Clínica <clinic@example.test>" },
          ],
          parts: [
            {
              partId: "1",
              filename: "aso.pdf",
              mimeType: "application/pdf",
              body: { size: bytes.length, data: bytes.toString("base64url") },
            },
          ],
        },
      },
    });
    const result = await syncAsoFlowMail(user, id);
    expect(result).toMatchObject({ saved: 1, hasMore: true });
    expect([...db.keys()].filter((key) => key.includes("/inbox/"))).toHaveLength(1);
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.recordSent).not.toHaveBeenCalled();
  });
  it("does not associate a namesake email without the unique case marker", async () => {
    client.users.messages.list.mockResolvedValue({ data: { messages: [{ id: "unrelated" }] } });
    client.users.messages.get.mockResolvedValue({
      data: {
        id: "unrelated",
        payload: {
          headers: [
            { name: "Subject", value: "ASO Pessoa Teste" },
            { name: "From", value: "clinic@example.test" },
          ],
        },
      },
    });
    expect(await syncAsoFlowMail(user, id)).toMatchObject({ saved: 0, skipped: 1 });
    expect(files.size).toBe(0);
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("skips an excessive attachment tree without poisoning the recurring scan", async () => {
    client.users.messages.list.mockResolvedValue({
      data: { messages: [{ id: "excessive" }, { id: "following" }] },
    });
    const headers = [
      { name: "Subject", value: `[NAI-ASO:${id}] Retorno` },
      { name: "From", value: "clinic@example.test" },
    ];
    client.users.messages.get
      .mockResolvedValueOnce({
        data: {
          internalDate: "1792497600000",
          payload: {
            headers,
            parts: Array.from({ length: 11 }, (_, part) => ({
              partId: String(part),
              filename: `aso${part}.pdf`,
              mimeType: "application/pdf",
              body: { size: bytes.length, data: bytes.toString("base64url") },
            })),
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          internalDate: "1792497600000",
          payload: {
            headers,
            parts: [
              {
                partId: "1",
                filename: "aso.pdf",
                mimeType: "application/pdf",
                body: { size: bytes.length, data: bytes.toString("base64url") },
              },
            ],
          },
        },
      });
    expect(await syncAsoFlowMail(user, id)).toMatchObject({
      saved: 1,
      skipped: 1,
      examined: 2,
      hasMore: false,
    });
    expect(m.upload).not.toHaveBeenCalled();
  });
});
