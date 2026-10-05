import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, getDoc } from "firebase/firestore";
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
    await uploadBytes(
      ref(ctx.storage(), "clientes/avp/colaboradores/synthetic/record.pdf"),
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

describe("Perfis e prontuários", () => {
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
    await assertSucceeds(
      setDoc(doc(db("doctor"), "companies/avp/aso_attendances/new"), {
        employeeId: "synthetic-patient",
      })
    );
    await assertFails(getDoc(doc(db("doctor"), "companies/foreign/aso_attendances/synthetic")));
  });
  it("prestador acessa somente a empresa concedida", async () => {
    await assertSucceeds(getDoc(doc(db("provider"), "companies/avp/aso_attendances/synthetic")));
    await assertFails(getDoc(doc(db("provider"), "companies/foreign/aso_attendances/synthetic")));
  });
  it("cliente e operador não alteram a integração e o registro de auditoria", async () => {
    await assertFails(
      setDoc(doc(db("client"), "integrations/grupo-avp"), { sourceVersion: "forged" })
    );
    await assertFails(
      setDoc(doc(db("global"), "integrations/grupo-avp/audit/forged"), { action: "fake" })
    );
  });
});
describe("Evidências no Storage", () => {
  it("RH não lê documento clínico; médico e prestador concedidos podem ler", async () => {
    const path = "clientes/avp/colaboradores/synthetic/record.pdf";
    await assertFails(getBytes(ref(store("hr"), path)));
    await assertSucceeds(getBytes(ref(store("doctor"), path)));
    await assertSucceeds(getBytes(ref(store("provider"), path)));
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
