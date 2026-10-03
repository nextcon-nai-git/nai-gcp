import { config } from "dotenv";
config();

/**
 * Ponto de entrada do Genkit Developer UI.
 * Registra todos os motores de inteligência da Plataforma NAI.
 */

import "@/ai/flows/generate-soap-summary-flow.ts";
import "@/ai/flows/risk-mitigation-plan-generator.ts";
import "@/ai/flows/ntep-contestation-generator.ts";
import "@/ai/flows/esocial-audit-flow.ts";
import "@/ai/flows/knowledge-assistant-flow.ts";
import "@/ai/flows/address-resolver-flow.ts";
import "@/ai/flows/enrich-provider-flow.ts";
import "@/ai/flows/pgr-analysis-flow.ts";
import "@/ai/flows/ltcat-analysis-flow.ts";
import "@/ai/flows/pcmso-analysis-flow.ts";
import "@/ai/flows/document-classifier-flow.ts";
import "@/ai/flows/medical-certificate-validator-flow.ts";
import "@/ai/flows/fiscal-intelligence-flow.ts";
import "@/ai/flows/storage-manager-flow.ts";
import "@/ai/flows/safety-copilot-flow.ts";
import "@/ai/flows/nai-quote-flow.ts";
import "@/ai/flows/hello-flow.ts";
import "@/ai/flows/employee-extraction-flow.ts";
import "@/ai/flows/extract-medical-certificate-flow.ts";
import "@/ai/flows/suggest-exams-flow.ts";
import "@/ai/flows/medical-assistant-flow.ts";
import "@/ai/flows/pgr-data-architect-flow.ts";
import "@/ai/flows/voice-response-flow.ts";
import "@/ai/flows/report-analysis-flow.ts";
