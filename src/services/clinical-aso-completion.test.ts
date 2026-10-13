// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { parsePgrDocumentPages } from "@/lib/pgr-document-parser";
import type { AuthContext } from "@/lib/auth/auth-context";

const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  transactionQueue: Promise.resolve(),
  failBeforeCommit: false,
  failReadback: false,
  storagePath: "",
  storageBytes: new Uint8Array([1, 2, 3]),
  storageGeneration: "17",
  storageExists: true,
  storageMetadataReads: 0,
  replaceDuringRead: false,
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: (name: string) => ({
      file: (path: string, options?: { generation?: string }) => {
        state.storagePath = `${name}/${path}`;
        return {
          getMetadata: async () => {
            if (!state.storageExists) throw new Error("object not found");
            state.storageMetadataReads += 1;
            const generation = state.storageGeneration;
            if (state.replaceDuringRead && state.storageMetadataReads === 1)
              state.storageGeneration = "18";
            return [{ size: state.storageBytes.byteLength, generation }];
          },
          download: async () => {
            if (
              !state.storageExists ||
              (options?.generation && options.generation !== state.storageGeneration)
            )
              throw new Error("generation not found");
            return [Buffer.from(state.storageBytes)];
          },
        };
      },
    }),
  }),
}));
vi.mock("@/firebase/config", () => ({
  firebaseConfig: { storageBucket: "synthetic-bucket" },
}));
vi.mock("@/lib/firebase-admin", () => {
  const snapshot = (path: string, value: Record<string, unknown> | undefined) => ({
    exists: !!value,
    data: () => (value ? structuredClone(value) : undefined),
  });
  const ref = (path: string): Record<string, unknown> => ({
    path,
    id: path.split("/").at(-1),
    collection: (name: string) => collection(`${path}/${name}`),
    get: async () => {
      if (
        state.failReadback &&
        [...state.records.values()].some((record) => record.linkedAppointmentId)
      ) {
        state.failReadback = false;
        throw new Error("readback failed");
      }
      return snapshot(path, state.records.get(path));
    },
  });
  const collection = (path: string) => ({
    doc: (id: string) => ref(`${path}/${id}`),
  });
  return {
    adminDb: {
      collection,
      runTransaction: async (callback: (tx: unknown) => unknown) => {
        const previous = state.transactionQueue;
        let release!: () => void;
        state.transactionQueue = new Promise<void>((resolve) => (release = resolve));
        await previous;
        const writes: Array<{
          type: "update" | "create";
          ref: { path: string };
          data: Record<string, unknown>;
        }> = [];
        try {
          const result = await callback({
            get: async (document: { path: string }) =>
              snapshot(document.path, state.records.get(document.path)),
            update: (document: { path: string }, data: Record<string, unknown>) =>
              writes.push({ type: "update", ref: document, data }),
            create: (document: { path: string }, data: Record<string, unknown>) =>
              writes.push({ type: "create", ref: document, data }),
          });
          if (state.failBeforeCommit) {
            state.failBeforeCommit = false;
            throw new Error("commit failed");
          }
          for (const write of writes) {
            const current = state.records.get(write.ref.path);
            if (write.type === "create" && current) throw new Error("already exists");
            if (write.type === "update" && !current) throw new Error("missing document");
            state.records.set(write.ref.path, { ...current, ...write.data });
          }
          return result;
        } finally {
          release();
        }
      },
    },
  };
});

import {
  completeClinicalAppointmentWithAso,
  readClinicalAsoOriginal,
  reviewClinicalAso,
} from "./clinical-aso-completion";

const companyId = "company-a";
const employeeId = "employee-a";
const appointmentId = "appointment-a";
const cardId = createHash("sha256")
  .update(new Uint8Array([1, 2, 3]))
  .digest("hex");
const companyPath = `companies/${companyId}`;
const cardPath = `${companyPath}/pgr_cards/${cardId}`;
const clinicalPath = `${companyPath}/clinical_records/import_${cardId}`;
const employeePath = `${companyPath}/employees/${employeeId}`;
const appointmentPath = `${companyPath}/agendamentos/${appointmentId}`;
const auditPath = `${clinicalPath}/attendance_audit/appointment_${appointmentId}`;
const user: AuthContext = {
  uid: "synthetic-doctor",
  email: "doctor@example.test",
  role: "DOCTOR",
  tenantId: companyId,
  permissions: [],
  servedCompanies: [],
};

function asoAnalysis() {
  return {
    ...parsePgrDocumentPages([{ numero: 1, texto: "ASO sintético para teste" }]),
    documento: {
      tipo: "ASO" as const,
      agenteResponsavel: "medico_trabalho" as const,
      statusClassificacao: "identificado" as const,
      evidencias: [],
      justificativa: "Documento sintético revisado",
      acesso: "clinico_restrito" as const,
    },
  };
}

function seed() {
  state.records.clear();
  state.failBeforeCommit = false;
  state.failReadback = false;
  state.storagePath = "";
  state.storageBytes = new Uint8Array([1, 2, 3]);
  state.storageGeneration = "17";
  state.storageExists = true;
  state.storageMetadataReads = 0;
  state.replaceDuringRead = false;
  state.transactionQueue = Promise.resolve();
  state.records.set("users/synthetic-doctor", {
    role: "DOCTOR",
    companyId,
  });
  state.records.set(companyPath, { name: "Empresa sintética" });
  state.records.set(employeePath, { name: "Pessoa sintética", companyId });
  state.records.set(cardPath, {
    companyId,
    sourceHash: cardId,
    documentType: "ASO",
    restricted: true,
  });
  state.records.set(clinicalPath, {
    companyId,
    sourceHash: cardId,
    documentType: "ASO",
    restricted: true,
    analysis: asoAnalysis(),
    storagePath: `clientes/${companyId}/prontuarios/importacoes/${cardId}.pdf`,
    storageGeneration: "17",
    storageSha256: cardId,
  });
  state.records.set(appointmentPath, {
    companyId,
    companyName: "Empresa sintética",
    colaborador_id: employeeId,
    colaborador_nome: "Pessoa sintética",
    tipo: "Periódico",
    data_hora: "2026-10-13T08:00:00",
    status: "Em Atendimento",
  });
}

const reviewInput = {
  companyId,
  cardId,
  employeeId,
  appointmentId,
  appointmentSnapshot: {
    appointmentId,
    companyId,
    companyName: "Empresa sintética",
    employeeId,
    employeeName: "Pessoa sintética",
    type: "Periódico",
    dateTime: "2026-10-13T08:00:00",
  },
  confirmedOriginal: true as const,
};
const completeInput = { ...reviewInput, appointmentId };

beforeEach(seed);

describe("vínculo clínico de ASO à fila", () => {
  it("entrega o original somente a médico autorizado e não grava uma versão nova", async () => {
    const original = await readClinicalAsoOriginal(user, { companyId, cardId });
    expect(original.mime).toBe("application/pdf");
    expect([...original.bytes]).toEqual([1, 2, 3]);
    expect(state.storagePath).toBe(
      `synthetic-bucket/clientes/${companyId}/prontuarios/importacoes/${cardId}.pdf`
    );
    await expect(
      readClinicalAsoOriginal({ ...user, role: "ADMIN" }, { companyId, cardId })
    ).rejects.toThrow("exige um médico");
  });

  it("separa a revisão clínica do vínculo e conclui com auditoria transacional", async () => {
    await reviewClinicalAso(user, reviewInput);
    expect(state.records.get(clinicalPath)?.clinicalReview).toMatchObject({
      status: "reviewed",
      reviewerUid: user.uid,
      companyId,
      employeeId,
      sourceHash: cardId,
      identityConfirmedFromOriginal: true,
    });
    expect(state.records.get(appointmentPath)?.status).toBe("Em Atendimento");

    await completeClinicalAppointmentWithAso(user, completeInput);
    expect(state.records.get(appointmentPath)).toMatchObject({
      status: "Concluído",
      clinicalRecordId: `import_${cardId}`,
      asoSourceHash: cardId,
      completedBy: user.uid,
    });
    expect(state.records.get(clinicalPath)).toMatchObject({
      linkedAppointmentId: appointmentId,
      linkedEmployeeId: employeeId,
    });
    expect(state.records.get(auditPath)).toMatchObject({
      type: "ASO_LINKED_AND_ATTENDANCE_COMPLETED",
      companyId,
      employeeId,
      appointmentId,
      sourceHash: cardId,
      reviewerUid: user.uid,
      completedBy: user.uid,
    });
  });

  it("verifica imports legados por bytes e registra a geração ao revisar", async () => {
    const clinical = state.records.get(clinicalPath)!;
    delete clinical.storageGeneration;
    delete clinical.storageSha256;
    state.records.set(clinicalPath, clinical);
    await expect(readClinicalAsoOriginal(user, { companyId, cardId })).resolves.toMatchObject({
      bytes: Buffer.from([1, 2, 3]),
    });
    await reviewClinicalAso(user, reviewInput);
    expect(state.records.get(clinicalPath)).toMatchObject({
      storageGeneration: "17",
      storageSha256: cardId,
    });
    await completeClinicalAppointmentWithAso(user, completeInput);
  });

  it("não conclui sem revisão clínica registrada", async () => {
    await expect(completeClinicalAppointmentWithAso(user, completeInput)).rejects.toThrow(
      "ainda não possui revisão clínica"
    );
    expect(state.records.get(appointmentPath)?.status).toBe("Em Atendimento");
    expect(state.records.has(auditPath)).toBe(false);
  });

  it("nega perfil administrativo mesmo após importação", async () => {
    state.records.set("users/synthetic-doctor", { role: "ADMIN", companyId });
    await expect(reviewClinicalAso({ ...user, role: "ADMIN" }, reviewInput)).rejects.toThrow(
      "exige um médico"
    );
    expect(state.records.get(clinicalPath)?.clinicalReview).toBeUndefined();
  });

  it("nega acesso clínico revogado antes da revisão", async () => {
    state.records.set("users/synthetic-doctor", {
      role: "DOCTOR",
      companyId: "company-b",
      servedCompanies: [],
    });
    await expect(reviewClinicalAso(user, reviewInput)).rejects.toThrow("atualmente autorizado");
    expect(state.records.get(clinicalPath)?.clinicalReview).toBeUndefined();
  });

  it("autoriza médico externo apenas pela empresa explicitamente servida", async () => {
    state.records.set("users/synthetic-doctor", {
      role: "DOCTOR",
      companyId: "company-home",
      servedCompanies: [companyId],
    });
    await expect(reviewClinicalAso(user, reviewInput)).resolves.toEqual({ status: "reviewed" });
  });

  it("recusa documento associado a outra empresa", async () => {
    state.records.set(cardPath, {
      ...state.records.get(cardPath),
      companyId: "company-b",
    });
    await expect(reviewClinicalAso(user, reviewInput)).rejects.toThrow(
      "não encontrado nesta empresa"
    );
  });

  it("recusa classificação pendente sem registrá-la como revisão clínica", async () => {
    const analysis = asoAnalysis();
    state.records.set(clinicalPath, {
      ...state.records.get(clinicalPath),
      analysis: {
        ...analysis,
        documento: { ...analysis.documento!, statusClassificacao: "ambiguo" },
      },
    });
    await expect(reviewClinicalAso(user, reviewInput)).rejects.toThrow(
      "classificação do ASO ainda está pendente"
    );
    expect(state.records.get(clinicalPath)?.clinicalReview).toBeUndefined();
  });

  it("recusa revisão se o atendimento mudou desde o snapshot exibido ao médico", async () => {
    await expect(
      reviewClinicalAso(user, {
        ...reviewInput,
        appointmentSnapshot: {
          ...reviewInput.appointmentSnapshot,
          dateTime: "2026-10-14T08:00:00",
        },
      })
    ).rejects.toThrow("exibidos para a revisão foram alterados");
    expect(state.records.get(clinicalPath)?.clinicalReview).toBeUndefined();
  });

  it("torna a revisão idempotente para o mesmo profissional e identidade", async () => {
    await expect(reviewClinicalAso(user, reviewInput)).resolves.toEqual({ status: "reviewed" });
    await expect(reviewClinicalAso(user, reviewInput)).resolves.toEqual({ status: "reviewed" });
    expect(state.records.get(clinicalPath)?.clinicalReview).toMatchObject({
      reviewerUid: user.uid,
      employeeId,
    });
  });

  it("recusa colaborador incorreto no agendamento", async () => {
    await reviewClinicalAso(user, reviewInput);
    state.records.set(appointmentPath, {
      ...state.records.get(appointmentPath),
      companyId,
      colaborador_id: "employee-b",
    });
    await expect(completeClinicalAppointmentWithAso(user, completeInput)).rejects.toThrow(
      "não correspondem"
    );
    expect(state.records.get(appointmentPath)?.status).toBe("Em Atendimento");
  });

  it("mantém atendimento cancelado ou incompatível aberto sem gravar vínculo", async () => {
    await reviewClinicalAso(user, reviewInput);
    state.records.set(appointmentPath, {
      ...state.records.get(appointmentPath),
      companyId,
      colaborador_id: employeeId,
      status: "Cancelado",
    });
    await expect(completeClinicalAppointmentWithAso(user, completeInput)).rejects.toThrow(
      "mudou de estado"
    );
    expect(state.records.get(clinicalPath)?.linkedAppointmentId).toBeUndefined();
    expect(state.records.has(auditPath)).toBe(false);
  });

  it("não reutiliza revisão em outro atendimento do mesmo colaborador", async () => {
    await reviewClinicalAso(user, reviewInput);
    const otherAppointmentId = "appointment-b";
    const otherAppointmentPath = `${companyPath}/agendamentos/${otherAppointmentId}`;
    state.records.set(otherAppointmentPath, {
      ...state.records.get(appointmentPath),
      tipo: "Demissional",
      data_hora: "2026-10-14T09:00:00",
    });
    await expect(
      completeClinicalAppointmentWithAso(user, {
        ...completeInput,
        appointmentId: otherAppointmentId,
      })
    ).rejects.toThrow("pertence a outro agendamento");
    expect(state.records.get(otherAppointmentPath)?.status).toBe("Em Atendimento");
    expect(
      state.records.has(`${clinicalPath}/attendance_audit/appointment_${otherAppointmentId}`)
    ).toBe(false);
  });

  it.each([
    ["tipo", "Demissional"],
    ["data_hora", "2026-10-14T09:00:00"],
  ] as const)("recusa mudança concorrente de %s após a revisão", async (field, value) => {
    await reviewClinicalAso(user, reviewInput);
    state.records.set(appointmentPath, {
      ...state.records.get(appointmentPath),
      [field]: value,
    });
    await expect(completeClinicalAppointmentWithAso(user, completeInput)).rejects.toThrow(
      "dados conferidos foram alterados"
    );
    expect(state.records.get(appointmentPath)?.status).toBe("Em Atendimento");
    expect(state.records.has(auditPath)).toBe(false);
  });

  it("recusa original ausente ou com bytes diferentes do sourceHash", async () => {
    state.storageExists = false;
    await expect(reviewClinicalAso(user, reviewInput)).rejects.toThrow();
    state.storageExists = true;
    state.storageBytes = new Uint8Array([3, 2, 1]);
    await expect(reviewClinicalAso(user, reviewInput)).rejects.toThrow("integridade ou a geração");
    expect(state.records.get(clinicalPath)?.clinicalReview).toBeUndefined();
  });

  it("recusa geração substituída antes da revisão ou durante a leitura do original", async () => {
    state.storageGeneration = "18";
    await expect(reviewClinicalAso(user, reviewInput)).rejects.toThrow(
      "ausente ou foi substituído"
    );
    state.storageGeneration = "17";
    state.storageMetadataReads = 0;
    state.replaceDuringRead = true;
    await expect(readClinicalAsoOriginal(user, { companyId, cardId })).rejects.toThrow();
    expect(state.records.get(clinicalPath)?.clinicalReview).toBeUndefined();
  });

  it("recusa uma geração alterada entre revisão e conclusão", async () => {
    await reviewClinicalAso(user, reviewInput);
    state.storageGeneration = "18";
    await expect(completeClinicalAppointmentWithAso(user, completeInput)).rejects.toThrow(
      "ausente ou foi substituído"
    );
    expect(state.records.get(appointmentPath)?.status).toBe("Em Atendimento");
  });

  it("permite retry idempotente sem duplicar o evento de auditoria", async () => {
    await reviewClinicalAso(user, reviewInput);
    await completeClinicalAppointmentWithAso(user, completeInput);
    await expect(completeClinicalAppointmentWithAso(user, completeInput)).resolves.toEqual({
      status: "completed",
    });
    expect([...state.records.keys()].filter((path) => path === auditPath)).toHaveLength(1);
  });

  it("serializa requisições concorrentes e conserva um único vínculo", async () => {
    await reviewClinicalAso(user, reviewInput);
    const results = await Promise.all([
      completeClinicalAppointmentWithAso(user, completeInput),
      completeClinicalAppointmentWithAso(user, completeInput),
    ]);
    expect(results).toEqual([{ status: "completed" }, { status: "completed" }]);
    expect(state.records.get(appointmentPath)?.status).toBe("Concluído");
    expect(state.records.has(auditPath)).toBe(true);
  });

  it("não anuncia sucesso se a leitura de confirmação falha", async () => {
    await reviewClinicalAso(user, reviewInput);
    state.failReadback = true;
    await expect(completeClinicalAppointmentWithAso(user, completeInput)).rejects.toThrow(
      "readback failed"
    );
    expect(state.records.get(appointmentPath)?.status).toBe("Concluído");
    await expect(completeClinicalAppointmentWithAso(user, completeInput)).resolves.toEqual({
      status: "completed",
    });
  });

  it("não deixa falha de transação gravar parcialmente fila, documento ou auditoria", async () => {
    await reviewClinicalAso(user, reviewInput);
    state.failBeforeCommit = true;
    await expect(completeClinicalAppointmentWithAso(user, completeInput)).rejects.toThrow(
      "commit failed"
    );
    expect(state.records.get(appointmentPath)?.status).toBe("Em Atendimento");
    expect(state.records.get(clinicalPath)?.linkedAppointmentId).toBeUndefined();
    expect(state.records.has(auditPath)).toBe(false);
  });

  it("não confirma revisão de ASO sem confirmação explícita do original", async () => {
    await expect(
      reviewClinicalAso(user, { ...reviewInput, confirmedOriginal: false as true })
    ).rejects.toThrow("Confirme a conferência");
    expect(state.records.get(clinicalPath)?.clinicalReview).toBeUndefined();
  });
});
