import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getStorage } from "firebase-admin/storage";
import { adminDb } from "@/lib/firebase-admin";
import type { AuthContext } from "@/lib/auth/auth-context";
import { pdfPath } from "@/services/client-source-pdf";
import { getPermits, savePermit } from "@/services/pt-apr";
import { type AprEvidence } from "@/lib/pt-apr";
vi.mock("@/firebase/config", () => ({
  firebaseConfig: { storageBucket: "demo-nai-security.appspot.com" },
}));
const companyId = "empresa-pt-apr";
const tech: AuthContext = {
  uid: "tst-pt",
  role: "SAFETY_TECH",
  tenantId: companyId,
  email: "tst@example.test",
  servedCompanies: [],
  permissions: [],
};
const admin: AuthContext = { ...tech, uid: "admin-pt", role: "ADMIN" };
const pdf = Buffer.from("%PDF-1.4\nDocumento fictício para os testes do acervo.\n%%EOF");
const hash = createHash("sha256").update(pdf).digest("hex");
const evidence: AprEvidence = {
  hazards: "Riscos específicos conferidos na vistoria de teste",
  controls: "Medidas do protocolo local verificadas",
  teamEvidence: hash,
  answers: {
    isolation: { status: "not_applicable", note: "Sem instalação elétrica no ensaio" },
    equipment: { status: "not_applicable", note: "Justificativa registrada pelo técnico" },
    area: { status: "confirmed", note: "Conferência da sinalização registrada" },
  },
};
const signal = new AbortController().signal;
const unit = adminDb.collection("companies").doc(companyId);
const create = () => ({
  action: "create",
  companyId,
  permitId: randomUUID(),
  employeeId: "worker",
  task: "Inspeção fictícia",
  location: "Unidade de teste",
});
let env: RulesTestEnvironment;
beforeAll(async () => {
  expect(process.env.FIRESTORE_EMULATOR_HOST).toMatch(/^(localhost|127\.0\.0\.1):/);
  expect(process.env.FIREBASE_STORAGE_EMULATOR_HOST).toMatch(/^(localhost|127\.0\.0\.1):/);
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  await Promise.all([
    unit.set({ name: "Unidade", active: true }),
    unit
      .collection("employees")
      .doc("worker")
      .set({ name: "Colaborador de ensaio", status: "active", companyId }),
    ...[tech, admin].map((user) =>
      adminDb
        .collection("users")
        .doc(user.uid)
        .set({ role: user.role, tenantId: companyId, accessEnabled: true })
    ),
    adminDb.collection("users").doc("pt-root").set({ role: "SUPER_ADMIN", accessEnabled: true }),
    unit.collection("sourceDocuments").doc(hash).set({ name: "Confirmacao-equipe.pdf", companyId }),
    getStorage()
      .bucket("demo-nai-security.appspot.com")
      .file(pdfPath(companyId, hash))
      .save(pdf, { resumable: false, contentType: "application/pdf" }),
  ]);
});
afterAll(async () => {
  await env?.cleanup();
});
it("persiste o protocolo, recusa evidência insuficiente, finaliza uma única vez e recupera em outra sessão", async () => {
  const c = create(),
    review = { action: "review", permitId: c.permitId, companyId, evidence, confirmed: true };
  const [a, b] = await Promise.all([savePermit(admin, c, signal), savePermit(admin, c, signal)]);
  expect(a.id).toBe(b.id);
  expect(a.status).toBe("awaiting_review");
  await expect(savePermit(tech, { ...review, confirmed: false }, signal)).rejects.toThrow();
  await expect(
    savePermit(
      tech,
      {
        ...review,
        evidence: {
          ...evidence,
          answers: { ...evidence.answers, area: { status: "pending", note: "Pendente" } },
        },
      },
      signal
    )
  ).rejects.toThrow();
  await expect(savePermit(admin, review, signal)).rejects.toThrow();
  await expect(
    savePermit(tech, { ...review, evidence: { ...evidence, teamEvidence: "a".repeat(64) } }, signal)
  ).rejects.toThrow();
  expect((await getPermits(admin, companyId)).items.find((i) => i.id === a.id)?.status).toBe(
    "awaiting_review"
  );
  const [one, two] = await Promise.all([
    savePermit(tech, review, signal),
    savePermit(tech, review, signal),
  ]);
  expect(one).toEqual(two);
  expect(one).toMatchObject({
    status: "awaiting_signature",
    reviewerUid: tech.uid,
    evidenceName: "Confirmacao-equipe.pdf",
    evidence,
  });
  expect(
    (await getPermits({ ...admin }, companyId)).items.find((i) => i.id === c.permitId)
  ).toEqual(one);
  await expect(
    savePermit(tech, { ...review, evidence: { ...evidence, controls: "Outro registro" } }, signal)
  ).rejects.toThrow();
  await expect(getPermits({ ...tech, tenantId: "outra" }, companyId)).rejects.toThrow();
  const db = env.authenticatedContext("pt-root").firestore();
  const ref = doc(db, "workPermitsPrivate", companyId, "permits", c.permitId);
  await assertFails(getDoc(ref));
  await assertFails(setDoc(ref, { status: "awaiting_signature" }));
});
