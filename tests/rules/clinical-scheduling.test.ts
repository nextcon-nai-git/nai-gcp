import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  deleteField,
  collection,
  doc,
  getDocs,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import {
  advanceClinicalAppointment,
  createClinicalAppointment,
} from "../../src/services/clinical-scheduling";

let env: RulesTestEnvironment;
const companyId = "schedule-a";
const root = "companies/" + companyId + "/agendamentos";
const input = {
  companyId,
  employeeId: "worker-a",
  date: "2026-10-20",
  time: "08:30",
  type: "Periódico",
};
const allowedUsers = [
  "schedule-admin",
  "schedule-client",
  "schedule-internal",
  "schedule-ops",
  "schedule-super",
];
const appointment = (overrides: Record<string, unknown> = {}) => ({
  companyId,
  companyName: "Empresa sintética A",
  colaborador_id: "worker-a",
  colaborador_nome: "Pessoa sintética A",
  data_hora: "2026-10-20T08:30:00",
  tipo: "Periódico",
  status: "Agendado",
  check_in_realizado: false,
  createdAt: serverTimestamp(),
  ...overrides,
});
const checkIn = () => ({
  status: "Em Espera",
  check_in_realizado: true,
  check_in_at: new Date().toISOString(),
});
// The modular SDK unwraps the compat test handle at runtime.
const db = (uid = "schedule-admin") =>
  env.authenticatedContext(uid).firestore() as unknown as Firestore;
const seedAppointment = async (id: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), root, id), data));

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const store = ctx.firestore();
    const batch = writeBatch(store);
    for (const [uid, role, tenant] of [
      ["schedule-admin", "ADMIN", companyId],
      ["schedule-client", "CLIENT_ADMIN", companyId],
      ["schedule-internal", "ADMIN", "nextcon"],
      ["schedule-ops", "OPERATIONS", "nextcon"],
      ["schedule-super", "SUPER_ADMIN", "nextcon"],
      ["schedule-tenant-ops", "OPERATIONS", companyId],
      ["schedule-doctor", "DOCTOR", companyId],
      ["schedule-hr", "HR", companyId],
      ["schedule-foreign", "ADMIN", "schedule-b"],
    ]) {
      batch.set(doc(store, "users", uid), {
        role,
        companyId: tenant,
        tenantId: tenant === "nextcon" ? null : tenant,
      });
    }
    batch.set(doc(store, "users/schedule-served-doctor"), {
      role: "DOCTOR",
      companyId: "schedule-doctor-home",
      tenantId: "schedule-doctor-home",
      servedCompanies: [companyId],
    });
    batch.set(doc(store, "companies", companyId), { name: "Empresa sintética A" });
    batch.set(doc(store, "companies/schedule-b"), { name: "Empresa sintética B" });
    batch.set(doc(store, "companies", companyId, "employees", "worker-a"), {
      companyId,
      name: "Pessoa sintética A",
    });
    batch.set(doc(store, "companies/schedule-b/employees/worker-b"), {
      companyId: "schedule-b",
      name: "Pessoa sintética B",
    });
    batch.set(doc(store, "companies", companyId, "employees", "mismatched"), {
      companyId: "schedule-b",
      name: "Pessoa sintética A",
    });
    batch.set(doc(store, "companies", companyId, "employees", "deleted"), {
      companyId,
      name: "Pessoa sintética A",
      isDeleted: true,
    });
    batch.set(doc(store, "companies", companyId, "employees", "legacy-worker"), {
      name: "Pessoa legada sintética",
    });
    batch.set(doc(store, root, "scheduled"), appointment());
    batch.set(doc(store, root, "waiting"), appointment(checkIn()));
    batch.set(doc(store, root, "active"), appointment({ ...checkIn(), status: "Em Atendimento" }));
    batch.set(
      doc(store, root, "completed-legacy"),
      appointment({
        status: "Concluído",
        result: "Resultado legado sintético",
      })
    );
    batch.set(doc(store, root, "active", "legacy", "detail"), { legacy: true });
    batch.set(doc(store, "agendamentos/root-legacy"), { status: "Concluído", legacy: true });
    await batch.commit();
  });
});
afterAll(async () => {
  await env?.cleanup();
});

describe("escritores ativos de agendamento sob as regras reais", () => {
  it("permite ao médico externo ler somente a empresa servida, colaboradores e atendimentos", async () => {
    const store = db("schedule-served-doctor");
    await assertSucceeds(getDoc(doc(store, "companies", companyId)));
    await assertSucceeds(
      getDocs(query(collection(store, "companies"), where("__name__", "in", [companyId])))
    );
    await assertSucceeds(getDoc(doc(store, "companies", companyId, "employees", "worker-a")));
    await assertSucceeds(
      getDocs(query(collection(store, "companies", companyId, "employees"), orderBy("name", "asc")))
    );
    await assertSucceeds(getDoc(doc(store, root, "active")));
    await assertSucceeds(getDocs(query(collection(store, root), orderBy("data_hora"))));
    await assertFails(getDoc(doc(store, "companies", "schedule-b")));
    await assertFails(getDoc(doc(store, "companies/schedule-b/employees/worker-b")));
    await assertFails(updateDoc(doc(store, root, "active"), { status: "Concluído" }));
  });

  it.each(allowedUsers)("preserva criação, check-in e início pelo serviço para %s", async (uid) => {
    const store = db(uid);
    const result = await createClinicalAppointment(store, input);
    const ref = doc(store, root, result.id);
    expect((await getDoc(ref)).data()).toMatchObject({
      colaborador_id: input.employeeId,
      companyId,
      status: "Agendado",
      createdAt: expect.any(Timestamp),
    });
    await advanceClinicalAppointment(store, companyId, result.id, "Em Espera");
    expect((await getDoc(ref)).data()).toMatchObject({
      status: "Em Espera",
      check_in_realizado: true,
    });
    await advanceClinicalAppointment(store, companyId, result.id, "Em Atendimento");
    expect((await getDoc(ref)).data()?.status).toBe("Em Atendimento");
    // Retomar opens the persisted attendance; it does not write another status.
    await assertSucceeds(getDoc(ref));
  });
  it.each(["schedule-tenant-ops", "schedule-doctor", "schedule-hr", "schedule-foreign"])(
    "não amplia autorização operacional para %s",
    async (uid) => {
      await assertFails(createClinicalAppointment(db(uid), input));
      await assertFails(updateDoc(doc(db(uid), root, "scheduled"), checkIn()));
    }
  );
  it("nega gravação anônima", async () => {
    await assertFails(
      setDoc(doc(env.unauthenticatedContext().firestore(), root, "new"), appointment())
    );
  });
});

describe("criação exige vínculo e somente dados do agendamento", () => {
  it("nega nascimento em status adiantado ou encerrado, inclusive pelo administrador global", async () => {
    for (const status of ["Em Espera", "Em Atendimento", "Concluído", "Cancelado", "done"]) {
      await assertFails(setDoc(doc(db("schedule-super"), root, "forged"), appointment({ status })));
    }
  });
  it("nega inclusão de aprovação, resultado ou qualquer campo não suportado", async () => {
    for (const extra of [
      { result: "Apto" },
      { completedAt: serverTimestamp() },
      { completedBy: "schedule-super" },
      { asoId: "unverified-document" },
      { clinicalReview: { approved: true } },
      { doctorName: "Responsável não verificado" },
      { signatureHash: "synthetic-unverified" },
    ]) {
      await assertFails(setDoc(doc(db(), root, "forged"), appointment(extra)));
    }
  });
  it("nega empresa divergente, pessoa inexistente/de outra empresa e identidade adulterada", async () => {
    for (const override of [
      { companyId: "schedule-b" },
      { colaborador_id: "worker-b" },
      { colaborador_id: "missing" },
      { colaborador_id: "mismatched" },
      { colaborador_id: "deleted" },
      { colaborador_id: "all" },
      { colaborador_nome: "Outro trabalhador" },
      { companyName: "Outra empresa" },
      { colaborador_id: deleteField() },
    ]) {
      await assertFails(
        setDoc(doc(db("schedule-super"), root, "forged"), appointment(override), { merge: true })
      );
    }
  });
  it("nega empresa ausente ou excluída sem criar registros substitutos", async () => {
    await assertFails(
      setDoc(
        doc(db("schedule-super"), "companies/missing/agendamentos/forged"),
        appointment({ companyId: "missing" })
      )
    );
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), "companies", companyId), { isDeleted: true })
    );
    await expect(createClinicalAppointment(db(), input)).rejects.toThrow("não encontrado");
    await assertFails(setDoc(doc(db(), root, "forged"), appointment()));
    await assertFails(updateDoc(doc(db(), root, "scheduled"), checkIn()));
  });
  it("preserva funcionário legado cujo vínculo é dado pelo caminho da empresa", async () => {
    const result = await createClinicalAppointment(db(), { ...input, employeeId: "legacy-worker" });
    expect((await getDoc(doc(db(), root, result.id))).data()?.colaborador_id).toBe("legacy-worker");
  });
  it("valida calendário real na escrita direta, incluindo séculos e ano bissexto", async () => {
    for (const date of [
      "2026-02-31",
      "2026-02-29",
      "2024-02-30",
      "1900-02-29",
      "2100-02-29",
      "2026-04-31",
      "2026-06-31",
      "2026-09-31",
      "2026-11-31",
    ]) {
      await assertFails(
        setDoc(doc(db(), root, date), appointment({ data_hora: date + "T08:30:00" }))
      );
    }
    for (const date of [
      "1900-02-28",
      "2000-02-29",
      "2024-02-29",
      "2026-04-30",
      "2026-08-31",
      "2026-09-30",
    ]) {
      await assertSucceeds(
        setDoc(doc(db(), root, date), appointment({ data_hora: date + "T08:30:00" }))
      );
    }
  });
});

describe("transições não aceitam conclusão, reversão ou mutações paralelas", () => {
  it("nega conclusão direta para todos os perfis que podem agendar", async () => {
    for (const uid of allowedUsers) {
      await assertFails(updateDoc(doc(db(uid), root, "active"), { status: "Concluído" }));
      await assertFails(setDoc(doc(db(uid), root, "active"), appointment({ status: "Concluído" })));
    }
  });
  it("mantém revisão clínica e vínculo ASO fora das gravações diretas de clientes", async () => {
    const store = db("schedule-doctor");
    await assertFails(
      setDoc(doc(store, "companies", companyId, "clinical_records", `import_${"a".repeat(64)}`), {
        companyId,
        documentType: "ASO",
        clinicalReview: { status: "reviewed", employeeId: "worker-a" },
      })
    );
    await assertFails(
      updateDoc(doc(store, root, "active"), {
        status: "Concluído",
        clinicalRecordId: `import_${"a".repeat(64)}`,
        completedAt: serverTimestamp(),
        completedBy: "schedule-doctor",
      })
    );
  });
  it("nega salto de etapa, repetição de check-in e reversão", async () => {
    await assertFails(updateDoc(doc(db(), root, "scheduled"), { status: "Em Atendimento" }));
    await assertFails(updateDoc(doc(db(), root, "waiting"), checkIn()));
    await assertFails(updateDoc(doc(db(), root, "active"), { status: "Em Espera" }));
    await assertFails(updateDoc(doc(db(), root, "completed-legacy"), { status: "Agendado" }));
  });
  it("exige o check-in completo e não aceita horário ou flag inválidos", async () => {
    for (const patch of [
      { status: "Em Espera" },
      { ...checkIn(), check_in_realizado: false },
      { ...checkIn(), check_in_at: "not-a-date" },
      { ...checkIn(), check_in_at: "2026-10-20T25:00:00.000Z" },
    ]) {
      await assertFails(updateDoc(doc(db(), root, "scheduled"), patch));
    }
  });
  it("nega data impossível no check-in, sem confundir formato válido com relógio autenticado", async () => {
    for (const date of ["2026-02-31", "2026-04-31", "1900-02-29", "2100-02-29"]) {
      await assertFails(
        updateDoc(doc(db(), root, "scheduled"), {
          ...checkIn(),
          check_in_at: date + "T08:30:00.000Z",
        })
      );
    }
  });
  it("não permite alterar identidade nem acrescentar conclusão durante uma transição válida", async () => {
    for (const patch of [
      { companyId: "schedule-b" },
      { colaborador_id: "worker-b" },
      { colaborador_nome: "Outra pessoa" },
      { data_hora: "2026-11-20T09:00:00" },
      { tipo: "Demissional" },
      { result: "Apto" },
      { completedAt: serverTimestamp() },
      { clinicalRecordId: "import_unverified" },
      { reviewStatus: "approved" },
      { companyId: deleteField() },
    ]) {
      await assertFails(updateDoc(doc(db(), root, "scheduled"), { ...checkIn(), ...patch }));
    }
    await assertFails(
      updateDoc(doc(db(), root, "waiting"), {
        status: "Em Atendimento",
        check_in_realizado: false,
      })
    );
    await assertFails(
      updateDoc(doc(db(), root, "waiting"), {
        status: "Em Atendimento",
        check_in_at: "2026-10-20T00:00:00.000Z",
      })
    );
  });
  it("nega lote que cria ou avança o agendamento enquanto rompe o vínculo cadastral", async () => {
    const store = db();
    const employee = doc(store, "companies", companyId, "employees", "worker-a");
    const company = doc(store, "companies", companyId);
    for (const mode of ["create", "advance"]) {
      for (const mutation of [
        "move-employee",
        "delete-employee",
        "remove-employee",
        "delete-company",
        "remove-company",
      ]) {
        const batch = writeBatch(store);
        if (mutation === "move-employee") batch.update(employee, { companyId: "schedule-b" });
        if (mutation === "delete-employee") batch.update(employee, { isDeleted: true });
        if (mutation === "remove-employee") batch.delete(employee);
        if (mutation === "delete-company") batch.update(company, { isDeleted: true });
        if (mutation === "remove-company") batch.delete(company);
        if (mode === "create") batch.set(doc(store, root, "batched"), appointment());
        else batch.update(doc(store, root, "scheduled"), checkIn());
        await assertFails(batch.commit());
        expect((await getDoc(employee)).data()).toMatchObject({ companyId });
        expect((await getDoc(company)).exists()).toBe(true);
        expect((await getDoc(doc(store, root, "scheduled"))).data()?.status).toBe("Agendado");
        expect((await getDoc(doc(store, root, "batched"))).exists()).toBe(false);
      }
    }
  });
});

describe("legados preservados, sem contorno por outros matches", () => {
  it("mantém legados legíveis e avança vínculo válido sem reescrever campos antigos", async () => {
    const legacy = {
      colaborador_id: "worker-a",
      status: "Em Espera",
      result: "Resultado legado sintético",
      legacyMetadata: { unchanged: true },
    };
    await seedAppointment("legacy", legacy);
    const ref = doc(db(), root, "legacy");
    await assertSucceeds(getDoc(ref));
    await assertFails(updateDoc(ref, { status: "Em Atendimento", result: deleteField() }));
    await advanceClinicalAppointment(db(), companyId, "legacy", "Em Atendimento");
    expect((await getDoc(ref)).data()).toEqual({ ...legacy, status: "Em Atendimento" });
    expect((await getDoc(doc(db(), root, "completed-legacy"))).data()?.status).toBe("Concluído");
  });
  it("legado sem identidade verificável permanece legível e não avança", async () => {
    for (const [id, data] of [
      ["no-worker", { companyId, status: "Agendado" }],
      ["wrong-company", appointment({ companyId: "schedule-b" })],
      ["missing-worker", appointment({ colaborador_id: "missing" })],
      ["wrong-worker", appointment({ colaborador_id: "mismatched" })],
      ["deleted-worker", appointment({ colaborador_id: "deleted" })],
    ] as const) {
      await seedAppointment(id, data);
      const ref = doc(db(), root, id);
      await assertSucceeds(getDoc(ref));
      await assertFails(updateDoc(ref, checkIn()));
    }
  });
  it("o match genérico recursivo não autoriza conclusão aninhada nem exclusão", async () => {
    for (const uid of allowedUsers) {
      const store = db(uid);
      const old = doc(store, root, "active", "legacy", "detail");
      await assertSucceeds(getDoc(old));
      await assertFails(
        setDoc(doc(store, root, "active", "clinical_records", "forged"), {
          status: "Concluído",
          approved: true,
        })
      );
      await assertFails(updateDoc(old, { status: "Concluído" }));
      await assertFails(deleteDoc(old));
      await assertFails(deleteDoc(doc(store, root, "completed-legacy")));
      await assertFails(deleteDoc(doc(store, root, "scheduled")));
    }
  });
  it("coleção raiz legada continua legível, mas não permite escrita por outro allow", async () => {
    for (const uid of ["schedule-internal", "schedule-ops", "schedule-super"]) {
      const store = db(uid);
      const old = doc(store, "agendamentos/root-legacy");
      await assertSucceeds(getDoc(old));
      await assertFails(setDoc(doc(store, "agendamentos/forged"), appointment()));
      await assertFails(updateDoc(old, { status: "Em Atendimento" }));
      await assertFails(deleteDoc(old));
      await assertFails(
        setDoc(doc(store, "agendamentos/root-legacy/details/forged"), { approved: true })
      );
    }
    await assertFails(getDoc(doc(db(), "agendamentos/root-legacy")));
  });
});
