import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { readAvpPeriodicSnapshot } from "./avp-periodic-sync";
import { AuthError } from "@/lib/auth/errors";
import {
  validatePeriodicTransition,
  type PeriodicPatch,
  type PeriodicWorkState,
  type PeriodicWorkCard,
} from "@/lib/avp-periodic-workflow";
// This existing namespace denies every direct client read/write, including administrators.
const collection = () =>
  adminDb.collection("clinic_portal_private").doc("grupo-avp").collection("periodic-work-2026");
async function source() {
  const control = await readAvpPeriodicSnapshot(true);
  if (control.sync?.status === "ERROR") throw new Error("A sincronização da fonte falhou.");
  if (control.people.some((person) => !person.workId || !person.workSourceVersion))
    throw new Error("Atualize a campanha para preparar os vínculos de origem.");
  return control;
}
export async function readPeriodicHistory(id: string) {
  const result = await collection()
    .doc(id)
    .collection("history")
    .orderBy("updatedAt", "desc")
    .limit(30)
    .get();
  return result.docs.map((d) => d.data());
}
export async function readPeriodicWork() {
  const [control, saved] = await Promise.all([source(), collection().limit(10001).get()]);
  if (saved.size > 10000) throw new Error("Limite da campanha excedido.");
  const states = new Map(saved.docs.map((d) => [d.id, d.data() as PeriodicWorkState]));
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const cards: PeriodicWorkCard[] = control.people.map((person) => {
    const sourceVersion = person.workSourceVersion!,
      previous = states.get(person.workId!);
    const state = previous?.sourceVersion === sourceVersion ? previous : null;
    return {
      id: person.workId!,
      revision: previous?.revision || 0,
      person,
      sourceVersion,
      state,
      stage: state?.stage || "validar",
      blocked:
        person.classification === "cancelled" ||
        person.duplicateRows > 0 ||
        !person.unit ||
        !person.workIdentityComplete,
      sourceChanged: !!previous && !state,
      overdue: !!state?.nextDate && state.nextDate < today && state.stage !== "concluido",
    };
  });
  return { checkedAt: control.checkedAt, cards };
}

export async function patchPeriodicWork(patch: PeriodicPatch, actor: string) {
  const control = await source();
  const person = control.people.find((p) => p.workId === patch.id);
  if (!person || person.workSourceVersion !== patch.sourceVersion)
    throw new AuthError("A fonte mudou. Atualize o painel e confira o participante.", 409);
  const ref = collection().doc(patch.id);
  await adminDb.runTransaction(async (tx) => {
    const saved = await tx.get(ref),
      previous = saved.exists ? (saved.data() as PeriodicWorkState) : null;
    const current = previous?.sourceVersion === patch.sourceVersion ? previous : null;
    if ((previous?.revision || 0) !== patch.revision)
      throw new AuthError("Outro operador atualizou o card. Recarregue.", 409);
    try {
      validatePeriodicTransition(person, current, patch);
    } catch (e) {
      throw new AuthError(e instanceof Error ? e.message : "Transição inválida.", 400);
    }
    const updatedAt = new Date().toISOString();
    const state: PeriodicWorkState = {
      sourceVersion: patch.sourceVersion,
      revision: patch.revision + 1,
      stage: patch.stage,
      responsible: patch.responsible,
      nextDate: patch.nextDate,
      updatedAt,
      updatedBy: actor,
    };
    tx.set(ref, state);
    tx.set(ref.collection("history").doc(), {
      ...state,
      evidence: patch.evidence,
      evidenceDate: patch.evidenceDate,
      evidenceKind: patch.evidenceKind,
      clinic: patch.clinic,
      appointmentTime: patch.appointmentTime,
      receiptNumber: patch.receiptNumber,
      nonApplicabilityReason: patch.nonApplicabilityReason,
      previousStage: current?.stage || "validar",
    });
  });
}
