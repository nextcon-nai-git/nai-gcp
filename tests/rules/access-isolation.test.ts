import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getBytes, deleteObject } from "firebase/storage";

let env: RulesTestEnvironment;
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
    for (const [uid, role, companyId, servedCompanies] of [
      ["client", "CLIENT_ADMIN", "avp", []],
      ["hr", "HR", "avp", []],
      ["doctor", "DOCTOR", "avp", []],
      ["provider", "PROVIDER", "clinic", ["avp"]],
      ["global", "ADMIN", "nextcon", []],
      ["super", "SUPER_ADMIN", "nextcon", []],
    ] as const)
      await setDoc(doc(ctx.firestore(), "users", uid), {
        id: uid,
        email: `${uid}@example.test`,
        role,
        companyId,
        servedCompanies,
      });
    await setDoc(doc(ctx.firestore(), "companies/avp/aso_attendances/synthetic"), {
      employeeId: "synthetic-patient",
      notes: "EXCLUSIVAMENTE DADOS SINTÉTICOS",
    });
    await setDoc(doc(ctx.firestore(), "companies/foreign/private/synthetic"), { synthetic: true });
    await setDoc(doc(ctx.firestore(), "phi_audit_logs/synthetic"), {
      action: "MEDICAL_ASSISTANT_USED",
      patientId: "synthetic-patient",
    });
    await uploadBytes(
      ref(ctx.storage(), "clientes/avp/colaboradores/synthetic/record.pdf"),
      new Uint8Array([1, 2]),
      { contentType: "application/pdf" }
    );
    await uploadBytes(
      ref(ctx.storage(), "clientes/foreign/colaboradores/synthetic/record.pdf"),
      new Uint8Array([1, 2]),
      { contentType: "application/pdf" }
    );
  });
});
afterAll(async () => {
  await env?.cleanup();
});
const db = (uid: string) =>
  env.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
const store = (uid: string) =>
  env.authenticatedContext(uid, { email: `${uid}@example.test` }).storage();
const dbWithClaims = (uid: string, claims: Record<string, unknown>) =>
  env.authenticatedContext(uid, { email: `${uid}@example.test`, ...claims }).firestore();
const storeWithClaims = (uid: string, claims: Record<string, unknown>) =>
  env.authenticatedContext(uid, { email: `${uid}@example.test`, ...claims }).storage();

describe("Perfis e prontuários", () => {
  it.each(["GUEST", "UNKNOWN_LEGACY"])(
    "exige um perfil ativo reconhecido para ler a carteira (%s)",
    async (role) => {
      const uid = "unapproved-user";
      const path = "clientes/avp/docs_legais/documento.pdf";
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "users", uid), {
          role,
          companyId: "avp",
          servedCompanies: ["avp"],
        });
        await setDoc(doc(ctx.firestore(), "companies/avp/reports/sample"), { name: "Restrito" });
        await uploadBytes(ref(ctx.storage(), path), new Uint8Array([1]), {
          contentType: "application/pdf",
        });
      });
      await assertSucceeds(getDoc(doc(db(uid), "users", uid)));
      await assertFails(getDoc(doc(db(uid), "companies/avp")));
      await assertFails(getDocs(collection(db(uid), "companies/avp/reports")));
      await assertFails(getBytes(ref(store(uid), path)));
      await assertSucceeds(getDocs(collection(db("hr"), "companies/avp/reports")));
      await assertSucceeds(getBytes(ref(store("hr"), path)));
    }
  );
  it("CLIENT_ADMIN não promove a si mesmo nem atravessa empresas", async () => {
    await assertFails(updateDoc(doc(db("client"), "users/client"), { role: "SUPER_ADMIN" }));
    await assertFails(getDoc(doc(db("client"), "companies/foreign/private/synthetic")));
  });
  it("ADMIN não promove outro perfil; SUPER_ADMIN pode provisionar", async () => {
    await assertFails(updateDoc(doc(db("global"), "users/client"), { role: "SUPER_ADMIN" }));
    await assertSucceeds(updateDoc(doc(db("super"), "users/client"), { role: "HR" }));
  });
  it("RH não lê prontuário e médico autorizado pode registrar ASO", async () => {
    await assertFails(getDoc(doc(db("hr"), "companies/avp/aso_attendances/synthetic")));
    await assertFails(getDoc(doc(db("client"), "companies/avp/aso_attendances/synthetic")));
    await assertSucceeds(
      setDoc(doc(db("doctor"), "companies/avp/aso_attendances/new"), {
        employeeId: "synthetic-patient",
      })
    );
    await assertFails(getDoc(doc(db("doctor"), "companies/foreign/aso_attendances/synthetic")));
  });
  it("prestador genérico não recebe prontuário pela concessão operacional", async () => {
    await assertFails(getDoc(doc(db("provider"), "companies/avp/aso_attendances/synthetic")));
    await assertFails(getDoc(doc(db("provider"), "companies/foreign/aso_attendances/synthetic")));
  });
  it("ignora claims forjadas e usa o perfil armazenado para autorização", async () => {
    const forged = { role: "SUPER_ADMIN", companyId: "foreign" };
    await assertFails(
      getDoc(doc(dbWithClaims("client", forged), "companies/foreign/private/synthetic"))
    );
    await assertFails(
      getBytes(
        ref(
          storeWithClaims("client", forged),
          "clientes/foreign/colaboradores/synthetic/record.pdf"
        )
      )
    );
  });
  it("protege mensalidade, auditoria e PDFs de origem contra escrita direta", async () => {
    const locked = [
      "companies/avp/contracts/fixed-monthly-billing",
      "admin_migrations/import",
      "companies/avp/sourceDocuments/original",
    ];
    for (const path of locked) {
      await env.withSecurityRulesDisabled((ctx) =>
        setDoc(doc(ctx.firestore(), path), { valueCents: 500000 })
      );
      for (const uid of ["client", "global", "super"]) {
        await assertFails(updateDoc(doc(db(uid), path), { valueCents: 100 }));
        await assertFails(deleteDoc(doc(db(uid), path)));
      }
    }
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "companies/avp"), { active: true, portfolioClientId: "avp" })
    );
    for (const change of [
      { active: false },
      { portfolioClientId: "other" },
      { isDeleted: true },
      { cnpj: "changed" },
    ])
      await assertFails(updateDoc(doc(db("client"), "companies/avp"), change));
    await assertFails(deleteDoc(doc(db("client"), "companies/avp")));
    await assertSucceeds(updateDoc(doc(db("client"), "companies/avp"), { phone: "0000" }));
    await assertSucceeds(
      setDoc(doc(db("client"), "companies/avp/contracts/local"), { title: "Contrato" })
    );
    await assertFails(
      setDoc(doc(db("client"), "companies/avp/sourceDocuments/new"), { name: "PCMSO.pdf" })
    );
    await assertFails(getDocs(collection(db("global"), "integrations/grupo-avp/versions/v1/rows")));
  });
  it("preserva as trilhas e relatos internos da administração", async () => {
    for (const path of [
      "nxc_daily_reports/day",
      "admin_company_changes/event",
      "access_cards/badge",
      "companies/avp/audit_logs/event",
      "companies/avp/access_index/badge",
    ]) {
      await env.withSecurityRulesDisabled((ctx) =>
        setDoc(doc(ctx.firestore(), path), { source: "server" })
      );
      for (const uid of ["global", "super", "client"]) {
        await assertFails(updateDoc(doc(db(uid), path), { source: "client" }));
        await assertFails(deleteDoc(doc(db(uid), path)));
      }
    }
  });
  it("protege o protocolo legado contra criação ou adulteração direta", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "users/engineer"), { role: "ENGINEER", companyId: "avp" })
    );
    const id = "11111111-1234-4567-8123-111111111111";
    const path = "companies/avp/reports/" + id;
    const payload = {
      name: "Laudo Técnico - NR-01",
      companyId: "avp",
      companyName: "AVP",
      reportType: "nr01",
      auditData: {
        nr: "NR-01",
        companyId: "avp",
        auditorId: "engineer",
        progress: 100,
        responses: { "1.1": "CONFORME" },
      },
      createdAt: new Date().toISOString(),
      serverTimestamp: serverTimestamp(),
      storagePath: "clientes/avp/sst_nrs/nr01/protocolo_" + id + ".pdf",
    };
    await assertFails(
      setDoc(doc(db("engineer"), path), { ...payload, storagePath: "clientes/foreign/sample.pdf" })
    );
    await assertFails(setDoc(doc(db("engineer"), "companies/foreign/reports/" + id), payload));
    await assertFails(setDoc(doc(db("engineer"), path), payload));
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), payload));
    for (const uid of ["engineer", "client", "super"]) {
      await assertFails(updateDoc(doc(db(uid), path), { companyName: "Outra empresa" }));
      await assertFails(deleteDoc(doc(db(uid), path)));
      await assertFails(
        uploadBytes(ref(store(uid), payload.storagePath), new Uint8Array([1]), {
          contentType: "application/pdf",
        })
      );
    }
  });
  it("preserva o ASO registrado e impede o prestador de lançar resultado", async () => {
    const record = "companies/avp/aso_attendances/synthetic";
    await assertFails(setDoc(doc(db("provider"), record + "-new"), { resultado: "alterado" }));
    for (const uid of ["doctor", "provider", "super"]) {
      await assertFails(updateDoc(doc(db(uid), record), { resultado: "alterado" }));
      await assertFails(deleteDoc(doc(db(uid), record)));
    }
  });
  it("isola os exames laboratoriais por empresa e perfil clínico", async () => {
    const worker = "companies/avp/employees/worker";
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), worker), { name: "Teste" })
    );
    const path = worker + "/exams/test";
    const result = { value: 100, createdAt: serverTimestamp(), createdBy: "doctor" };
    await assertSucceeds(setDoc(doc(db("doctor"), path), result));
    await assertSucceeds(getDocs(collection(db("doctor"), worker + "/exams")));
    for (const uid of ["client", "hr", "provider"]) {
      await assertFails(getDoc(doc(db(uid), path)));
      await assertFails(getDocs(collection(db(uid), worker + "/exams")));
      await assertFails(updateDoc(doc(db(uid), path), { value: 1 }));
    }
    await assertFails(setDoc(doc(db("doctor"), path + "-fake"), { ...result, createdBy: "other" }));
    await assertFails(getDoc(doc(db("doctor"), "companies/foreign/employees/e/exams/test")));
    await assertFails(deleteDoc(doc(db("doctor"), path)));
  });
  it("cliente e operador não alteram a integração e o registro de auditoria", async () => {
    await assertFails(
      setDoc(doc(db("client"), "integrations/grupo-avp"), { sourceVersion: "forged" })
    );
    await assertFails(
      setDoc(doc(db("global"), "integrations/grupo-avp/audit/forged"), { action: "fake" })
    );
  });
  it("impede todos os perfis do navegador de criar, alterar ou excluir logs PHI", async () => {
    for (const uid of ["client", "hr", "doctor", "provider", "global", "super"]) {
      const log = doc(db(uid), "phi_audit_logs/synthetic");
      await assertFails(setDoc(doc(db(uid), "phi_audit_logs/forged"), { action: "forged" }));
      await assertFails(updateDoc(log, { patientId: "forged" }));
      await assertFails(deleteDoc(log));
    }
    await assertSucceeds(getDoc(doc(db("global"), "phi_audit_logs/synthetic")));
    await assertSucceeds(getDoc(doc(db("super"), "phi_audit_logs/synthetic")));
    await assertFails(getDoc(doc(db("hr"), "phi_audit_logs/synthetic")));
  });
});
describe("Evidências no Storage", () => {
  it("RH e prestador genérico não leem documento clínico; médico autorizado pode ler", async () => {
    const path = "clientes/avp/colaboradores/synthetic/record.pdf";
    await assertFails(getBytes(ref(store("hr"), path)));
    await assertSucceeds(getBytes(ref(store("doctor"), path)));
    await assertFails(getBytes(ref(store("provider"), path)));
  });
  it("permite evidência de EPI no caminho oficial e rejeita o caminho incorreto", async () => {
    const bytes = new Uint8Array([1, 2]);
    await assertSucceeds(
      uploadBytes(ref(store("client"), "clientes/avp/epi_recibos/synthetic/proof.png"), bytes, {
        contentType: "image/png",
      })
    );
    await assertFails(
      uploadBytes(
        ref(store("client"), "companies/avp/employees/synthetic/ppe_deliveries/proof.png"),
        bytes,
        { contentType: "image/png" }
      )
    );
  });
  it("permite excluir arquivo operacional e impede exclusão clínica comum", async () => {
    const path = "clientes/avp/epi_recibos/synthetic/proof.png";
    await assertSucceeds(
      uploadBytes(ref(store("client"), path), new Uint8Array([1]), { contentType: "image/png" })
    );
    await assertSucceeds(deleteObject(ref(store("client"), path)));
    await assertFails(
      deleteObject(ref(store("doctor"), "clientes/avp/colaboradores/synthetic/record.pdf"))
    );
  });
});

describe("Chaves de integração protegidas pelo servidor", () => {
  it("nega leitura e criação direta de chaves até para administradores", async () => {
    for (const uid of ["client", "global", "super"]) {
      await assertFails(getDoc(doc(db(uid), "api_keys/private-key")));
      await assertFails(
        setDoc(doc(db(uid), "api_keys/forged-key"), {
          clientId: "GLOBAL",
          active: true,
          scopes: ["*"],
          keyHash: "forged",
        })
      );
    }
  });
});

describe("Webhooks geridos pelo servidor", () => {
  it("impede leitura de segredo e escrita direta por perfis de navegador", async () => {
    for (const uid of ["client", "global", "super"]) {
      for (const collection of ["webhooks", "webhook_deliveries"]) {
        await assertFails(getDoc(doc(db(uid), collection, "private")));
        await assertFails(setDoc(doc(db(uid), collection, "forged"), { clientId: "GLOBAL" }));
      }
    }
  });
});

describe("Omie server credentials", () => {
  it("blocks every browser role from reading or overwriting integration credentials", async () => {
    const path = "private-integrations/omie/nextcon.json";
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(
        ref(ctx.storage(), path),
        new TextEncoder().encode('{"appSecret":"synthetic"}'),
        { contentType: "application/json" }
      );
    });
    for (const uid of ["super", "global", "client", "hr", "doctor"]) {
      await assertFails(getBytes(ref(store(uid), path)));
      await assertFails(
        uploadBytes(ref(store(uid), path), new Uint8Array([1]), { contentType: "application/json" })
      );
      await assertFails(deleteObject(ref(store(uid), path)));
    }
  });
});

describe("Native financial control server boundary", () => {
  it.each([
    "financial-operations/v1/nextcon.json",
    "supplier-qualification/v1/book.json",
    "supplier-qualification/v1/documents/process/document",
  ])("denies browser roles access to %s", async (path) => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), path), new TextEncoder().encode('{"synthetic":true}'), {
        contentType: "application/json",
      });
    });
    for (const uid of ["super", "global", "client", "hr", "doctor", "provider"]) {
      await assertFails(getBytes(ref(store(uid), path)));
      await assertFails(
        uploadBytes(ref(store(uid), path), new Uint8Array([1]), { contentType: "application/json" })
      );
      await assertFails(deleteObject(ref(store(uid), path)));
    }
  });
});
