import { config } from "dotenv";
config();

/**
 * Ponto de entrada do Genkit Developer UI.
 * Registra todos os motores de inteligência da Plataforma NAI.
 */

import "@/ai/flows/data-intelligence-agent-flow";
import "@/ai/flows/compliance-auditor-flow";
import "@/ai/flows/provider-contract-analysis-flow";
import "@/ai/flows/risk-mitigation-plan-generator";
import "@/ai/flows/ntep-contestation-generator";
import "@/ai/flows/esocial-audit-flow";
import "@/ai/flows/knowledge-assistant-flow";
import "@/ai/flows/address-resolver-flow";
import "@/ai/flows/enrich-provider-flow";
import "@/ai/flows/pgr-analysis-flow";
import "@/ai/flows/ltcat-analysis-flow";
import "@/ai/flows/pcmso-analysis-flow";
import "@/ai/flows/document-classifier-flow";
import "@/ai/flows/medical-certificate-validator-flow";
import "@/ai/flows/fiscal-intelligence-flow";
import "@/ai/flows/real-time-fiscal-flow";
import "@/ai/flows/safety-copilot-flow";
import "@/ai/flows/nai-quote-flow";
import "@/ai/flows/employee-extraction-flow";
import "@/ai/flows/extract-medical-certificate-flow";
import "@/ai/flows/suggest-exams-flow";
import "@/ai/flows/medical-assistant-flow";
import "@/ai/flows/pgr-data-architect-flow";
import "@/ai/flows/report-analysis-flow";
import "@/ai/flows/contract-analysis-flow";
