import { NextRequest, NextResponse } from "next/server";
import {
  requireApiKey,
  requireScope,
  requireClient,
  handleApiGuardError,
} from "@/lib/developer-api-guard";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";
import { AccessCheckResponse } from "@/types/developer";
import {
  MaterializedAccessRecord,
  syncMaterializedAccessRecord,
} from "@/services/access-control/materialize-access";

/**
 * ENDPOINT DE ULTRA-ALTA PERFORMANCE PARA CATRACAS & PORTARIAS (SLA < 100ms)
 *
 * Pipeline:
 * badgeCode / CPF
 *       ↓
 * 1 Documento Materializado: companies/{companyId}/access_index/{badgeCode}
 *       ↓
 * Decisão Instantânea em Memória (status == 'ACTIVE' && asoValid >= today && trainingValid >= today)
 *       ↓
 * < 100ms SLA
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Validação de Credencial M2M e Rate Limiting
    const authKey = await requireApiKey(req);

    // 2. Validação de Escopo
    requireScope(authKey, "access_control:read");

    const body = await req.json();
    const { cpf, badgeCode, companyId } = body;

    const rawBadge = (badgeCode || "").trim();
    const cleanCpf = (cpf || "").replace(/\D/g, "");
    const searchKey = rawBadge || cleanCpf;

    if (!searchKey) {
      return NextResponse.json(
        {
          error: "É necessário fornecer badgeCode ou cpf.",
        },
        { status: 400 }
      );
    }

    // 3. Validação de Tenant
    if (companyId) {
      requireClient(authKey, companyId);
    }

    const targetCompanyId = companyId || authKey.clientId;
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // 4. Leitura Direta de 1 Documento no Índice Materializado (O(1) Direct Key Lookup)
    const indexRef = doc(db, "companies", targetCompanyId, "access_index", searchKey);
    const indexSnap = await getDoc(indexRef);

    let accessRecord: MaterializedAccessRecord | null = null;
    let indexHit = true;

    if (indexSnap.exists()) {
      accessRecord = indexSnap.data() as MaterializedAccessRecord;
    } else {
      // Fallback sob demanda: Localiza o colaborador, calcula e materializa no índice para as próximas leituras
      indexHit = false;
      const empCollectionRef = collection(db, "companies", targetCompanyId, "employees");
      let empQuery = query(empCollectionRef, where("cpf", "==", cleanCpf), limit(1));

      if (rawBadge && !cleanCpf) {
        empQuery = query(empCollectionRef, where("badgeCode", "==", rawBadge), limit(1));
      }

      const empSnap = await getDocs(empQuery);
      if (empSnap.empty) {
        const resp: AccessCheckResponse = {
          allowed: false,
          reason: "Colaborador não localizado no cadastro da empresa.",
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(resp, {
          headers: {
            "X-Response-Time": `${Date.now() - startTime}ms`,
            "X-NAI-Index-Hit": "MISS",
          },
        });
      }

      const empDoc = empSnap.docs[0];
      const empData = { id: empDoc.id, ...empDoc.data() };
      accessRecord = await syncMaterializedAccessRecord(targetCompanyId, empData as any);
    }

    // 5. Decisão Instantânea em Memória (< 1ms)
    const today = new Date().toISOString().split("T")[0];

    // Checagem de Status Cadastral
    if (accessRecord.status !== "ACTIVE") {
      return NextResponse.json(
        {
          allowed: false,
          reason: "Acesso Bloqueado: Colaborador com cadastro inativo ou desligado.",
          employeeName: accessRecord.employeeName,
          asoStatus: "MISSING",
          timestamp: new Date().toISOString(),
        } as AccessCheckResponse,
        {
          headers: {
            "X-Response-Time": `${Date.now() - startTime}ms`,
            "X-NAI-Index-Hit": indexHit ? "HIT_O1" : "WARMED",
          },
        }
      );
    }

    // Checagem de Validade de ASO (NR-7)
    if (!accessRecord.asoValidUntil || accessRecord.asoValidUntil < today) {
      return NextResponse.json(
        {
          allowed: false,
          reason: "ASO Vencido ou Inexistente. Acesso Bloqueado conforme PCMSO/NR-7.",
          employeeName: accessRecord.employeeName,
          asoStatus: accessRecord.asoValidUntil ? "EXPIRED" : "MISSING",
          asoDueDate: accessRecord.asoValidUntil || null,
          timestamp: new Date().toISOString(),
        } as AccessCheckResponse,
        {
          headers: {
            "X-Response-Time": `${Date.now() - startTime}ms`,
            "X-NAI-Index-Hit": indexHit ? "HIT_O1" : "WARMED",
          },
        }
      );
    }

    // Checagem de Validade de Treinamentos (NR-1 / NRs aplicáveis)
    if (accessRecord.missingNrs && accessRecord.missingNrs.length > 0) {
      return NextResponse.json(
        {
          allowed: false,
          reason: `Treinamentos regulamentares pendentes ou vencidos: ${accessRecord.missingNrs.join(", ")}. Bloqueado conforme NR-1.`,
          employeeName: accessRecord.employeeName,
          asoStatus: "VALID",
          asoDueDate: accessRecord.asoValidUntil,
          missingNrs: accessRecord.missingNrs,
          timestamp: new Date().toISOString(),
        } as AccessCheckResponse,
        {
          headers: {
            "X-Response-Time": `${Date.now() - startTime}ms`,
            "X-NAI-Index-Hit": indexHit ? "HIT_O1" : "WARMED",
          },
        }
      );
    }

    // 6. Autorização Concedida
    const elapsed = Date.now() - startTime;
    return NextResponse.json(
      {
        allowed: true,
        reason: "Apto para trabalho. ASO e Treinamentos Regulamentares em conformidade.",
        employeeName: accessRecord.employeeName,
        asoStatus: "VALID",
        asoDueDate: accessRecord.asoValidUntil,
        timestamp: new Date().toISOString(),
      } as AccessCheckResponse,
      {
        headers: {
          "X-Response-Time": `${elapsed}ms`,
          "X-NAI-Index-Hit": indexHit ? "HIT_O1" : "WARMED",
        },
      }
    );
  } catch (error) {
    return handleApiGuardError(error);
  }
}
