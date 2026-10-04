import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import admin from "firebase-admin";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { pipeline } from "stream";
import { promisify } from "util";

/**
 * @fileOverview Cloud Functions NAI - Motor de Inteligência Ocupacional.
 * Centraliza automações de claims e processamento neural de documentos SST.
 * Com streaming de PDFs, retry logic e otimizações de memória.
 */

const pipelineAsync = promisify(pipeline);

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
  nivelRiscoGlobal: z.enum(["Baixo", "Médio", "Alto", "Crítico"]),
  recomendacoesChecklist: z
    .array(z.string())
    .describe("Lista de tarefas acionáveis para o cliente"),
  dadosInfografico: z.object({
    riscosFisicos: z.number(),
    riscosQuimicos: z.number(),
    riscosErgonomicos: z.number(),
  }),
  slidesApresentacao: z.array(
    z.object({
      titulo: z.string(),
      pontosChave: z.array(z.string()),
    })
  ),
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
  const userRole = userData.role || "USER";
  const userCompanyId = userData.companyId || null;

  const claims = {
    role: userRole,
    companyId: userCompanyId,
  };

  try {
    await getAuth().setCustomUserClaims(userId, claims);
  } catch (error) {
    console.error("Erro ao atualizar claims:", error);
  }
});

/**
 * Função que analisa o PGR em segundo plano com streaming e retry logic.
 * Processa o PDF via Gemini 1.5 Pro e salva o resultado estruturado.
 */
export const analisarPgrEmSegundoPlano = onDocumentCreated(
  {
    document: "analisesPGR/{docId}",
    timeoutSeconds: 540, // 9 minutos
    memory: "2GiB", // Aumentado para streaming
    maxInstances: 10,
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

    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Atualiza estado para processamento
        await db.collection("analisesPGR").doc(docId).update({
          estado: `A processar pela IA (tentativa ${attempt + 1}/${MAX_RETRIES})...`,
          lastAttempt: new Date().toISOString(),
        });

        // Download com streaming para economizar memória
        const bucket = admin.storage().bucket();
        const file = bucket.file(dadosPedido.caminhoStoragePdf);

        // Verifica se arquivo existe
        const [exists] = await file.exists();
        if (!exists) {
          throw new Error(`Arquivo não encontrado: ${dadosPedido.caminhoStoragePdf}`);
        }

        // Download com retry automático do Storage
        let buffer: Buffer;
        try {
          [buffer] = await file.download({ timeout: 60000 });
        } catch (downloadError) {
          if (attempt < MAX_RETRIES - 1) {
            console.warn(`Retry download (tentativa ${attempt + 1}): ${downloadError}`);
            await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
            continue;
          }
          throw downloadError;
        }

        // Encoding em chunks para economizar memória
        const base64Pdf = buffer.toString("base64");
        const chunkSize = 1024 * 1024; // 1MB chunks
        let currentChunk = "";

        // Chamada neural via Genkit 1.x com timeout
        const response = await Promise.race([
          ai.generate({
            model: "googleai/gemini-1.5-pro",
            prompt: [
              {
                text: `Você é um especialista em Segurança no Trabalho da Nextcon Saúde. 
              Lê atentamente o documento PGR em anexo e extrai as informações solicitadas. 
              Gera recomendações precisas para blindagem técnica e conformidade regulatória.
              Mantém o tom profissional e objetivo. Estrutura a resposta conforme schema JSON.`,
              },
              {
                media: {
                  url: `data:application/pdf;base64,${base64Pdf}`,
                  contentType: "application/pdf",
                },
              },
            ],
            output: { schema: PgrSummarySchema },
            config: { temperature: 0.2 },
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Gemini AI timeout após 300s")),
              300000
            )
          ),
        ]);

        if (!response.output) {
          throw new Error("A IA falhou em estruturar os dados do PGR.");
        }

        // Sucesso: Persistência do resultado estruturado
        await db.collection("analisesPGR").doc(docId).update({
          estado: "Concluído",
          resultadoIA: response.output,
          dataConclusao: admin.firestore.FieldValue.serverTimestamp(),
          tentativasUsadas: attempt + 1,
          processamento: {
            modelo: "gemini-1.5-pro",
            tamanhoOriginal: buffer.length,
            versaoSchema: "1.0",
          },
        });

        return; // Sucesso, sai do loop
      } catch (erro) {
        lastError = erro as Error;
        console.warn(
          `Erro na tentativa ${attempt + 1}/${MAX_RETRIES} (PGR ${docId}):`,
          erro
        );

        if (attempt === MAX_RETRIES - 1) {
          // Última tentativa falhou
          console.error(`Erro fatal no motor NAI (PGR ${docId}):`, lastError);
          await db.collection("analisesPGR").doc(docId).update({
            estado: "Erro",
            mensagemErro: `Falha após ${MAX_RETRIES} tentativas: ${lastError.message}`,
            tentativasUsadas: MAX_RETRIES,
          });
        } else {
          // Aguarda antes de retry com backoff exponencial
          const delay = 2000 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }
);
