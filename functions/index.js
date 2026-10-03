
import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import admin from "firebase-admin";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";

const PDF_DOWNLOAD_TIMEOUT_MS = 60_000;
const AI_REQUEST_TIMEOUT_MS = 120_000;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isTransientError(error) {
  const status = error?.status ?? error?.statusCode;
  return (
    ["ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "UNAVAILABLE"].includes(error?.code) ||
    status === 429 ||
    status >= 500 ||
    /timeout|temporar|network|fetch failed|unavailable|connection reset/i.test(error?.message || "")
  );
}

async function retryTransient(operation, attempts = 3) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation(attempt + 1);
    } catch (error) {
      if (attempt + 1 >= attempts || !isTransientError(error)) throw error;
      await wait(250 * 2 ** attempt);
    }
  }
}

async function withTimeout(operation, timeoutMs, message) {
  let timeout;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          const error = new Error(message);
          error.code = "ETIMEDOUT";
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function streamPdfAsBase64(file) {
  const stream = file.createReadStream();
  let timeout;
  let base64 = "";
  let remainder = Buffer.alloc(0);
  let bytesRead = 0;

  try {
    timeout = setTimeout(() => {
      const error = new Error("PDF download timed out");
      error.code = "ETIMEDOUT";
      stream.destroy(error);
    }, PDF_DOWNLOAD_TIMEOUT_MS);

    for await (const chunk of stream) {
      const data = remainder.length ? Buffer.concat([remainder, chunk]) : chunk;
      bytesRead += chunk.length;
      const encodableLength = data.length - (data.length % 3);
      if (encodableLength > 0) {
        base64 += data.subarray(0, encodableLength).toString("base64");
      }
      remainder = Buffer.from(data.subarray(encodableLength));
    }

    if (remainder.length > 0) base64 += remainder.toString("base64");
    return { base64, bytesRead };
  } finally {
    clearTimeout(timeout);
  }
}

function logProcessingMetrics(docId, startedAt, pdfBytes, status) {
  const memory = process.memoryUsage();
  console.info(
    JSON.stringify({
      severity: "INFO",
      message: "PGR processing metrics",
      documentId: docId,
      status,
      durationMs: Date.now() - startedAt,
      pdfBytes,
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
    })
  );
}

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

  const userData = snapshot.data();
  const userRole = userData.role || 'USER'; 
  const userCompanyId = userData.companyId || null;

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
    const startedAt = Date.now();
    let pdfBytes = 0;
    let processingStatus = "error";

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
      const pdf = await retryTransient(() =>
        withTimeout(
          streamPdfAsBase64(ficheiro),
          PDF_DOWNLOAD_TIMEOUT_MS + 1_000,
          "PDF download timed out"
        )
      );
      pdfBytes = pdf.bytesRead;

      // Chamada neural via Genkit 1.x
      const response = await retryTransient(() =>
        withTimeout(
          ai.generate({
            model: "googleai/gemini-1.5-pro",
            prompt: [
              {
                text: "És um especialista em Segurança no Trabalho da Nextcon Saúde. Lê atentamente o documento PGR em anexo e extrai as informações solicitadas. Gera recomendações precisas para checklists, dados para os infográficos e uma estrutura de apresentação para o cliente final.",
              },
              {
                media: {
                  url: `data:application/pdf;base64,${pdf.base64}`,
                  contentType: "application/pdf",
                },
              },
            ],
            output: { schema: PgrSummarySchema },
            config: { temperature: 0.2 },
          }),
          AI_REQUEST_TIMEOUT_MS,
          "AI analysis timed out"
        )
      );

      if (!response.output) {
        throw new Error("A IA falhou em estruturar os dados do PGR.");
      }

      // Sucesso: Persistência do resultado estruturado
      await db.collection("analisesPGR").doc(docId).update({
        estado: "Concluído",
        resultadoIA: response.output,
        dataConclusao: admin.firestore.FieldValue.serverTimestamp(),
      });

      processingStatus = "success";
      console.log(`NAI Engine: PGR ${docId} analisado com sucesso.`);

    } catch (erro) {
      console.error(`Erro fatal no motor NAI (PGR ${docId}):`, erro);
      await db.collection("analisesPGR").doc(docId).update({
        estado: "Erro",
        mensagemErro: "Falha na análise neural. Verifique a integridade do PDF."
      });
    } finally {
      logProcessingMetrics(docId, startedAt, pdfBytes, processingStatus);
    }
  }
);
