import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod/v3";
import { adminDb } from "@/lib/firebase-admin";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { parseClaims } from "@/lib/auth/claims";
import { NR_CHECKLISTS } from "@/lib/nr-data";
import { privateBucket } from "./private-json-store";

const command = z
  .object({
    protocolId: z.string().uuid(),
    companyId: z
      .string()
      .min(1)
      .max(128)
      .refine(
        (value) =>
          !/[\/\\\u0000-\u001f]/.test(value) && ![".", "..", "all", "unauthorized"].includes(value)
      ),
    nr: z.string().regex(/^nr[0-9]{2}$/),
    responses: z.record(z.enum(["CONFORME", "NÃO CONFORME", "NÃO AVALIADO"])),
  })
  .strict();

export async function finalizeChecklist(uid: string, input: unknown) {
  const parsed = command.safeParse(input);
  if (!parsed.success) throw badRequest("Informe protocolo, unidade, norma e respostas válidos.");
  const { protocolId, companyId, nr, responses } = parsed.data;
  const checklist = NR_CHECKLISTS[nr];
  if (
    !checklist ||
    Object.keys(responses).length !== checklist.items.length ||
    !checklist.items.every((item) => Object.hasOwn(responses, item.id))
  )
    throw badRequest("Responda a todos os itens da norma selecionada.");
  const company = adminDb.collection("companies").doc(companyId);
  const report = company.collection("reports").doc("checklist_" + protocolId);
  const legacy = company.collection("reports").doc(protocolId);
  const reservation = company.collection("checklist_reservations").doc(protocolId);
  const authorized = async (tx: FirebaseFirestore.Transaction) => {
    const profile = (await tx.get(adminDb.collection("users").doc(uid))).data();
    if (!profile || profile.accessEnabled === false || profile.isDeleted === true)
      throw forbidden();
    const { role, tenantId } = parseClaims(profile);
    const internal =
      role === "SUPER_ADMIN" ||
      (["ADMIN", "OPERATIONS"].includes(role) &&
        !profile.tenantId &&
        (!profile.companyId || profile.companyId === "nextcon"));
    if (
      !internal &&
      !(tenantId === companyId && ["ADMIN", "CLIENT_ADMIN", "ENGINEER"].includes(role))
    )
      throw forbidden();
    const data = (await tx.get(company)).data();
    if (!data || data.active === false || data.isDeleted === true)
      throw badRequest("Unidade indisponível.");
    return String(data.name || companyId);
  };
  const conflict = () =>
    new AuthError(
      "Este protocolo já foi utilizado com outras respostas ou por outro auditor.",
      409
    );
  const matches = (data: FirebaseFirestore.DocumentData | undefined) =>
    data?.auditorId === uid &&
    data.companyId === companyId &&
    data.nr === checklist.nr &&
    checklist.items.every((item) => data.responses?.[item.id] === responses[item.id]) &&
    Object.keys(data.responses || {}).length === checklist.items.length;
  const pending = await adminDb.runTransaction(async (tx) => {
    const companyName = await authorized(tx);
    const [current, older, held] = await tx.getAll(report, legacy, reservation);
    const existing = current.exists ? current : older;
    if (existing.exists) {
      if (!matches(existing.data()?.auditData)) throw conflict();
      return null;
    }
    if (held.exists) {
      const data = held.data()!;
      if (!matches(data.auditData)) throw conflict();
      return { timestamp: String(data.auditData.timestamp), companyName: String(data.companyName) };
    }
    const timestamp = new Date().toISOString();
    tx.create(reservation, {
      companyName,
      auditData: { auditorId: uid, companyId, nr: checklist.nr, responses, timestamp },
    });
    return { timestamp, companyName };
  });
  if (!pending) return { alreadyRegistered: true };
  const { timestamp, companyName } = pending;
  const auditData = {
    auditorId: uid,
    companyId,
    nr: checklist.nr,
    responses,
    timestamp,
    progress: 100,
  };
  const storagePath = "clientes/" + companyId + "/protocolos_nr/" + protocolId + ".pdf";
  const file = privateBucket().file(storagePath);
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  pdf.setCreationDate(new Date(timestamp));
  pdf.setFileId(protocolId.replace(/-/g, ""));
  let y = 20;
  const write = (text: string) => {
    for (const line of pdf.splitTextToSize(text, 175)) {
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(line, 16, y);
      y += 7;
    }
  };
  write("Protocolo de checklist " + checklist.nr);
  write(companyName);
  write("Auditor: " + uid);
  write(timestamp);
  for (const item of checklist.items) write(item.question + " — " + responses[item.id]);
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        uid,
        companyId,
        protocolId,
        nr,
        timestamp,
        checklist.items.map((item) => responses[item.id]),
      ])
    )
    .digest("hex");
  try {
    await file.save(Buffer.from(pdf.output("arraybuffer")), {
      resumable: false,
      contentType: "application/pdf",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { cacheControl: "private, no-store", metadata: { checklistDigest: digest } },
    });
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || Number(error.code) !== 412)
      throw error;
    const [metadata] = await file.getMetadata();
    if (metadata.metadata?.checklistDigest !== digest) throw conflict();
  }
  return adminDb.runTransaction(async (tx) => {
    await authorized(tx);
    const [current, held] = await tx.getAll(report, reservation);
    if (current.exists) {
      if (!matches(current.data()?.auditData)) throw conflict();
      return { alreadyRegistered: true };
    }
    if (!matches(held.data()?.auditData)) throw conflict();
    tx.create(report, {
      name: "Laudo Técnico - " + checklist.nr,
      companyId,
      companyName,
      reportType: nr,
      storagePath,
      auditData,
      createdAt: timestamp,
      serverTimestamp: FieldValue.serverTimestamp(),
    });
    tx.delete(reservation);
    return { alreadyRegistered: false };
  });
}
