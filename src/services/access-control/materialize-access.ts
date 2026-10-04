import { createHash } from "crypto";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";

export interface MaterializedAccessRecord {
  employeeId: string;
  employeeName: string;
  companyId: string;
  badgeCode: string;
  cpf: string;
  status: "ACTIVE" | "BLOCKED" | "SUSPENDED";
  asoValidUntil: string | null; // Formato YYYY-MM-DD
  trainingValidUntil: string | null; // Formato YYYY-MM-DD
  missingNrs: string[];
  version: number;
  lastMaterializedAt: string;
}

/**
 * Gera hash SHA-256 único para identificação universal de crachás
 */
export function hashBadgeCode(companyId: string, badgeCode: string): string {
  return createHash("sha256")
    .update(`${companyId}:${badgeCode.trim().toLowerCase()}`)
    .digest("hex");
}

/**
 * Materializa o Índice de Autorização de Acesso (O(1) Single-Doc Read)
 *
 * Grava em duas estruturas de acesso instantâneo:
 * 1. companies/{companyId}/access_index/{badgeKey}
 * 2. access_cards/{badgeHash}
 */
export async function syncMaterializedAccessRecord(
  companyId: string,
  employee: {
    id: string;
    name: string;
    cpf?: string;
    badgeCode?: string;
    status?: string;
    nextAsoDate?: string;
    requiredNrs?: string[];
    trainings?: Array<{ nr: string; validUntil: string }>;
  }
): Promise<MaterializedAccessRecord> {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const cleanCpf = (employee.cpf || "").replace(/\D/g, "");
  const cleanBadge = (employee.badgeCode || cleanCpf || employee.id).trim();

  const now = new Date();
  const nowIsoDate = now.toISOString().split("T")[0];

  // 1. Cálculo de Validade do ASO
  let asoValidUntil: string | null = null;
  if (employee.nextAsoDate) {
    asoValidUntil = employee.nextAsoDate.split("T")[0];
  }

  // 2. Cálculo de Validade dos Treinamentos Regulamentares (NRs)
  const requiredNrs = employee.requiredNrs || [];
  let trainingValidUntil: string | null = null;
  const missingNrs: string[] = [];

  if (requiredNrs.length > 0) {
    let earliestExpiry: string | null = null;
    const trainings = employee.trainings || [];

    for (const nr of requiredNrs) {
      const validTraining = trainings.find((t) => t.nr === nr && t.validUntil >= nowIsoDate);
      if (!validTraining) {
        missingNrs.push(nr);
      } else {
        const expiry = validTraining.validUntil.split("T")[0];
        if (!earliestExpiry || expiry < earliestExpiry) {
          earliestExpiry = expiry;
        }
      }
    }
    trainingValidUntil = earliestExpiry;
  }

  // 3. Determinação do Status de Acesso
  const isBlocked =
    (employee.status || "").toUpperCase() === "INACTIVE" ||
    (employee.status || "").toUpperCase() === "TERMINATED";
  const accessStatus: "ACTIVE" | "BLOCKED" | "SUSPENDED" = isBlocked ? "BLOCKED" : "ACTIVE";

  const materialized: MaterializedAccessRecord = {
    employeeId: employee.id,
    employeeName: employee.name,
    companyId,
    badgeCode: cleanBadge,
    cpf: cleanCpf,
    status: accessStatus,
    asoValidUntil,
    trainingValidUntil,
    missingNrs,
    version: 1,
    lastMaterializedAt: new Date().toISOString(),
  };

  const payload = {
    ...materialized,
    updatedAt: serverTimestamp(),
  };

  // 4. Gravação atômica nos índices materializados
  // Index 1: companies/{companyId}/access_index/{badgeCode}
  if (cleanBadge) {
    const tenantBadgeRef = doc(db, "companies", companyId, "access_index", cleanBadge);
    await setDoc(tenantBadgeRef, payload, { merge: true });
  }

  // Index por CPF (se diferente do crachá)
  if (cleanCpf && cleanCpf !== cleanBadge) {
    const tenantCpfRef = doc(db, "companies", companyId, "access_index", cleanCpf);
    await setDoc(tenantCpfRef, payload, { merge: true });
  }

  // Index 2: Global access_cards/{badgeHash}
  const badgeHash = hashBadgeCode(companyId, cleanBadge);
  const globalCardRef = doc(db, "access_cards", badgeHash);
  await setDoc(globalCardRef, payload, { merge: true });

  return materialized;
}
