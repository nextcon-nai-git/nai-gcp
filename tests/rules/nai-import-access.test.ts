import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, deleteField, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { deleteObject, ref, getBytes, uploadBytes } from "firebase/storage";

let env: RulesTestEnvironment;
const clinicalPath = "companies/company-a/clinical_records/import_synthetic";
const originalPath = "clientes/company-a/prontuarios/importacoes/synthetic.pdf";
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, role, companyId] of [
      ["ops", "OPERATIONS", "nextcon"],
      ["client", "CLIENT_ADMIN", "company-a"],
      ["doctor", "DOCTOR", "company-a"],
      ["provider-engineer", "PROVIDER", "company-a"],
      ["scoped-admin", "ADMIN", "company-a"],
      ["foreign-admin", "ADMIN", "company-b"],
      ["global-admin", "ADMIN", ""],
      ["foreign-doctor", "DOCTOR", "company-b"],
      ["super", "SUPER_ADMIN", "nextcon"],
    ])
      await setDoc(doc(ctx.firestore(), "users", uid), {
        id: uid,
        email: `${uid}@example.test`,
        role,
        companyId,
        servedCompanies: [],
      });
    await setDoc(doc(ctx.firestore(), "users/tenant-admin"), {
      role: "ADMIN",
      tenantId: "company-b",
      companyId: "company-a",
      servedCompanies: [],
    });
    for (const path of [
      "nai_importa_drafts/synthetic",
      "users/doctor/pgr_analysis_drafts/synthetic",
      "users/doctor/nai_import_drafts/synthetic",
      clinicalPath,
      clinicalPath + "/agent_reviews/medico_trabalho",
      "companies/company-a/clinical_records/legacy",
    ])
      await setDoc(doc(ctx.firestore(), path), { content: "DADOS SINTÉTICOS RESTRITOS" });
    await setDoc(doc(ctx.firestore(), "companies/company-a/pgr_cards/synthetic"), {
      restricted: true,
      fileName: "Documento de saúde ocupacional",
      analysis: null,
    });
    for (const [collection, importedId] of [
      ["tasks", "pgr_synthetic"],
      ["risks", "risk_synthetic"],
    ]) {
      for (const id of [importedId, "legacy-import"]) {
        await setDoc(doc(ctx.firestore(), "companies/company-a", collection, id), {
          companyId: "company-a",
          sourceType: "pgr",
          documentType: "ASO",
          restricted: true,
          status: "todo",
          checklist: [
            { id: "item_0", text: "Conferir a revisão clínica", checked: false, mandatory: true },
          ],
        });
      }
      await setDoc(doc(ctx.firestore(), "companies/company-a", collection, "manual"), {
        companyId: "company-a",
        title: "Atividade operacional regular",
        status: "todo",
      });
    }
    await uploadBytes(ref(ctx.storage(), originalPath), new Uint8Array([1, 2]), {
      contentType: "application/pdf",
    });
    await uploadBytes(
      ref(ctx.storage(), "clientes/company-a/prontuarios/legacy.pdf"),
      new Uint8Array([1, 2]),
      {
        contentType: "application/pdf",
      }
    );
  });
});
afterAll(async () => env?.cleanup());
const db = (uid: string) => env.authenticatedContext(uid).firestore();
const storage = (uid: string) => env.authenticatedContext(uid).storage();

describe("NAI importa: fronteiras de dados clínicos", () => {
  it("rascunhos novos e legados não podem ser lidos nem adulterados pelo navegador", async () => {
    for (const uid of ["ops", "doctor", "super"]) {
      for (const path of [
        "nai_importa_drafts/synthetic",
        "users/doctor/pgr_analysis_drafts/synthetic",
        "users/doctor/nai_import_drafts/synthetic",
      ]) {
        await assertFails(getDoc(doc(db(uid), path)));
        await assertFails(setDoc(doc(db(uid), path), { analysis: "forged" }));
      }
    }
  });

  it("a equipe acompanha o envelope administrativo sem ler análise, revisão ou original clínicos", async () => {
    for (const uid of ["ops", "client"]) {
      await assertSucceeds(getDoc(doc(db(uid), "companies/company-a/pgr_cards/synthetic")));
      await assertFails(getDoc(doc(db(uid), clinicalPath)));
      await assertFails(getDoc(doc(db(uid), clinicalPath + "/agent_reviews/medico_trabalho")));
      await assertFails(getBytes(ref(storage(uid), originalPath)));
    }
  });

  it("médico da empresa acessa o original e a revisão; médico de outra empresa não", async () => {
    await assertSucceeds(getDoc(doc(db("doctor"), clinicalPath)));
    await assertSucceeds(
      getDoc(doc(db("doctor"), clinicalPath + "/agent_reviews/medico_trabalho"))
    );
    await assertSucceeds(getBytes(ref(storage("doctor"), originalPath)));
    await assertFails(getDoc(doc(db("foreign-doctor"), clinicalPath)));
    await assertFails(getBytes(ref(storage("foreign-doctor"), originalPath)));
  });

  it("o fechamento dos rascunhos preserva a leitura operacional dos perfis", async () => {
    await assertSucceeds(getDoc(doc(db("ops"), "users/doctor")));
  });

  it("o papel genérico de prestador não dá acesso clínico às importações", async () => {
    await assertSucceeds(
      getDoc(doc(db("provider-engineer"), "companies/company-a/pgr_cards/synthetic"))
    );
    await assertFails(getDoc(doc(db("provider-engineer"), clinicalPath)));
    await assertFails(
      getDoc(doc(db("provider-engineer"), clinicalPath + "/agent_reviews/medico_trabalho"))
    );
    await assertFails(setDoc(doc(db("provider-engineer"), clinicalPath), { content: "forged" }));
    await assertFails(getBytes(ref(storage("provider-engineer"), originalPath)));
    await assertFails(
      uploadBytes(ref(storage("provider-engineer"), originalPath), new Uint8Array([3]), {
        contentType: "application/pdf",
      })
    );
    // The stricter gate is confined to the new import paths.
    await assertSucceeds(
      getDoc(doc(db("provider-engineer"), "companies/company-a/clinical_records/legacy"))
    );
    await assertSucceeds(
      getBytes(ref(storage("provider-engineer"), "clientes/company-a/prontuarios/legacy.pdf"))
    );
  });

  it("o administrador de outro tenant não lê a análise ou o original de uma importação clínica", async () => {
    for (const uid of ["foreign-admin", "tenant-admin"]) {
      await assertFails(getDoc(doc(db(uid), clinicalPath)));
      await assertFails(getDoc(doc(db(uid), clinicalPath + "/agent_reviews/medico_trabalho")));
      await assertFails(getBytes(ref(storage(uid), originalPath)));
    }
    for (const uid of ["scoped-admin", "global-admin"]) {
      await assertSucceeds(getDoc(doc(db(uid), clinicalPath)));
      await assertSucceeds(getBytes(ref(storage(uid), originalPath)));
    }
  });

  it.each(["doctor", "super"])(
    "%s consulta a importação clínica sem adulterar o original, a análise ou as revisões",
    async (uid) => {
      await assertSucceeds(getDoc(doc(db(uid), clinicalPath)));
      await assertFails(updateDoc(doc(db(uid), clinicalPath), { analysis: { forged: true } }));
      await assertFails(
        setDoc(doc(db(uid), clinicalPath + "/agent_reviews/medico_trabalho"), { review: "forged" })
      );
      await assertFails(deleteDoc(doc(db(uid), clinicalPath)));
      await assertFails(
        setDoc(doc(db(uid), "companies/company-a/clinical_records/import_forged"), { analysis: {} })
      );
      await assertSucceeds(getBytes(ref(storage(uid), originalPath)));
      await assertFails(
        uploadBytes(ref(storage(uid), originalPath), new Uint8Array([3]), {
          contentType: "application/pdf",
        })
      );
      await assertFails(deleteObject(ref(storage(uid), originalPath)));
      await assertSucceeds(
        updateDoc(doc(db(uid), "companies/company-a/clinical_records/legacy"), {
          content: "Revisão do fluxo legado",
        })
      );
      await assertSucceeds(
        uploadBytes(
          ref(storage(uid), "clientes/company-a/prontuarios/legacy.pdf"),
          new Uint8Array([3]),
          { contentType: "application/pdf" }
        )
      );
    }
  );

  it.each(["ops", "client", "super"])(
    "%s não contorna a API alterando ou excluindo cards e riscos importados",
    async (uid) => {
      for (const [collection, importedId] of [
        ["tasks", "pgr_synthetic"],
        ["risks", "risk_synthetic"],
      ]) {
        for (const id of [importedId, "legacy-import"]) {
          const record = doc(db(uid), "companies/company-a", collection, id);
          await assertSucceeds(getDoc(record));
          await assertFails(updateDoc(record, { status: "done", checklist: [] }));
          await assertFails(updateDoc(record, { sourceType: deleteField(), status: "done" }));
          await assertFails(setDoc(record, { sourceType: "manual", status: "done" }));
          await assertFails(deleteDoc(record));
        }
      }
    }
  );

  it("não permite forjar a origem nem reutilizar IDs reservados na criação", async () => {
    for (const [collection, reservedId] of [
      ["tasks", "pgr_forged"],
      ["risks", "risk_forged"],
    ]) {
      await assertFails(
        setDoc(doc(db("ops"), "companies/company-a", collection, reservedId), {
          sourceType: "manual",
          status: "done",
        })
      );
      await assertFails(
        setDoc(doc(db("ops"), "companies/company-a", collection, "forged"), {
          sourceType: "pgr",
          status: "done",
        })
      );
      await assertFails(
        updateDoc(doc(db("ops"), "companies/company-a", collection, "manual"), {
          sourceType: "pgr",
        })
      );
    }
  });

  it.each(["ops", "client", "super"])(
    "%s não altera o envelope público ou a associação com a análise clínica",
    async (uid) => {
      const record = doc(db(uid), "companies/company-a/pgr_cards/synthetic");
      await assertFails(updateDoc(record, { restricted: false, analysis: { forged: true } }));
      await assertFails(updateDoc(record, { clinicalRecordId: "another-record" }));
      await assertFails(deleteDoc(record));
      await assertFails(
        setDoc(doc(db(uid), "companies/company-a/pgr_cards/new"), { restricted: false })
      );
      await assertFails(
        setDoc(
          doc(db(uid), "companies/company-a/pgr_cards/synthetic/agent_reviews/medico_trabalho"),
          {
            review: "Análise forjada",
          }
        )
      );
    }
  );

  it.each(["ops", "client", "super"])(
    "%s continua criando e atualizando atividades operacionais não importadas",
    async (uid) => {
      for (const collection of ["tasks", "risks"]) {
        const record = doc(db(uid), "companies/company-a", collection, "manual");
        await assertSucceeds(updateDoc(record, { status: "doing" }));
        const newRecord = doc(db(uid), "companies/company-a", collection, `manual-${uid}`);
        await assertSucceeds(setDoc(newRecord, { status: "todo", sourceType: "manual" }));
        await assertSucceeds(deleteDoc(newRecord));
      }
    }
  );
});
