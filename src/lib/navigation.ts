export function normalizeNavigationSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** The most specific route owns the highlight, including its nested detail pages. */
export function getActiveNavigationHref(pathname: string, hrefs: string[]): string | null {
  return (
    hrefs
      .filter((href) => pathname === href || (href !== "/" && pathname.startsWith(href + "/")))
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
}

const taskTerms: Record<string, string> = {
  "/health-control": "agendar marcar reagendar exame exames periodico admissional aso atendimento",
  "/financial/notas-fiscais": "emitir gerar consultar nota fiscal nf nfs",
  "/financial/faturamento": "cobrar boleto receber pagamento faturar",
  "/esocial/messaging": "auditar validar enviar evento aso s2220 s-2220 mensageria esocial",
  "/assistente": "buscar clinica gerar kit kits assistente ia",
  "/nai-importa": "importar arquivo documento laudo pgr pcmso aso",
  "/contracts": "assinar contrato",
  "/comercial": "criar orcamento enviar proposta",
};
const stopWords = new Set([
  "a",
  "o",
  "as",
  "os",
  "de",
  "do",
  "da",
  "um",
  "uma",
  "quero",
  "preciso",
  "para",
]);
export function matchesNavigationTask(query: string, label: string, href: string) {
  const words = normalizeNavigationSearch(query)
    .split(/\s+/)
    .filter((word) => !stopWords.has(word));
  const haystack = normalizeNavigationSearch(label + " " + (taskTerms[href] || ""));
  return words.length > 0 && words.every((word) => haystack.includes(word));
}
