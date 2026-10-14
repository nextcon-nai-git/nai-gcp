import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, type Firestore } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";
import type { ContractAnalysisOutput } from "@/ai/flows/contract-analysis-flow";
import {
  hashContractFile,
  integrateAnalyzedContract,
  preserveContractSource,
} from "@/lib/contracts/integration";

let env: RulesTestEnvironment;
const companyId = "legacy-company-id";
const file = new File(["%PDF-1.7\nsynthetic"], "contract.pdf", { type: "application/pdf" });
const analysis: ContractAnalysisOutput = {
  summary: "Resumo sintético",
  clientInfo: {
    name: "Razão social extraída divergente",
    cnpj: "11.222.333/0001-81",
    segment: "Sintético",
    riskDegree: 2,
    address: "Endereço sintético",
  },
  clauses: { rights: [], duties: [] },
  operationalTasks: [
    {
      title: "Obrigação para revisão",
      description: "Sugestão sintética",
      category: "pgr",
      frequency: "anual",
      checklist: [],
    },
  ],
};

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
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users/global"), {
      role: "SUPER_ADMIN",
      companyId: "nextcon",
    });
    await setDoc(doc(context.firestore(), "users/tenant"), {
      role: "ADMIN",
      companyId: "avp",
      tenantId: "tenant-avp",
    });
    await setDoc(doc(context.firestore(), `companies/${companyId}`), {
      name: "Razão social verificada existente",
      cnpj: "11.222.333/0001-81",
      active: true,
      isDeleted: false,
    });
    await setDoc(doc(context.firestore(), "companies/archived-id"), {
      name: "Cadastro arquivado",
      cnpj: "11.222.333/0001-81",
      active: false,
      isDeleted: true,
    });
  });
});

afterAll(async () => {
  await env?.cleanup();
});

const db = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const storage = (uid: string) =>
  env.authenticatedContext(uid).storage() as unknown as FirebaseStorage;

async function preserve(uid = "global") {
  const sourceHash = await hashContractFile(file);
  const source = await preserveContractSource(storage(uid), file, sourceHash);
  return { sourceHash, source };
}

describe("Private contract import rules and persistence", () => {
  it("keeps ordinary internal files writable without opening the contract source namespace", async () => {
    for (const path of ["internos_nextcon/report.pdf", "internos_nextcon/reports/report.pdf"]) {
      const target = ref(storage("global"), path);
      await assertSucceeds(uploadBytes(target, file, { contentType: "application/pdf" }));
      await assertSucceeds(uploadBytes(target, file, { contentType: "application/pdf" }));
      await assertFails(
        uploadBytes(ref(storage("tenant"), path), file, { contentType: "application/pdf" })
      );
      await assertSucceeds(deleteObject(target));
    }
    for (const path of [
      "internos_nextcon/contract-sources/invalid.pdf",
      "internos_nextcon/contract-sources/nested/source.pdf",
    ]) {
      await assertFails(
        uploadBytes(ref(storage("global"), path), file, { contentType: "application/pdf" })
      );
    }
    const { source } = await preserve();
    await assertFails(deleteObject(ref(storage("global"), source.storagePath)));
  });

  it("allows internal staff to preserve source and atomically link it to an existing legacy ID", async () => {
    const companyBefore = await getDoc(doc(db("global"), `companies/${companyId}`));
    const { sourceHash, source } = await preserve();
    const result = await integrateAnalyzedContract(
      db("global"),
      storage("global"),
      analysis,
      companyId,
      source,
      "global",
      true
    );

    expect(result).toMatchObject({ companyId, contractId: `source_${sourceHash}`, created: true });
    const contract = await getDoc(
      doc(db("global"), `companies/${companyId}/contracts/source_${sourceHash}`)
    );
    expect(contract.data()).toMatchObject({
      companyId,
      companyName: "Razão social verificada existente",
      extractedCompanyName: "Razão social extraída divergente",
      sourceHash,
      sourceGeneration: source.generation,
      sourceConfirmedBy: "global",
    });
    const registry = await getDoc(doc(db("global"), `contract_import_sources/${sourceHash}`));
    expect(registry.data()).toMatchObject({
      companyId,
      contractId: `source_${sourceHash}`,
      sourceConfirmed: true,
      sourceConfirmedBy: "global",
      sourceStoragePath: source.storagePath,
      sourceGeneration: source.generation,
    });
    expect((await getDoc(doc(db("global"), `companies/${companyId}`))).data()).toEqual(
      companyBefore.data()
    );
    await expect(getBytes(ref(storage("global"), source.storagePath))).resolves.toBeDefined();
    expect((await getDocs(collection(db("global"), "users"))).docs.map((item) => item.id)).toEqual([
      "global",
      "tenant",
    ]);
    for (const name of ["financial", "invoices", "notes"])
      expect((await getDocs(collection(db("global"), name))).empty).toBe(true);
  });

  it("rejects tenant writes and prevents global staff from writing the company root", async () => {
    const { source } = await preserve();
    await assertFails(
      integrateAnalyzedContract(
        db("tenant"),
        storage("tenant"),
        analysis,
        companyId,
        source,
        "tenant",
        true
      )
    );
    await assertFails(
      setDoc(doc(db("global"), "companies/new-company"), { cnpj: "11.222.333/0001-81" })
    );
    expect((await getDocs(collection(db("global"), "contract_import_sources"))).empty).toBe(true);
  });

  it("rejects inactive and archived company documents without changing their state", async () => {
    const { source } = await preserve();
    const companyBefore = await getDoc(doc(db("global"), "companies/archived-id"));
    await expect(
      integrateAnalyzedContract(
        db("global"),
        storage("global"),
        analysis,
        "archived-id",
        source,
        "global",
        true
      )
    ).rejects.toThrow(/inativo ou arquivado/);
    expect((await getDoc(doc(db("global"), "companies/archived-id"))).data()).toEqual(
      companyBefore.data()
    );
  });

  it("does not create a company when the selected document ID does not exist", async () => {
    const { source } = await preserve();
    await expect(
      integrateAnalyzedContract(
        db("global"),
        storage("global"),
        analysis,
        "new-company",
        source,
        "global",
        true
      )
    ).rejects.toThrow(/cadastro de empresa existente/);
    expect((await getDoc(doc(db("global"), "companies/new-company"))).exists()).toBe(false);
    expect((await getDocs(collection(db("global"), "contract_import_sources"))).empty).toBe(true);
  });

  // The emulator can hold contended transaction locks for 30 seconds. Keep the
  // real concurrent calls and allow time for the SDK retry instead of timing out
  // mid-transaction and leaking work into the next test's database reset.
  // https://firebase.google.com/docs/emulator-suite/connect_firestore#transactions
  it("makes concurrent retries idempotent and refuses source overwrite", async () => {
    const { source } = await preserve();
    const outcomes = await Promise.all([
      integrateAnalyzedContract(
        db("global"),
        storage("global"),
        analysis,
        companyId,
        source,
        "global",
        true
      ),
      integrateAnalyzedContract(
        db("global"),
        storage("global"),
        analysis,
        companyId,
        source,
        "global",
        true
      ),
    ]);
    expect(outcomes.filter((item) => item.created)).toHaveLength(1);
    expect((await getDocs(collection(db("global"), `companies/${companyId}/tasks`))).size).toBe(1);
    await assertFails(
      uploadBytes(ref(storage("global"), source.storagePath), file, {
        contentType: "application/pdf",
        customMetadata: { sourceSha256: source.sha256 },
      })
    );
    await assertFails(getBytes(ref(storage("tenant"), source.storagePath)));
  }, 60_000);

  it("does not claim a created company when the extracted CNPJ mismatches", async () => {
    const { source } = await preserve();
    await expect(
      integrateAnalyzedContract(
        db("global"),
        storage("global"),
        {
          ...analysis,
          clientInfo: { ...analysis.clientInfo, cnpj: "12.345.678/0001-95" },
        },
        companyId,
        source,
        "global",
        true
      )
    ).rejects.toThrow(/não corresponde/);
    expect((await getDocs(collection(db("global"), "contract_import_sources"))).empty).toBe(true);
  });
});
