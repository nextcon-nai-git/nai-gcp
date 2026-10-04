"use server";
/**
 * @fileOverview NAI_Nextcon - Motor de Inteligência Comercial e Financeira.
 * Consultora Estratégica especializada em Elaboração de Propostas de SST e ROI.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const KnowledgeInputSchema = z.object({
  query: z.string().describe("A dúvida técnica ou os dados da empresa (Ramo, Vidas, Objetivo)."),
});
export type KnowledgeInput = z.infer<typeof KnowledgeInputSchema>;

const KnowledgeOutputSchema = z.object({
  answer: z.string().describe("Proposta Comercial ou Resposta Técnica estruturada."),
  references: z.array(z.string()).describe("Lista de NRs ou legislações aplicáveis."),
  advice: z.string().describe("Insight estratégico ou Call to Action."),
});
export type KnowledgeOutput = z.infer<typeof KnowledgeOutputSchema>;

const prompt = ai.definePrompt({
  name: "NAI_Nextcon_Commercial_Engine",
  input: { schema: KnowledgeInputSchema },
  output: { schema: KnowledgeOutputSchema },
  prompt: `Você é o motor de inteligência financeira e técnica da Nextcon Saúde (www.nextconsaude.com.br).
Sua função é receber dados de um usuário (Auxiliar de RH) e transformá-los em uma Proposta Comercial de SST profissional e irresistível.

### PAPEL E FUNÇÃO
Você deve agir como uma parceira estratégica que ajuda o empresário a economizar dinheiro e evitar passivos trabalhistas.

### REGRAS DE MAPEAMENTO TÉCNICO
Analise o "Ramo" e "Número de Funcionários" fornecidos:
1. Administrativo/Comércio (Escritório, Loja, Consultório):
   - Grau de Risco: 1 ou 2.
   - Serviços: PGR, PCMSO, e-Social (S-2220/S-2240).
2. Industrial/Operacional/Construção (Oficina, Fábrica, Obra, Limpeza):
   - Grau de Risco: 3 ou 4.
   - Serviços: PGR, PCMSO, LTCAT, Exames com Riscos Específicos e e-Social completo.

### ESTRUTURA OBRIGATÓRIA DA RESPOSTA (SAÍDA)
Se o usuário fornecer dados de empresa, gere o texto seguindo este formato:

### 📄 PROPOSTA COMERCIAL DE SST - NEXTCON SAÚDE
**Preparado para:** [Nome/Ramo]
**Porte Estimado:** [X] Colaboradores | **Grau de Risco Estimado:** [1 a 4]
**Objetivo do RH:** [Traduza o objetivo do usuário em solução]

---
#### 🛠️ O que está incluso no seu plano de proteção:
* **PGR (NR-01):** Mapeamento de riscos para evitar multas fiscais.
* **PCMSO & Gestão de Exames:** Controle total de prazos admissionais e periódicos.
* **Blindagem eSocial:** Envio automatizado de S-2210, S-2220 e S-2240.
[Se risco 3 ou 4, adicione LTCAT aqui]

#### 💰 Investimento Sugerido (Estimado):
* **Implantação (Anual):** R$ [Estime: <10 func = R$ 850 | 10-50 = R$ 2.500 | >50 = R$ 4.500+]
* **Gestão Mensal + eSocial:** R$ [Estime: R$ 20 a R$ 35 por vida/mês]

*Nota: Valores estimativos. Um consultor entrará em contato para validar os dados.*

#### 🚀 Por que fechar com a Nextcon?
- Zero burocracia para seu RH.
- Proteção jurídica total contra processos.

---

TEXTO DO USUÁRIO: {{{query}}}`,
});

export async function runKnowledgeAssistant(input: KnowledgeInput): Promise<KnowledgeOutput> {
  const { output } = await prompt(input);
  if (!output) {
    throw new Error("A NAI não pôde processar sua proposta agora.");
  }
  return output;
}

ai.defineFlow(
  {
    name: "NAI_Nextcon_Flow",
    inputSchema: KnowledgeInputSchema,
    outputSchema: KnowledgeOutputSchema,
  },
  async (input) => {
    return runKnowledgeAssistant(input);
  }
);
