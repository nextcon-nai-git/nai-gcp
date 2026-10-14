/** Classify provider failures without exposing request bodies, credentials or document text. */
export function aiFailureCode(error: unknown): string {
  const value =
    error && typeof error === "object"
      ? (error as { status?: unknown; code?: unknown; message?: unknown; cause?: unknown })
      : {};
  const signal = [value.status, value.code, value.message]
    .map((x) => (typeof x === "string" || typeof x === "number" ? String(x) : ""))
    .join(" ");
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(signal)) return "QUOTA";
  if (/401|403|PERMISSION_DENIED|UNAUTHENTICATED|permission|credential/i.test(signal))
    return "AUTHORIZATION";
  if (/404|NOT_FOUND|model.*not.*found|not supported/i.test(signal)) return "MODEL";
  if (/abort|timeout|timed out|DEADLINE_EXCEEDED/i.test(signal)) return "TIMEOUT";
  if (/schema|parse|validation|INVALID_ARGUMENT|400/i.test(signal)) return "FORMAT";
  return "UNAVAILABLE";
}
export function aiFailureMessage(code: string): string {
  return (
    (
      {
        QUOTA:
          "O provedor de IA atingiu o limite de uso. Tente novamente após a liberação da cota.",
        AUTHORIZATION:
          "A identidade do serviço de IA não foi autorizada. A administração precisa revisar a configuração do provedor.",
        MODEL:
          "O modelo configurado não está disponível para este provedor. A administração precisa revisar a configuração.",
        TIMEOUT:
          "O tempo de resposta da IA foi excedido. Tente novamente ou divida o documento por unidade.",
        FORMAT:
          "O provedor não aceitou o formato da solicitação ou não retornou a estrutura esperada. A administração precisa revisar a integração.",
      } as Record<string, string>
    )[code] || "O serviço de IA não concluiu a análise. Tente novamente."
  );
}
