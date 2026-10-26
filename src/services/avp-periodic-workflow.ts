import "server-only";
import { createHash } from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";
import { readAvpPeriodicControl } from "./avp-periodic-control";
import { AuthError } from "@/lib/auth/errors";
import {
  validatePeriodicTransition,
  type PeriodicPatch,
  type PeriodicWorkState,
  type PeriodicWorkCard,
} from "@/lib/avp-periodic-workflow";
import type { PeriodicPerson } from "@/lib/avp-periodic-control";

// Existing integrations rules deny client writes; transitions go through the audited API.
const collection = () =>
  adminDb.collection("integrations").doc("grupo-avp").collection("periodic-work-2026");
const version = (person: PeriodicPerson) =>
  createHash("sha256").update(JSON.stringify(person)).digest("hex");
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
  const [control, saved] = await Promise.all([
    readAvpPeriodicControl(),
    collection().limit(10001).get(),
  ]);
  if (saved.size > 10000) throw new Error("Limite da campanha excedido.");
  const states = new Map(saved.docs.map((d) => [d.id, d.data() as PeriodicWorkState]));
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const cards: PeriodicWorkCard[] = control.people.map((person) => {
    const sourceVersion = version(person),
      previous = states.get(person.id);
    const state = previous?.sourceVersion === sourceVersion ? previous : null;
    return {
      person,
      sourceVersion,
      state,
      stage: state?.stage || "validar",
      blocked: person.classification === "cancelled" || person.duplicateRows > 0 || !person.unit,
      sourceChanged: !!previous && !state,
      overdue: !!state?.nextDate && state.nextDate < today && state.stage !== "concluido",
    };
  });
  return { checkedAt: control.checkedAt, cards };
}

export async function patchPeriodicWork(patch: PeriodicPatch, actor: string) {
  const control = await readAvpPeriodicControl();
  const person = control.people.find((p) => p.id === patch.id);
  if (!person || version(person) !== patch.sourceVersion)
    throw new AuthError("A fonte mudou. Atualize o painel e confira o participante.", 409);
  const ref = collection().doc(patch.id);
  await adminDb.runTransaction(async (tx) => {
    const saved = await tx.get(ref),
      previous = saved.exists ? (saved.data() as PeriodicWorkState) : null;
    const current = previous?.sourceVersion === patch.sourceVersion ? previous : null;
    if ((current?.revision || 0) !== patch.revision)
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
      previousStage: current?.stage || "validar",
    });
  });
}
