"use server";

/**
 * @fileOverview NAI Antigravity ETL Engine Server Action v3.1.
 * Processa a consolidação das 10 abas da planilha Mestre (Controle Kelly T),
 * realiza o auto-cadastro de clientes, rede credenciada, exames e matriz 5W2H no Firestore.
 */

import { initializeFirebase } from "@/firebase/init";
import { doc, setDoc, collection, addDoc, writeBatch, serverTimestamp } from "firebase/firestore";

export interface EtlIngestionResult {
  success: boolean;
  totalClients: number;
  totalCredenciados: number;
  totalActionPlans: number;
  totalUnmappedAuto: number;
  message: string;
}

export async function ingestMasterDatabaseJson(masterPayload: any): Promise<EtlIngestionResult> {
  try {
    const { firestore } = initializeFirebase();
    if (!firestore) {
      throw new Error("Firestore não inicializado.");
    }

    const { clientes, rede_credenciada, planos_acao_5w2h } = masterPayload || {};

    let totalClients = 0;
    let totalCredenciados = 0;
    let totalActionPlans = 0;

    // 1. Ingestão de Clientes e Colaboradores no Firestore
    if (clientes && Array.isArray(clientes)) {
      for (const cli of clientes) {
        const companyId = cli.activeClientId || `emp_${Date.now()}`;
        const companyRef = doc(firestore, "companies", companyId);

        await setDoc(
          companyRef,
          {
            id: companyId,
            name: cli.nome_empresa || "CLIENTE NAI",
            cnpj: cli.cnpj || "",
            status_cadastro: cli.status_cadastro || "CADASTRADO_AUTOMATICO",
            renovacao_nxc: cli.renovacao_nxc || {},
            programas_sst: cli.programas_sst || [],
            contatos: cli.contatos || [],
            enderecos: cli.enderecos || [],
            unidades_atendidas: cli.unidades_atendidas || [],
            crm_leads: cli.crm_leads || [],
            updatedAt: new Date().toISOString(),
            createdAt: cli.created_at || new Date().toISOString(),
          },
          { merge: true }
        );

        // Cadastra Colaboradores e Exames
        if (cli.colaboradores && Array.isArray(cli.colaboradores)) {
          for (const emp of cli.colaboradores) {
            if (!emp.nome) continue;
            const empRef = doc(collection(firestore, "companies", companyId, "employees"));
            await setDoc(
              empRef,
              {
                name: emp.nome,
                job_role: { title: emp.funcao || "Colaborador" },
                admissionDate: emp.data_admissao || "",
                exames_historico: emp.exames || [],
                companyId,
                status: "active",
                createdAt: new Date().toISOString(),
              },
              { merge: true }
            );
          }
        }
        totalClients++;
      }
    }

    // 2. Ingestão da Rede Credenciada
    if (rede_credenciada && Array.isArray(rede_credenciada)) {
      for (const cred of rede_credenciada) {
        const customId = cred.credenciadoId || `CRE-${Date.now()}`;
        const providerRef = doc(firestore, "providers", customId);

        await setDoc(
          providerRef,
          {
            id: customId,
            name: cred.nome_clinica,
            unidades_atendidas: cred.unidades_atendidas || [],
            active: true,
            rating: 5,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        totalCredenciados++;
      }
    }

    // 3. Ingestão da Matriz de Ação 5W2H (Página 14)
    if (planos_acao_5w2h && Array.isArray(planos_acao_5w2h)) {
      for (const act of planos_acao_5w2h) {
        const taskRef = doc(collection(firestore, "global_tasks"));
        await setDoc(
          taskRef,
          {
            taskId: act.taskId,
            title: act.o_que,
            why: act.porque,
            how: act.como,
            dueDate: act.quando,
            where: act.onde,
            responsible: act.quem,
            status: act.status || "todo",
            fup: act.fup,
            type: "5w2h_estrategico",
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );

        totalActionPlans++;
      }
    }

    return {
      success: true,
      totalClients,
      totalCredenciados,
      totalActionPlans,
      totalUnmappedAuto: masterPayload?.novos_cadastros_auto?.length || 0,
      message: `Motor SGI v3.1 concluído: ${totalClients} Clientes, ${totalCredenciados} Credenciados e ${totalActionPlans} Tarefas 5W2H sincronizados.`,
    };
  } catch (error: any) {
    return {
      success: false,
      totalClients: 0,
      totalCredenciados: 0,
      totalActionPlans: 0,
      totalUnmappedAuto: 0,
      message: `Erro na ingestão do Motor SGI: ${error.message}`,
    };
  }
}
