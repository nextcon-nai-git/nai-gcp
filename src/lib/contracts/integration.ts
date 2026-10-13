import { doc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import type { ContractAnalysisOutput } from "@/ai/flows/contract-analysis-flow";

export async function hashContractFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function integrateAnalyzedContract(
  db: Firestore,
  result: ContractAnalysisOutput,
  sourceHash: string
): Promise<{ companyId: string; created: boolean }> {
  if (!/^[a-f0-9]{64}$/.test(sourceHash))
    throw new Error("Não foi possível identificar o arquivo de origem.");
  const companyId = result.clientInfo.cnpj.replace(/\D/g, "");
  if (!/^\d{14}$/.test(companyId))
    throw new Error("Não foi possível validar o CNPJ extraído do contrato.");
  if (result.operationalTasks.length > 498)
    throw new Error("O contrato excede o limite de tarefas para integração atômica.");

  const contractId = `source_${sourceHash}`;
  const companyRef = doc(db, "companies", companyId);
  const contractRef = doc(db, "companies", companyId, "contracts", contractId);
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(contractRef);
    if (existing.exists()) return { companyId, created: false };

    transaction.set(
      companyRef,
      {
        id: companyId,
        name: result.clientInfo.name.toUpperCase(),
        cnpj: result.clientInfo.cnpj,
        risk_degree: result.clientInfo.riskDegree,
        address: result.clientInfo.address,
        segment: result.clientInfo.segment,
        active: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    transaction.set(contractRef, {
      companyId,
      companyName: result.clientInfo.name,
      summary: result.summary,
      clauses: result.clauses,
      operationalTasks: result.operationalTasks,
      sourceHash,
      createdAt: serverTimestamp(),
    });

    result.operationalTasks.forEach((task, index) => {
      transaction.set(doc(db, "companies", companyId, "tasks", `${contractId}_task_${index}`), {
        title: task.title,
        description: task.description,
        type: task.category,
        status: "todo",
        priority: "high",
        companyId,
        companyName: result.clientInfo.name,
        contractId,
        progress: 0,
        createdAt: serverTimestamp(),
        dueDate,
      });
    });

    return { companyId, created: true };
  });
}
