import { doc, getDoc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import { getBytes, getMetadata, ref, uploadBytes, type FirebaseStorage } from "firebase/storage";
import type { ContractAnalysisOutput } from "@/ai/flows/contract-analysis-flow";
import { isValidCnpj, normalizeCnpj } from "@/lib/cnpj";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024 - 1;

class ContractImportRejected extends Error {}

export type ContractSource = {
  sha256: string;
  storagePath: string;
  generation: string;
  sizeBytes: number;
};

export class ContractImportConfirmationPending extends Error {
  constructor() {
    super(
      "A gravação pode ter sido concluída, mas ainda não foi possível confirmá-la. Tente novamente."
    );
    this.name = "ContractImportConfirmationPending";
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assertPdf(bytes: Uint8Array, size: number) {
  if (!size || size > MAX_SOURCE_BYTES || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    throw new Error("Selecione um PDF válido com menos de 10 MB.");
}

export async function hashContractFile(file: File): Promise<string> {
  if (!file.size || file.size > MAX_SOURCE_BYTES)
    throw new Error("Selecione um PDF válido com menos de 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  assertPdf(bytes, file.size);
  return sha256(bytes);
}

async function verifyStoredSource(
  storage: FirebaseStorage,
  storagePath: string,
  expectedHash: string,
  signal?: AbortSignal
): Promise<ContractSource> {
  signal?.throwIfAborted();
  const storageRef = ref(storage, storagePath);
  const [metadata, storedBytes] = await Promise.all([
    getMetadata(storageRef),
    getBytes(storageRef),
  ]);
  const bytes = new Uint8Array(storedBytes);
  signal?.throwIfAborted();
  if (
    metadata.contentType !== "application/pdf" ||
    metadata.customMetadata?.sourceSha256 !== expectedHash ||
    !/^\d+$/.test(metadata.generation) ||
    metadata.size > MAX_SOURCE_BYTES ||
    bytes.length !== metadata.size
  )
    throw new Error("A fonte armazenada não corresponde à importação.");
  assertPdf(bytes, metadata.size);
  const digest = await sha256(bytes);
  signal?.throwIfAborted();
  if (digest !== expectedHash)
    throw new Error("A integridade do PDF armazenado não foi confirmada.");
  return {
    sha256: expectedHash,
    storagePath,
    generation: metadata.generation,
    sizeBytes: metadata.size,
  };
}

export async function preserveContractSource(
  storage: FirebaseStorage,
  file: File,
  sourceHash: string,
  signal?: AbortSignal
): Promise<ContractSource> {
  signal?.throwIfAborted();
  if (!/^[a-f0-9]{64}$/.test(sourceHash) || (await hashContractFile(file)) !== sourceHash)
    throw new Error("Não foi possível confirmar a identidade do PDF selecionado.");
  signal?.throwIfAborted();
  const storagePath = `internos_nextcon/contract-sources/${sourceHash}`;
  const storageRef = ref(storage, storagePath);
  try {
    await getMetadata(storageRef);
  } catch (error) {
    signal?.throwIfAborted();
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "storage/object-not-found"
    )
      throw error;
    try {
      await uploadBytes(storageRef, file, {
        contentType: "application/pdf",
        customMetadata: { sourceSha256: sourceHash },
      });
    } catch (uploadError) {
      signal?.throwIfAborted();
      try {
        return await verifyStoredSource(storage, storagePath, sourceHash, signal);
      } catch {
        throw uploadError;
      }
    }
  }
  return verifyStoredSource(storage, storagePath, sourceHash, signal);
}

function validateCompany(
  companyId: string,
  company: Record<string, unknown> | undefined,
  extractedCnpj: string
) {
  if (!company)
    throw new ContractImportRejected(
      "Selecione um cadastro de empresa existente para conferência."
    );
  const storedCnpj = typeof company.cnpj === "string" ? normalizeCnpj(company.cnpj) : "";
  if (!isValidCnpj(extractedCnpj) || !storedCnpj || storedCnpj !== normalizeCnpj(extractedCnpj))
    throw new ContractImportRejected("O CNPJ extraído não corresponde ao cadastro selecionado.");
  if (
    company.active !== true ||
    company.isDeleted === true ||
    company.deletedAt ||
    company.status === "archived"
  )
    throw new ContractImportRejected("O cadastro selecionado está inativo ou arquivado.");
  if (!companyId || companyId.includes("/") || companyId.length > 128)
    throw new Error("Identificador de empresa inválido.");
  return typeof company.name === "string" ? company.name : "";
}

function storedSourceMatches(
  data: Record<string, unknown>,
  companyId: string,
  source: ContractSource
) {
  return (
    data.companyId === companyId &&
    data.sourceHash === source.sha256 &&
    data.sourceStoragePath === source.storagePath &&
    data.sourceGeneration === source.generation &&
    data.sourceSizeBytes === source.sizeBytes
  );
}

function hasSourceConfirmation(data: Record<string, unknown>) {
  return (
    data.sourceConfirmed === true &&
    typeof data.sourceConfirmedBy === "string" &&
    data.sourceConfirmedBy.length > 0 &&
    data.sourceConfirmedAt != null
  );
}

function persistedSource(source: ContractSource) {
  return {
    sourceHash: source.sha256,
    sourceStoragePath: source.storagePath,
    sourceGeneration: source.generation,
    sourceSizeBytes: source.sizeBytes,
  };
}

export async function integrateAnalyzedContract(
  db: Firestore,
  storage: FirebaseStorage,
  result: ContractAnalysisOutput,
  companyId: string,
  source: ContractSource,
  actor: string,
  sourceConfirmed: boolean,
  signal?: AbortSignal
): Promise<{ companyId: string; contractId: string; created: boolean }> {
  signal?.throwIfAborted();
  if (!isValidCnpj(result.clientInfo.cnpj))
    throw new Error("Não foi possível validar o CNPJ extraído do contrato.");
  if (result.operationalTasks.length > 15)
    throw new Error("A análise excedeu o limite de 15 tarefas operacionais para revisão.");
  if (!/^[a-f0-9]{64}$/.test(source.sha256) || !actor.trim() || sourceConfirmed !== true)
    throw new Error("Revise a fonte e confirme os dados antes de integrar.");
  if (!companyId || companyId.includes("/") || companyId.length > 128)
    throw new Error("Identificador de empresa inválido.");
  if (source.storagePath !== `internos_nextcon/contract-sources/${source.sha256}`)
    throw new Error("A fonte não está no armazenamento privado esperado.");
  const verifiedSource = await verifyStoredSource(
    storage,
    source.storagePath,
    source.sha256,
    signal
  );
  if (
    verifiedSource.generation !== source.generation ||
    verifiedSource.sizeBytes !== source.sizeBytes
  )
    throw new Error("A versão armazenada do PDF mudou. Revise a fonte antes de integrar.");

  const contractId = `source_${source.sha256}`;
  const companyRef = doc(db, "companies", companyId);
  const contractRef = doc(db, "companies", companyId, "contracts", contractId);
  const registryRef = doc(db, "contract_import_sources", source.sha256);
  const extractedCnpj = normalizeCnpj(result.clientInfo.cnpj);

  let outcome: { companyId: string; contractId: string; created: boolean };
  try {
    outcome = await runTransaction(db, async (transaction) => {
      signal?.throwIfAborted();
      const [companySnapshot, registrySnapshot, contractSnapshot] = await Promise.all([
        transaction.get(companyRef),
        transaction.get(registryRef),
        transaction.get(contractRef),
      ]);
      signal?.throwIfAborted();
      const companyName = validateCompany(companyId, companySnapshot.data(), extractedCnpj);
      if (registrySnapshot.exists()) {
        const registry = registrySnapshot.data();
        if (
          registry.companyId !== companyId ||
          registry.contractId !== contractId ||
          !hasSourceConfirmation(registry) ||
          !storedSourceMatches(registry, companyId, verifiedSource) ||
          !contractSnapshot.exists() ||
          !hasSourceConfirmation(contractSnapshot.data()) ||
          !storedSourceMatches(contractSnapshot.data(), companyId, verifiedSource)
        )
          throw new ContractImportRejected(
            "Esta fonte já está vinculada a outro cadastro ou a dados divergentes."
          );
        return { companyId, contractId, created: false };
      }
      if (contractSnapshot.exists())
        throw new ContractImportRejected(
          "O contrato existe sem vínculo de origem consistente. Solicite conferência."
        );

      const confirmation = {
        sourceConfirmed: true,
        sourceConfirmedBy: actor,
        sourceConfirmedAt: serverTimestamp(),
      };
      transaction.set(registryRef, {
        companyId,
        contractId,
        ...persistedSource(verifiedSource),
        ...confirmation,
      });
      transaction.set(contractRef, {
        companyId,
        companyName,
        extractedCompanyName: result.clientInfo.name,
        extractedCompanyDocument: extractedCnpj,
        summary: result.summary,
        clauses: result.clauses,
        operationalTasks: result.operationalTasks,
        ...persistedSource(verifiedSource),
        ...confirmation,
        createdAt: serverTimestamp(),
      });
      result.operationalTasks.forEach((task, index) => {
        transaction.set(doc(db, "companies", companyId, "tasks", `${contractId}_task_${index}`), {
          title: task.title,
          description: task.description,
          type: task.category,
          status: "todo",
          // Empty deadline keeps the task visible in ordered SGI queries without inventing a date.
          dueDate: "",
          frequency: task.frequency,
          checklist: task.checklist.map((text, step) => ({
            id: `contract-${step}`,
            text,
            checked: false,
          })),
          companyId,
          companyName,
          contractId,
          sourceHash: source.sha256,
          reviewedBy: actor,
          createdAt: serverTimestamp(),
        });
      });
      return { companyId, contractId, created: true };
    });
  } catch (transactionError) {
    signal?.throwIfAborted();
    if (transactionError instanceof ContractImportRejected) throw transactionError;
    let registry;
    let contract;
    try {
      [registry, contract] = await Promise.all([getDoc(registryRef), getDoc(contractRef)]);
    } catch {
      throw new ContractImportConfirmationPending();
    }
    if (!registry.exists() && !contract.exists()) throw transactionError;
    if (
      !registry.exists() ||
      !contract.exists() ||
      registry.data().companyId !== companyId ||
      registry.data().contractId !== contractId ||
      !hasSourceConfirmation(registry.data()) ||
      !storedSourceMatches(registry.data(), companyId, verifiedSource) ||
      !hasSourceConfirmation(contract.data()) ||
      !storedSourceMatches(contract.data(), companyId, verifiedSource)
    )
      throw new Error("A integração foi gravada com vínculo divergente. Solicite conferência.");
    outcome = { companyId, contractId, created: false };
  }

  let persisted;
  let persistedRegistry;
  signal?.throwIfAborted();
  try {
    [persistedRegistry, persisted] = await Promise.all([getDoc(registryRef), getDoc(contractRef)]);
  } catch {
    signal?.throwIfAborted();
    throw new ContractImportConfirmationPending();
  }
  signal?.throwIfAborted();
  if (
    !persistedRegistry.exists() ||
    !persisted.exists() ||
    persistedRegistry.data().companyId !== companyId ||
    persistedRegistry.data().contractId !== contractId ||
    !hasSourceConfirmation(persistedRegistry.data()) ||
    !storedSourceMatches(persistedRegistry.data(), companyId, verifiedSource) ||
    !hasSourceConfirmation(persisted.data()) ||
    !storedSourceMatches(persisted.data(), companyId, verifiedSource)
  )
    throw new ContractImportConfirmationPending();
  return outcome;
}
