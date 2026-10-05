import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview API de Classificação e Destinação de Documentos NAI IA (Multimodal Real).
 * Processa a imagem/PDF via Base64 diretamente no Gemini 1.5/2.5 Flash,
 * lendo o texto completo do arquivo para extrair dados 100% fiéis ao documento.
 */

export async function POST(req: import("next/server").NextRequest) {
  try {
    await requireAuth(req);
    const body = await req.json();
    const { fileName, fileType, fileBase64, textContent, activeClientName } = body;

    if (!fileName) {
      return NextResponse.json({ error: "Nome do arquivo é obrigatório." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || "";

    let geminiResponse: any = null;

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Utiliza o modelo Gemini 3.8 Flash multimodal otimizado para leitura de laudos, PDFs e Imagens
        const modelName = process.env.GEMINI_FLASH_MODEL || "gemini-3.8-flash";
        const model = genAI.getGenerativeModel({ model: modelName });

        const promptText = `
Você é o motor de visão e inteligência artificial da plataforma NAI (NextCon SST & Medicina Ocupacional).
Sua missão é LER O DOCUMENTO EM ANEXO (PDF ou imagem) com extrema precisão visual e extrair os dados reais contidos nas páginas do documento.

NOME DO ARQUIVO: "${fileName}"
EMPRESA ATIVA NA SESSÃO DE CONTEXTO: "${activeClientName || ""}"

INSTRUÇÕES DE LEITURA E EXTRAÇÃO DENTRO DO ARQUIVO:
1. NOME DA EMPRESA / CLIENTE (companyName):
   - Leia a Razão Social ou Nome Fantasia que aparece no cabeçalho ou no corpo do documento.
   - Não invente nomes genericos como "Empresa Identificada". Se o documento for de um cliente específico (ex: "Construfam", "Essencial", "Cetesb", "Cassi", "Aneel", "Montec", "Nativa", "Noxi", "Britânia", "Nextcon", etc.), retorne a Razão Social EXATA que está impressa no arquivo.
2. PRESTADOR / MÉDICO / CLÍNICA (providerName):
   - Procure por clínicas ocupacionais, médicos do trabalho (com CRM), enfermeiros (COREN) ou engenheiros de segurança (CREA) que assinam ou emitiram o documento (use apenas os dados presentes no documento, sem inventar pessoas).
3. COLABORADOR / TRABALHADOR (employeeName):
   - Se for um ASO, Ficha de Registro, Atestado ou Prontuário, extraia o NOME COMPLETO do colaborador/funcionário e CPF se houver.
4. TÍTULO DO DOCUMENTO (title):
   - Dê um título limpo, profissional e em maiúsculas sem caracteres de cópia (ex: "ASO ADMISSIONAL - ISABELLE CRISTINE SIQUEIRA", "PROGRAMA DE GERENCIAMENTO DE RISCOS - CONSTRUFAM ENGENHARIA", "EXTRATO BANCÁRIO SANTANDER").
5. CATEGORIZAÇÃO E DESTINAÇÃO:
   - "HEALTH_ASO" -> route: "/health-control", label: "Prontuários & ASOs (Saúde Ocupacional)" (ASOs, exames ocupacionais)
   - "RISK_PGR" -> route: "/documents", label: "Documentos & Laudos SST" (PGR, laudos ambientais, inventário de riscos)
   - "HEALTH_PCMSO" -> route: "/documents", label: "Documentos & Laudos SST" (PCMSO)
   - "SAFETY_LTCAT" -> route: "/documents", label: "Documentos & Laudos SST" (LTCAT, insalubridade, ergo)
   - "FINANCIAL_STATEMENT" -> route: "/financial", label: "Extrato & Conciliação Financeira" (extratos, comprovantes, pix)
   - "EMPLOYEE_RECORD" -> route: "/employees", label: "Quadro de Vidas & Colaboradores" (ficha de registro, dados de admissão)
   - "SICK_LEAVE" -> route: "/health-control", label: "Gestão de Saúde & Absenteísmo" (atestados, afastamentos)
   - "CONTRACT" -> route: "/providers", label: "Rede de Prestadores & Credenciamento" (contratos, termos PJ)
6. RESUMO TÉCNICO (summary):
   - Escreva um resumo técnico profissional de 1 a 2 frases descrevendo exatamente do que se trata o documento analisado.

RETORNE APENAS O JSON NO SEGUINTE FORMATO (SEM BLOCO DE CÓDIGO MARKDOWN E SEM TEXTO ADICIONAL):
{
  "category": "string",
  "title": "string",
  "companyName": "string",
  "companyCnpj": "string ou null",
  "employeeName": "string ou null",
  "employeeCpf": "string ou null",
  "providerName": "string ou null",
  "providerCnpjOrCrm": "string ou null",
  "documentDate": "YYYY-MM-DD ou null",
  "amount": null,
  "summary": "string",
  "destinationRoute": "string",
  "destinationLabel": "string",
  "confidence": 99
}
`;

        const contentsParts: any[] = [promptText];

        // Se houver arquivo Base64, anexa como dados multimodais para o Gemini LER O ARQUIVO!
        if (fileBase64 && typeof fileBase64 === "string") {
          const base64Data = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
          let mime = fileType || "application/pdf";
          if (fileBase64.startsWith("data:")) {
            const header = fileBase64.split(";")[0];
            mime = header.replace("data:", "") || mime;
          }

          if (base64Data) {
            contentsParts.push({
              inlineData: {
                data: base64Data,
                mimeType: mime,
              },
            });
          }
        }

        const response = await model.generateContent(contentsParts);
        const rawText = response.response.text() || "";
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          geminiResponse = JSON.parse(jsonMatch[0]);
        }
      } catch (err: any) {
        if (err instanceof AuthError) return handleAuthError(err);
        console.warn("AI Classifier Gemini Direct API Error:", err?.message || err);
      }
    }

    // FALLBACK HEURÍSTICO CASO O GEMINI NÂO RETORNE OU A API KEY NÂO ESTEJA DEFINIDA
    if (!geminiResponse) {
      const fnLower = fileName.toLowerCase();
      let cat = "GENERAL_DOC";
      let route = "/documents";
      let label = "Documentos & Laudos SST";
      const title = fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]/g, " ")
        .replace(/\(\d+\)/g, "")
        .trim()
        .toUpperCase();
      let summary =
        "Documento técnico submetido para validação e arquivamento digital na plataforma NAI.";

      let company = activeClientName || "CONSTRUFAM ENGENHARIA E CONSTRUÇÕES LTDA";
      if (fnLower.includes("cetesb")) company = "CETESB - COMPANHIA AMBIENTAL DO ESTADO DE S.P.";
      else if (fnLower.includes("essencial") || fnLower.includes("cei"))
        company = "CENTRO DE EDUCAÇÃO INFANTIL ESSENCIAL LTDA";
      else if (fnLower.includes("cassi"))
        company = "CASSI - CAIXA DE ASSISTÊNCIA DOS FUNCIONÁRIOS DO BB";
      else if (fnLower.includes("aneel")) company = "ANEEL - AGÊNCIA NACIONAL DE ENERGIA ELÉTRICA";
      else if (fnLower.includes("cocel")) company = "COCEL - COMPANHIA CAMPOLARGUENSE DE ENERGIA";
      else if (fnLower.includes("montec")) company = "DW MONTEC LTDA - ME";
      else if (fnLower.includes("britania")) company = "BRITÂNIA ELETRODOMÉSTICOS S.A.";
      else if (fnLower.includes("nextcon"))
        company = "NEXTCON SOLUÇÕES EM SST & MEDICINA OCUPACIONAL";

      const empName = null;
      const provName = null;

      if (
        fnLower.includes("aso") ||
        fnLower.includes("exame") ||
        fnLower.includes("admissional") ||
        fnLower.includes("periodico") ||
        fnLower.includes("demissional")
      ) {
        cat = "HEALTH_ASO";
        route = "/health-control";
        label = "Prontuários & ASOs (Saúde Ocupacional)";
        summary =
          "Atestado de Saúde Ocupacional referente a exames clínicos e exames complementares da NR-07.";
      } else if (
        fnLower.includes("pgr") ||
        fnLower.includes("inventario") ||
        fnLower.includes("riscos")
      ) {
        cat = "RISK_PGR";
        route = "/documents";
        label = "Documentos & Laudos SST";
        summary =
          "Programa de Gerenciamento de Riscos (NR-01) contendo inventário de riscos ocupacionais, plano de ação e matriz de controle.";
      } else if (fnLower.includes("pcmso")) {
        cat = "HEALTH_PCMSO";
        route = "/documents";
        label = "Documentos & Laudos SST";
        summary =
          "Programa de Controle Médico de Saúde Ocupacional (NR-07) para monitoramento epidemiológico dos colaboradores.";
      } else if (
        fnLower.includes("ltcat") ||
        fnLower.includes("insalubridade") ||
        fnLower.includes("periculosidade") ||
        fnLower.includes("ergo")
      ) {
        cat = "SAFETY_LTCAT";
        route = "/documents";
        label = "Documentos & Laudos SST";
        summary =
          "Laudo Técnico das Condições Ambientais de Trabalho para comprovação de agentes nocivos e eSocial S-2240.";
      } else if (
        fnLower.includes("extrato") ||
        fnLower.includes("santander") ||
        fnLower.includes("comprovante") ||
        fnLower.includes("pix") ||
        fnLower.includes("financeiro")
      ) {
        cat = "FINANCIAL_STATEMENT";
        route = "/financial";
        label = "Extrato & Conciliação Financeira";
        summary =
          "Comprovante ou extrato bancário para conciliação financeira de repasses, consultas e honorários.";
      } else if (
        fnLower.includes("ficha") ||
        fnLower.includes("registro") ||
        fnLower.includes("admissao")
      ) {
        cat = "EMPLOYEE_RECORD";
        route = "/employees";
        label = "Quadro de Vidas & Colaboradores";
        summary =
          "Ficha de registro cadastral do colaborador para vínculo empregatício, prontuário e evento eSocial S-2200.";
      } else if (
        fnLower.includes("atestado") ||
        fnLower.includes("licenca") ||
        fnLower.includes("medica")
      ) {
        cat = "SICK_LEAVE";
        route = "/health-control";
        label = "Gestão de Saúde & Absenteísmo";
        summary =
          "Atestado de afastamento médico para controle de CID, absenteísmo e evento eSocial S-2230.";
      } else if (
        fnLower.includes("contrato") ||
        fnLower.includes("credenciamento") ||
        fnLower.includes("prestador") ||
        fnLower.includes("termo")
      ) {
        cat = "CONTRACT";
        route = "/providers";
        label = "Rede de Prestadores & Credenciamento";
        summary =
          "Instrumento contratual ou credenciamento de clínica/especialista para prestação de serviços ocupacionais.";
      }

      geminiResponse = {
        category: cat,
        title: title,
        companyName: company,
        companyCnpj: null,
        employeeName: empName,
        employeeCpf: null,
        providerName: provName,
        providerCnpjOrCrm: null,
        documentDate: new Date().toISOString().split("T")[0],
        confidence: 35, // Confiança rebaixada por ser fallback heurístico sem visão real
        classificationMethod: "HEURISTIC_FILENAME_FALLBACK",
      };
    } else {
      geminiResponse.classificationMethod = "GEMINI_MULTIMODAL_VISION";
      geminiResponse.confidence = geminiResponse.confidence || 95;
    }

    return NextResponse.json({ success: true, result: geminiResponse });
  } catch (error: any) {
    if (error instanceof AuthError) return handleAuthError(error);
    console.error("AI Document Classifier Exception:", error);
    return NextResponse.json(
      { error: error.message || "Erro no processamento do documento." },
      { status: 500 }
    );
  }
}
