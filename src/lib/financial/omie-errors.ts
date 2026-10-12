import { AuthError } from "@/lib/auth/errors";

type FailureKind =
  | "ACCESS"
  | "RATE_LIMIT"
  | "BLOCKED"
  | "TIMEOUT"
  | "NETWORK"
  | "RESPONSE"
  | "REQUEST"
  | "UNAVAILABLE";
const messages: Record<FailureKind, string> = {
  ACCESS:
    "O Omie recusou o acesso a esta consulta. Confira no Omie as permissões do aplicativo NEXTCON para este recurso.",
  RATE_LIMIT:
    "O Omie limitou temporariamente as consultas. Aguarde pelo menos 60 segundos antes de consultar novamente; repetir agora pode prolongar o bloqueio.",
  BLOCKED:
    "O Omie bloqueou temporariamente este recurso por excesso de consultas. Aguarde 30 minutos antes de tentar novamente.",
  TIMEOUT:
    "O Omie demorou além do limite para responder. Tente novamente mais tarde; na DRE, consulte um período menor.",
  NETWORK: "Não foi possível estabelecer comunicação com o Omie. Tente novamente mais tarde.",
  RESPONSE:
    "O Omie retornou uma resposta que não pôde ser validada. Nenhum resultado financeiro foi calculado a partir dela.",
  REQUEST:
    "O Omie recusou esta consulta. A integração precisa conferir o recurso e os parâmetros solicitados.",
  UNAVAILABLE: "O serviço do Omie está temporariamente indisponível. Tente novamente mais tarde.",
};

/** Only fixed categories, HTTP status and strictly allowlisted fault codes leave the server. */
export class OmieUpstreamError extends AuthError {
  readonly code: string;
  readonly retryAfter?: number;
  constructor(kind: FailureKind, httpStatus?: number, faultCode?: string) {
    const code = `OMIE_${kind}`;
    const reference = [code, httpStatus && `HTTP ${httpStatus}`, faultCode]
      .filter(Boolean)
      .join(" · ");
    super(
      `${messages[kind]} Referência: ${reference}.`,
      kind === "TIMEOUT"
        ? 504
        : kind === "RATE_LIMIT" || kind === "BLOCKED"
          ? 429
          : kind === "NETWORK" || kind === "UNAVAILABLE"
            ? 503
            : 502
    );
    this.code = code;
    this.retryAfter = kind === "BLOCKED" ? 1800 : kind === "RATE_LIMIT" ? 60 : undefined;
  }
}

export function omieResponseError(status: number, data?: unknown): OmieUpstreamError {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const fault =
    typeof record.faultstring === "string"
      ? record.faultstring
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
      : "";
  const faultCode =
    typeof record.faultcode === "string" &&
    /^SOAP-ENV:(?:Client|Server)(?:-\d{1,8})?$/.test(record.faultcode)
      ? record.faultcode
      : undefined;
  if (status === 425) return new OmieUpstreamError("BLOCKED", status, faultCode);
  if (
    status === 429 ||
    /too many requests|rate limit|consumo indevido|limite de (?:consumo|requisicoes)|requisicao (?:duplicada|redundante)|ja (?:foi )?(?:realizada|processada)|aguarde.*(?:segundos|minutos)/.test(
      fault
    )
  )
    return new OmieUpstreamError("RATE_LIMIT", status, faultCode);
  if (
    status === 401 ||
    status === 403 ||
    /nao autorizad|unauthorized|acesso negado|sem permissao|nao (?:tem|possui) acesso|(?:app[_ ]?(?:key|secret)|chave|credencia(?:l|is)).{0,50}(?:invalid|incorret|nao encontrad)|(?:invalid|incorret).{0,30}(?:app[_ ]?(?:key|secret)|chave|credencia)/.test(
      fault
    )
  )
    return new OmieUpstreamError("ACCESS", status, faultCode);
  if (record.faultstring || record.faultcode || status === 400 || status === 404 || status === 422)
    return new OmieUpstreamError("REQUEST", status, faultCode);
  return new OmieUpstreamError(status >= 500 ? "UNAVAILABLE" : "RESPONSE", status, faultCode);
}

export function omieTransportError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    ["AbortError", "TimeoutError"].includes(String(error.name))
  )
    return new OmieUpstreamError("TIMEOUT");
  if (error instanceof SyntaxError) return new OmieUpstreamError("RESPONSE");
  return new OmieUpstreamError("NETWORK");
}
