
import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import admin from "firebase-admin";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";

/**
 * @fileOverview Cloud Functions NAI - Motor de Inteligência Ocupacional.
 * Centraliza automações de claims e processamento neural de documentos SST.
 */

// Inicializa o admin SDK
admin.initializeApp();
const db = admin.firestore();

// Inicializa o motor Genkit 1.x
const ai = genkit({
  plugins: [googleAI()],
});

/**
 * Esquema de Saída para o Resumo do PGR.
 * Garante que a IA retorne dados estruturados para o Dashboard e Apresentações.
 */
const PgrSummarySchema = z.object({
  nivelRiscoGlobal: z.enum(['Baixo', 'Médio', 'Alto', 'Crítico']),
  recomendacoesChecklist: z.array(z.string()).describe("Lista de tarefas acionáveis para o cliente"),
  dadosInfografico: z.object({
    riscosFisicos: z.number(),
    riscosQuimicos: z.number(),
    riscosErgonomicos: z.number(),
  }),
  slidesApresentacao: z.array(z.object({
    titulo: z.string(),
    pontosChave: z.array(z.string()),
  })),
});

/**
 * Sincroniza Custom Claims do Firebase Auth baseadas no documento do usuário.
 */
export const syncUserClaims = onDocumentWritten("users/{userId}", async (event) => {
  const userId = event.params.userId;
  const snapshot = event.data.after; 
  
  if (!snapshot.exists) {
    await getAuth().setCustomUserClaims(userId, null);
    return;
  }

  const userData = snapshot.data() || {};
  const allowedRoles = new Set(['USER', 'SUPER_ADMIN', 'ADMIN', 'CLIENT_ADMIN', 'DOCTOR', 'HEALTH_PROFESSIONAL', 'PROVIDER', 'ENGINEER', 'OPERATIONS']);
  const userRole = allowedRoles.has(userData.role) ? userData.role : 'USER';
  const userCompanyId = typeof userData.companyId === 'string' && userData.companyId.trim().length > 0
    ? userData.companyId.trim()
    : null;

  const claims = {
    role: userRole,
    companyId: userCompanyId
  };

  try {
    await getAuth().setCustomUserClaims(userId, claims);
    console.log(`Claims atualizadas para ${userId}:`, claims);
  } catch (error) {
    console.error("Erro ao atualizar claims:", error);
  }
});

/**
 * Função que analisa o PGR em segundo plano assim que um novo pedido é criado.
 * Processa o PDF via Gemini 1.5 Pro e salva o resultado estruturado.
 */
export const analisarPgrEmSegundoPlano = onDocumentCreated(
  {
    document: "analisesPGR/{docId}",
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const dadosPedido = snapshot.data();
    const docId = event.params.docId;

    if (!dadosPedido.caminhoStoragePdf) {
      console.error("NAI Engine: Caminho do PDF ausente no documento.");
      return;
    }

    try {
      // Atualiza estado para processamento
      await db.collection("analisesPGR").doc(docId).update({
        estado: "A processar pela IA...",
      });

      // Download do PDF do Firebase Storage
      const bucket = admin.storage().bucket();
      const ficheiro = bucket.file(dadosPedido.caminhoStoragePdf);
      const [buffer] = await ficheiro.download();
      const base64Pdf = buffer.toString("base64");

      // Chamada neural via Genkit 1.x
      const response = await ai.generate({
        model: 'googleai/gemini-1.5-pro',
        prompt: [
          { text: "És um especialista em Segurança no Trabalho da Nextcon Saúde. Lê atentamente o documento PGR em anexo e extrai as informações solicitadas. Gera recomendações precisas para checklists, dados para os infográficos e uma estrutura de apresentação para o cliente final." },
          { media: { url: `data:application/pdf;base64,${base64Pdf}`, contentType: 'application/pdf' } }
        ],
        output: { schema: PgrSummarySchema },
        config: { temperature: 0.2 }
      });

      if (!response.output) {
        throw new Error("A IA falhou em estruturar os dados do PGR.");
      }

      // Sucesso: Persistência do resultado estruturado
      await db.collection("analisesPGR").doc(docId).update({
        estado: "Concluído",
        resultadoIA: response.output,
        dataConclusao: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`NAI Engine: PGR ${docId} analisado com sucesso.`);

    } catch (erro) {
      console.error(`Erro fatal no motor NAI (PGR ${docId}):`, erro);
      await db.collection("analisesPGR").doc(docId).update({
        estado: "Erro",
        mensagemErro: "Falha na análise neural. Verifique a integridade do PDF."
      });
    }
  }
);
