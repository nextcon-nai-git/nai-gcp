"use server";

/**
 * @fileOverview Server Action para identificação e remoção automática de clientes duplicados no Firestore.
 * Preserva a versão mais completa (com maior número de vidas/colaboradores e subcoleções).
 */

import { firebaseConfig } from "@/firebase/config";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc } from "firebase/firestore";

export interface DeduplicationSummary {
  grupoName: string;
  keptCompanyId: string;
  keptCompanyName: string;
  keptVidasCount: number;
  deletedCompanies: { id: string; name: string; vidasCount: number }[];
}

export interface DeduplicateResult {
  sucesso: boolean;
  mensagem: string;
  detalhes: DeduplicationSummary[];
}

export async function deduplicateClientsAction(): Promise<DeduplicateResult> {
  const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const firestore = getFirestore(firebaseApp);

  try {
    const companiesSnap = await getDocs(collection(firestore, "companies"));
    if (companiesSnap.empty) {
      return {
        sucesso: true,
        mensagem: "Nenhuma empresa encontrada no banco de dados.",
        detalhes: [],
      };
    }

    // 1. Mapear todas as empresas com suas métricas de subcoleções
    const companiesData: {
      id: string;
      name: string;
      normalizedName: string;
      employeesCount: number;
      tasksCount: number;
      reportsCount: number;
      risksCount: number;
      totalScore: number;
      raw: any;
    }[] = [];

    for (const docSnap of companiesSnap.docs) {
      const id = docSnap.id;
      const data = docSnap.data();
      const rawName = data.name || data.razaoSocial || "SEM_NOME";

      // Normalizar nome para agrupamento (ex: "CASSI - SP" -> "cassi", "CETESB S/A" -> "cetesb")
      let norm = rawName.toLowerCase().trim();
      if (norm.includes("cassi")) norm = "cassi";
      else if (norm.includes("cetesb")) norm = "cetesb";
      else norm = norm.replace(/[^a-z0-9]/g, "");

      // Buscar contagem de subcoleções
      const empSnap = await getDocs(collection(firestore, "companies", id, "employees"));
      const taskSnap = await getDocs(collection(firestore, "companies", id, "tasks"));
      const repSnap = await getDocs(collection(firestore, "companies", id, "reports"));
      const riskSnap = await getDocs(collection(firestore, "companies", id, "pgr_risks"));

      const employeesCount = empSnap.size;
      const tasksCount = taskSnap.size;
      const reportsCount = repSnap.size;
      const risksCount = riskSnap.size;

      // Score ponderado para definir qual cadastro é o mais completo
      const totalScore = employeesCount * 10 + reportsCount * 5 + tasksCount * 2 + risksCount;

      companiesData.push({
        id,
        name: rawName,
        normalizedName: norm,
        employeesCount,
        tasksCount,
        reportsCount,
        risksCount,
        totalScore,
        raw: data,
      });
    }

    // 2. Agrupar por nome normalizado
    const groups: Record<string, typeof companiesData> = {};
    for (const item of companiesData) {
      if (!groups[item.normalizedName]) {
        groups[item.normalizedName] = [];
      }
      groups[item.normalizedName].push(item);
    }

    const deduplicationReport: DeduplicationSummary[] = [];

    // 3. Processar grupos com duplicatas
    for (const [normName, items] of Object.entries(groups)) {
      if (items.length > 1) {
        // Ordenar descrescente pelo score (o primeiro é o mais completo)
        items.sort((a, b) => b.totalScore - a.totalScore);

        const bestVersion = items[0];
        const duplicates = items.slice(1);

        const deletedList: { id: string; name: string; vidasCount: number }[] = [];

        for (const dup of duplicates) {
          // Deletar o documento da empresa duplicada incompleta
          await deleteDoc(doc(firestore, "companies", dup.id));
          deletedList.push({
            id: dup.id,
            name: dup.name,
            vidasCount: dup.employeesCount,
          });
        }

        deduplicationReport.push({
          grupoName: bestVersion.name,
          keptCompanyId: bestVersion.id,
          keptCompanyName: bestVersion.name,
          keptVidasCount: bestVersion.employeesCount,
          deletedCompanies: deletedList,
        });
      }
    }

    return {
      sucesso: true,
      mensagem:
        deduplicationReport.length > 0
          ? `Deduplicação realizada com sucesso. ${deduplicationReport.length} grupo(s) unificados.`
          : "Nenhuma duplicata encontrada no cadastro de clientes.",
      detalhes: deduplicationReport,
    };
  } catch (error: any) {
    console.error("Erro ao deduplicar clientes:", error);
    return {
      sucesso: false,
      mensagem: error.message || "Erro durante o processo de desduplicação.",
      detalhes: [],
    };
  }
}
