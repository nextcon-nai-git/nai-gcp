import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";

let env: RulesTestEnvironment;
const companies = ["tenant-a", "tenant-b"];
const importedRecord = (companyId: string) =>
  `companies/${companyId}/clinical_records/import_synthetic`;
const clinicalFile = (companyId: string) =>
  `clientes/${companyId}/colaboradores/synthetic/record.pdf`;
const importedFile = (companyId: string) =>
  `clientes/${companyId}/prontuarios/importacoes/synthetic.pdf`;
const operationalFile = (companyId: string) =>
  `clientes/${companyId}/epi_recibos/synthetic/proof.pdf`;

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
    for (const companyId of companies) {
      await setDoc(doc(ctx.firestore(), importedRecord(companyId)), { synthetic: true });
      for (const collection of ["tasks", "agendamentos", "employees"]) {
        await setDoc(doc(ctx.firestore(), `companies/${companyId}/${collection}/synthetic`), {
          synthetic: true,
        });
      }
      for (const path of [
        clinicalFile(companyId),
        importedFile(companyId),
        operationalFile(companyId),
      ]) {
        await uploadBytes(ref(ctx.storage(), path), new Uint8Array([1, 2]), {
          contentType: "application/pdf",
        });
      }
    }
  });
});
afterAll(async () => env?.cleanup());

async function profile(data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users/synthetic-user"), {
      role: "DOCTOR",
      companyId: "tenant-a",
      servedCompanies: [],
      ...data,
    });
  });
  return env.authenticatedContext("synthetic-user");
}

describe("A precedência do tenant acompanha a autorização da API", () => {
  it.each(["", "   ", null, 0, undefined])(
    "ADMIN com tenantId %j mantém o escopo do companyId legado no Firestore",
    async (tenantId) => {
      const ctx = await profile({ role: "ADMIN", ...(tenantId === undefined ? {} : { tenantId }) });
      await assertSucceeds(getDoc(doc(ctx.firestore(), importedRecord("tenant-a"))));
      await assertFails(getDoc(doc(ctx.firestore(), importedRecord("tenant-b"))));
    }
  );

  it.each(["", "   ", null, 0, undefined])(
    "ADMIN com tenantId %j mantém o escopo do companyId legado no Storage",
    async (tenantId) => {
      const ctx = await profile({ role: "ADMIN", ...(tenantId === undefined ? {} : { tenantId }) });
      await assertSucceeds(getBytes(ref(ctx.storage(), importedFile("tenant-a"))));
      await assertFails(getBytes(ref(ctx.storage(), importedFile("tenant-b"))));
    }
  );

  it.each(["ADMIN", "DOCTOR", "NURSE", "HEALTH_PROFESSIONAL", "PROVIDER"])(
    "%s com tenant explícito não reutiliza a empresa legada para documentos clínicos",
    async (role) => {
      const ctx = await profile({ role, tenantId: "tenant-b" });
      await assertFails(getBytes(ref(ctx.storage(), clinicalFile("tenant-a"))));
      await assertFails(
        uploadBytes(ref(ctx.storage(), clinicalFile("tenant-a")), new Uint8Array([3]), {
          contentType: "application/pdf",
        })
      );
      await assertSucceeds(getBytes(ref(ctx.storage(), clinicalFile("tenant-b"))));
      await assertSucceeds(
        uploadBytes(ref(ctx.storage(), clinicalFile("tenant-b")), new Uint8Array([3]), {
          contentType: "application/pdf",
        })
      );
    }
  );

  it("preserva uma concessão explícita a outra empresa", async () => {
    const ctx = await profile({ tenantId: "tenant-b", servedCompanies: ["tenant-a"] });
    for (const companyId of companies) {
      await assertSucceeds(getDoc(doc(ctx.firestore(), importedRecord(companyId))));
      await assertSucceeds(getBytes(ref(ctx.storage(), importedFile(companyId))));
      await assertSucceeds(getBytes(ref(ctx.storage(), clinicalFile(companyId))));
    }
  });

  it.each(["ADMIN", "CLIENT_ADMIN", "DOCTOR", "HR"])(
    "%s não herda leitura operacional da empresa legada quando há tenant explícito",
    async (role) => {
      const ctx = await profile({ role, tenantId: "tenant-b" });
      for (const collection of ["tasks", "agendamentos", "employees"]) {
        await assertFails(
          getDoc(doc(ctx.firestore(), `companies/tenant-a/${collection}/synthetic`))
        );
        await assertSucceeds(
          getDoc(doc(ctx.firestore(), `companies/tenant-b/${collection}/synthetic`))
        );
      }
      await assertFails(getBytes(ref(ctx.storage(), operationalFile("tenant-a"))));
      await assertSucceeds(getBytes(ref(ctx.storage(), operationalFile("tenant-b"))));
    }
  );

  it.each(["ADMIN", "CLIENT_ADMIN"])(
    "%s só altera cadastros e evidências do tenant explícito",
    async (role) => {
      const ctx = await profile({ role, tenantId: "tenant-b" });
      await assertFails(
        setDoc(doc(ctx.firestore(), "companies/tenant-a/employees/new"), { synthetic: true })
      );
      await assertSucceeds(
        setDoc(doc(ctx.firestore(), "companies/tenant-b/employees/new"), { synthetic: true })
      );
      await assertFails(
        uploadBytes(ref(ctx.storage(), operationalFile("tenant-a")), new Uint8Array([3]), {
          contentType: "application/pdf",
        })
      );
      await assertSucceeds(
        uploadBytes(ref(ctx.storage(), operationalFile("tenant-b")), new Uint8Array([3]), {
          contentType: "application/pdf",
        })
      );
    }
  );

  it("prestador usa o tenant explícito para os cards operacionais", async () => {
    const ctx = await profile({ role: "PROVIDER", tenantId: "tenant-b" });
    await assertFails(getDoc(doc(ctx.firestore(), "companies/tenant-a/tasks/synthetic")));
    await assertSucceeds(getDoc(doc(ctx.firestore(), "companies/tenant-b/tasks/synthetic")));
  });

  it.each(["", null, undefined])(
    "preserva o acesso interno legado do ADMIN nextcon com tenant %j",
    async (tenantId) => {
      const ctx = await profile({
        role: "ADMIN",
        companyId: "nextcon",
        ...(tenantId === undefined ? {} : { tenantId }),
      });
      for (const companyId of companies) {
        await assertSucceeds(
          getDoc(doc(ctx.firestore(), `companies/${companyId}/tasks/synthetic`))
        );
        await assertSucceeds(getBytes(ref(ctx.storage(), clinicalFile(companyId))));
        await assertSucceeds(getBytes(ref(ctx.storage(), operationalFile(companyId))));
      }
    }
  );

  it.each([
    { role: "ADMIN", companyId: "", tenantId: "" },
    { role: "SUPER_ADMIN", companyId: "tenant-a", tenantId: "tenant-b" },
  ])("preserva a consulta global autorizada das importações (%j)", async (data) => {
    const ctx = await profile(data);
    for (const companyId of companies) {
      await assertSucceeds(getDoc(doc(ctx.firestore(), importedRecord(companyId))));
      await assertSucceeds(getBytes(ref(ctx.storage(), importedFile(companyId))));
    }
  });
});
