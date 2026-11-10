"use server";
import { authorizeSst, healthRoles } from "@/services/sst-analysis-access";
import { ocrIngestFlow } from "@/lib/genkit/flows/ocr-ingest";
import type { AsoDraft } from "@/lib/genkit/aso-draft";
export async function processAsoPdfAction(
  token: string,
  companyId: string,
  form: FormData
): Promise<{ success: true; data: AsoDraft } | { success: false; error: string }> {
  try {
    await authorizeSst(token, companyId, healthRoles);
  } catch {
    return { success: false, error: "Confira a sessão e a permissão clínica para esta empresa." };
  }
  const file = form.get("asoFile");
  if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024)
    return { success: false, error: "Selecione um PDF, PNG ou JPEG de até 10 MiB." };
  try {
    return { success: true, data: await ocrIngestFlow(file) };
  } catch {
    return {
      success: false,
      error:
        "Confira o formato e a legibilidade do arquivo. Se a leitura continuar indisponível, preencha o evento manualmente.",
    };
  }
}
