import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { parsePgrDocumentPages } from "@/lib/pgr-document-parser";
import type { AuthContext } from "@/lib/auth/auth-context";
const storage = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: async () => ({
    uid: "technical-user",
    email: "synthetic@example.test",
    role: "ENGINEER",
    tenantId: null,
    permissions: [],
    servedCompanies: ["legacy-cetesb"],
  }),
}));
vi.mock("@/lib/auth/require-pgr-app-check", () => ({ requirePgrAppCheck: async () => {} }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ file: () => ({ save: storage.save }) }) }),
}));
vi.mock("@/services/pgr-document-analysis", () => ({ analyzePgrDocument: vi.fn() }));
import { adminDb } from "@/lib/firebase-admin";
import { savePgrDraft } from "@/services/pgr-workspace";
import { PATCH as patchTask } from "@/app/api/pgr/tasks/route";
import { NextRequest } from "next/server";
let env: RulesTestEnvironment;
const user: AuthContext = {
  uid: "technical-user",
  email: "synthetic@example.test",
  role: "ENGINEER",
  tenantId: null,
  permissions: [],
  servedCompanies: ["legacy-cetesb"],
};
const bytes = Buffer.from("%PDF-1.7\nSynthetic test document\n%%EOF");
const hash = createHash("sha256").update(bytes).digest("hex");
const draftId = "a".repeat(64);
const params = {
  draftId,
  companyId: "legacy-cetesb",
  confirmed: true,
  createCompany: false,
  dueDate: "2026-11-10",
};
const company = () => adminDb.collection("companies").doc("legacy-cetesb");
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  storage.save.mockReset();
  storage.save.mockResolvedValue(undefined);
  await company().set({ name: "CETESB", cnpj: "43.776.491/0001-70" });
  const analysis = parsePgrDocumentPages([
    {
      numero: 1,
      texto:
        "RAZÃO SOCIAL: CETESB\nCNPJ: 43.776.491/0001-70\nRECONHECIMENTO DE RISCOS AMBIENTAIS\nMANUTENÇÃO\nTrabalhadores expostos a ruído contínuo de motores.",
    },
  ]);
  await adminDb
    .collection("users")
    .doc(user.uid)
    .collection("pgr_analysis_drafts")
    .doc(draftId)
    .set({
      analysis,
      ownerUid: user.uid,
      sourceHash: hash,
      fileName: "synthetic.pdf",
      mime: "application/pdf",
      expiresAtMs: Date.now() + 60000,
    });
});
afterAll(async () => {
  await env?.cleanup();
  await adminDb.terminate();
});
describe("PGR: persistência real, vínculo e repetição", () => {
  it("grava documento, riscos, checklists e auditoria somente no cliente correto", async () => {
    const saved = await savePgrDraft(user, params, bytes);
    expect(saved.alreadySaved).toBe(false);
    expect(saved.riskCount).toBeGreaterThan(0);
    const card = await company().collection("pgr_cards").doc(hash).get();
    expect(card.data()?.companyId).toBe("legacy-cetesb");
    const risks = await company().collection("risks").get();
    expect(
      risks.docs.every((d) => d.data().severity === null && d.data().probability === null)
    ).toBe(true);
    const tasks = await company().collection("tasks").get();
    expect(tasks.size).toBe(saved.taskCount);
    expect(
      tasks.docs.every(
        (d) =>
          d.data().status === "todo" &&
          d.data().checklist.every((c: { checked: boolean }) => !c.checked)
      )
    ).toBe(true);
    expect((await adminDb.collection("companies").doc("avp").collection("tasks").get()).empty).toBe(
      true
    );
    expect((await company().collection("audit_logs").get()).size).toBe(1);
  });
  it("reimportação preserva andamento, responsável e checklists sem duplicar", async () => {
    await savePgrDraft(user, params, bytes);
    const tasks = await company().collection("tasks").get();
    const first = tasks.docs[0];
    await first.ref.update({
      status: "doing",
      responsibleName: "Responsável de teste",
      checklist: [{ text: "Validação real", checked: true, mandatory: true }],
    });
    const repeat = await savePgrDraft(user, params, bytes);
    expect(repeat.alreadySaved).toBe(true);
    expect(repeat.analysis).toEqual(
      (await company().collection("pgr_cards").doc(hash).get()).data()?.analysis
    );
    expect((await company().collection("tasks").get()).size).toBe(tasks.size);
    expect((await first.ref.get()).data()?.status).toBe("doing");
    expect((await first.ref.get()).data()?.checklist[0].checked).toBe(true);
    expect((await company().collection("audit_logs").get()).size).toBe(1);
  });
  it("falha no upload não confirma cards e permite tentativa posterior", async () => {
    storage.save.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(savePgrDraft(user, params, bytes)).rejects.toThrow("storage unavailable");
    expect((await company().collection("pgr_cards").get()).empty).toBe(true);
    expect((await company().collection("tasks").get()).empty).toBe(true);
    expect((await savePgrDraft(user, params, bytes)).alreadySaved).toBe(false);
  });
  it("CNPJ alterado ou empresa não autorizada bloqueiam a gravação antes do upload", async () => {
    await company().update({ cnpj: "44.337.647/0001-89" });
    await expect(savePgrDraft(user, params, bytes)).rejects.toMatchObject({ status: 409 });
    expect(storage.save).not.toHaveBeenCalled();
    await expect(savePgrDraft(user, { ...params, companyId: "avp" }, bytes)).rejects.toMatchObject({
      status: 403,
    });
    expect((await company().collection("tasks").get()).empty).toBe(true);
  });
  it("recusa original trocado, prazo impossível e rascunho de outro usuário", async () => {
    await expect(savePgrDraft(user, params, Buffer.from("another original"))).rejects.toMatchObject(
      { status: 400 }
    );
    await expect(
      savePgrDraft(user, { ...params, dueDate: "2026-02-30" }, bytes)
    ).rejects.toMatchObject({ status: 400 });
    await expect(savePgrDraft({ ...user, uid: "other-user" }, params, bytes)).rejects.toMatchObject(
      { status: 410 }
    );
    expect(storage.save).not.toHaveBeenCalled();
  });
  it("não cria segundo cadastro quando o CNPJ já tem ID legado", async () => {
    await expect(
      savePgrDraft({ ...user, role: "SUPER_ADMIN" }, { ...params, createCompany: true }, bytes)
    ).rejects.toMatchObject({ status: 409 });
    expect(storage.save).not.toHaveBeenCalled();
  });
  it("finaliza card somente com checklist obrigatório conferido e preserva autoria", async () => {
    await savePgrDraft(user, params, bytes);
    const first = (await company().collection("tasks").get()).docs[0];
    const request = (patch: Record<string, unknown>) =>
      new NextRequest("https://nai.local/api/pgr/tasks", {
        method: "PATCH",
        body: JSON.stringify({ companyId: "legacy-cetesb", taskId: first.id, patch }),
      });
    expect((await patchTask(request({ status: "done" }))).status).toBe(409);
    expect((await first.ref.get()).data()?.status).toBe("todo");
    expect((await patchTask(request({ companyId: "avp" }))).status).toBe(422);
    expect((await first.ref.get()).data()?.companyId).toBe("legacy-cetesb");
    const checklist = first
      .data()
      .checklist.map((c: Record<string, unknown>) => ({ ...c, checked: true }));
    expect((await patchTask(request({ status: "done", checklist }))).status).toBe(200);
    const updated = (await first.ref.get()).data();
    expect(updated?.status).toBe("done");
    expect(updated?.progress).toBe(100);
    expect(updated?.modifiedBy).toBe(user.uid);
  });
});
