import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// We use the project ID from env
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-8439299034-125c7";

if (!getApps().length) {
  initializeApp({
    projectId: projectId,
  });
}

const db = getFirestore();

const clients = [
  {
    name: "Alpha Tech",
    scope: "Alocação de TST (PJ) em SJP/PR, SL/MA e Natal/RN.",
    activities: "Inspeções, Atividades Críticas, EPIs/EPCs, DDS, NRs.",
    regime: "2 dias/localidade (8h/dia)",
    type: "comercial",
    status: "implementation",
    value: 15000, // Estimated value
  },
  {
    name: "Britânia / Philco (Manaus/AM)",
    scope: "Consultoria Ergonomia e Fisioterapia do Trabalho (4 CNPJs).",
    activities: "AETs, Treinamentos Posturais, Cinesio-funcionais, Luximetria.",
    type: "comercial",
    status: "approved",
    value: 25000,
  },
  {
    name: "Time Now (ArcelorMittal)",
    scope: "Documentos Técnicos SST (25 colaboradores, 6 GHEs).",
    activities: "LTCAT, AEP, LTIP (Elétrica).",
    type: "comercial",
    status: "implementation",
    value: 8500,
  },
  {
    name: "Time Now (Braskem)",
    scope: "Serviços SST Plantas PVC e UCS.",
    activities: "LTCAT, Dosimetrias, AEPs, PCA, PPR, Fit Tests.",
    type: "comercial",
    status: "implementation",
    value: 12000,
  },
  {
    name: "Lvalle",
    scope: "Serviços de TST.",
    type: "comercial",
    status: "approved",
    value: 5000,
  },
  {
    name: "Midea",
    scope: "Alocação de TST (Faturamento via NF específica).",
    type: "comercial",
    status: "approved",
    value: 7000,
  },
  {
    name: "Roofservice",
    scope: "Alocação de TST (11 dias, Seg-Sab) - Início Jan 20, 2026.",
    type: "comercial",
    status: "implementation",
    value: 4500,
  },
  {
    name: "BRDE",
    scope: "Serviços Médicos (Médico do Trabalho) - 2 profissionais.",
    type: "comercial",
    status: "approved",
    value: 18000,
  },
  {
    name: "Noxi",
    scope: "Execução de Laudos e Alocação de TST.",
    type: "comercial",
    status: "approved",
    value: 6000,
  },
  {
    name: "Nativa Empreendimentos",
    scope: "Engenharia e Treinamentos de CIPA.",
    type: "comercial",
    status: "implementation",
    value: 9000,
  },
  {
    name: "EP Teixeira (Esquina da Gulla)",
    scope: "Mensalidade recorrente e Visitas Técnicas.",
    type: "comercial",
    status: "approved",
    value: 1200,
  },
];

async function populate() {
  console.log("🚀 Iniciando migração de dados reais...");

  for (const client of clients) {
    const taskId = client.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const taskRef = db.collection("companies").doc("leads").collection("tasks").doc(taskId);

    await taskRef.set({
      id: taskId,
      title: client.name,
      companyId: "leads",
      companyName: client.name,
      type: client.type,
      status: client.status,
      priority: "high",
      dueDate: new Date(2026, 5, 1).toISOString(),
      createdAt: new Date().toISOString(),
      totalValue: client.value || 0,
      checklist: [
        { id: "1", text: client.scope, checked: true, mandatory: true },
        {
          id: "2",
          text: client.activities || "Execução do escopo acordado",
          checked: false,
          mandatory: true,
        },
      ],
      description: `${client.scope}\n\nAtividades: ${client.activities || "N/A"}\nRegime: ${client.regime || "N/A"}`,
    });

    // Also create the company record
    await db.collection("companies").doc(taskId).set({
      id: taskId,
      name: client.name,
      cnpj: "00.000.000/0001-00", // Placeholder
      risk_degree: 3,
      active: true,
      createdAt: new Date().toISOString(),
    });

    console.log(`✅ Cliente inserido: ${client.name}`);
  }

  console.log("🏁 Migração concluída com sucesso!");
}

populate().catch(console.error);
