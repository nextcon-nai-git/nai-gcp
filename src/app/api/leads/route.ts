import { NextResponse } from "next/server";
import { initializeFirebase } from "@/firebase/init";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * @fileOverview API Pública para Captura de Leads (Site -> Kanban).
 * Recebe dados do formulário de contato do site institucional e cria um card no Funil de Vendas.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, empresa, email, telefone, interesse } = body;

    // 1. Validação básica de entrada
    if (!nome || !email || !empresa) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Nome, Email e Empresa são campos obrigatórios." },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    const { firestore } = initializeFirebase();

    // 2. Prepara o objeto do Card (seguindo o schema OpsTask do sistema)
    const novoLead = {
      title: `Orçamento Site: ${empresa.toUpperCase()}`,
      companyId: "leads", // Agrupador padrão para novos contatos do site
      companyName: empresa,
      type: "comercial",
      status: "to_review", // Primeira coluna do Funil Comercial
      priority: "medium",
      createdAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // Deadline de 3 dias para contato
      ai_risk_score: 50,
      metadata: {
        contato_nome: nome,
        email: email,
        telefone: telefone || "Não informado",
        interesse: interesse || "Geral",
        origem: "Site Institucional",
      },
      checklist: [
        {
          id: "1",
          text: "Realizar primeiro contato (Qualificação)",
          checked: false,
          mandatory: true,
        },
        { id: "2", text: "Agendar demonstração da NAI", checked: false, mandatory: false },
        { id: "3", text: "Solicitar dados para proposta formal", checked: false, mandatory: true },
      ],
    };

    // 3. Salva no Firestore (Coleção de tarefas da unidade "leads")
    const tasksRef = collection(firestore, "companies", "leads", "tasks");
    const docRef = await addDoc(tasksRef, novoLead);

    return NextResponse.json(
      {
        sucesso: true,
        mensagem: "Lead capturado com sucesso! O card foi criado no Funil de Vendas.",
        lead_id: docRef.id,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error) {
    console.error("Erro na captura de lead via API:", error);
    return NextResponse.json(
      { sucesso: false, mensagem: "Erro interno no processamento do lead." },
      { status: 500 }
    );
  }
}

// Handler para pre-flight requests do CORS (Necessário para requisições cross-domain do site)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
