import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";
import {
  requireApiKey,
  requireScope,
  requireClient,
  handleApiGuardError,
} from "@/lib/developer-api-guard";
import { analyzeIncidentWithNormativeGrounding } from "@/services/ai/incident-investigation-engine";

/**
 * @fileOverview API v1 - Recebimento e Análise Técnica de Incidentes com RAG Normativo.
 *
 * Pipeline:
 * requireApiKey(req) -> requireScope(authKey, 'incidents:write') -> requireClient(authKey, companyId)
 *          ↓
 * RAG Grounding Engine (Extração de Fatos -> Knowledge Base Oficial -> Grounded LLM -> Parecer Técnico)
 *          ↓
 * Registro Auditável em ai_technical_decisions e Atualização no Incidente
 */
export async function POST(req: NextRequest) {
  try {
    const authKey = await requireApiKey(req);
    requireScope(authKey, "incidents:write");

    const body = await req.json();
    const { companyId, type, description, photoUrl, location, reporterId } = body;

    const targetCompanyId = companyId || authKey.clientId;
    requireClient(authKey, targetCompanyId);

    if (!type || !description) {
      return NextResponse.json(
        {
          error: "Campos obrigatórios ausentes: type e description são requeridos.",
        },
        { status: 400 }
      );
    }

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // 1. Gravação do Incidente Bruto
    const incidentData = {
      companyId: targetCompanyId,
      type,
      description,
      photoUrl: photoUrl || null,
      location: location || "Chão de Fábrica",
      reporterId: reporterId || authKey.name || "SISTEMA_API",
      status: "PROTOCOLADO",
      createdAt: new Date().toISOString(),
      serverTimestamp: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "incidents"), incidentData);
    const incidentId = docRef.id;

    // 2. Execução do Motor RAG First -> LLM Second
    const technicalOpinion = await analyzeIncidentWithNormativeGrounding(
      incidentId,
      targetCompanyId,
      description,
      { location, photoUrl }
    );

    const requiresCat = technicalOpinion.esocialImpact.requiresCatS2210;

    // 3. Atualização do Incidente com Parecer da IA, Severidade e Prazos CAT
    await updateDoc(doc(db, "incidents", incidentId), {
      status: "EM_ANALISE",
      severity: technicalOpinion.severity,
      hasLeave: technicalOpinion.extractedFacts.hasLeave,
      daysOfLeave: technicalOpinion.extractedFacts.estimatedDaysOfLeave,
      requiresCatS2210: requiresCat,
      catDeadlineIso: technicalOpinion.esocialImpact.catDeadlineIso || null,
      catDeadlineTimestamp: technicalOpinion.esocialImpact.catDeadlineTimestamp || null,
      catStatus: requiresCat ? "PENDENTE" : "NAO_APLICAVEL",
      technicalOpinion: technicalOpinion,
    });

    // 4. Gravação da Decisão Técnica na Coleção Auditável
    await addDoc(collection(db, "ai_technical_decisions"), {
      decisionType: "INCIDENT_INVESTIGATION",
      incidentId,
      companyId: targetCompanyId,
      opinion: technicalOpinion,
      immutableDigest: technicalOpinion.immutableDigest,
      status: "PENDING_ENGINEER_REVIEW",
      createdAt: new Date().toISOString(),
      serverTimestamp: serverTimestamp(),
    });

    return NextResponse.json(
      {
        success: true,
        incidentId,
        status: "ANALISADO_COM_RAG_NORMATIVO",
        technicalOpinion,
        message: "Incidente protocolado e parecer técnico auditável gerado com sucesso.",
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiGuardError(error);
  }
}
