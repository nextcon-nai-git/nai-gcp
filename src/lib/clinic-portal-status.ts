export function formatClinicPortalStatus(
  result: {
    state?: string;
    documentReceived?: boolean;
    revoked?: boolean;
    expiresAt?: string;
  },
  now = Date.now()
) {
  const expiry = new Date(result.expiresAt || "");
  const validExpiry = Number.isFinite(expiry.getTime());
  const expired = validExpiry && expiry.getTime() <= now;
  const states: Record<string, string> = {
    invited: "Convite criado",
    confirmed: "Recebimento confirmado",
    draft: "Em preenchimento",
    awaiting_signature: "Aguardando assinatura",
  };
  const record = result.documentReceived
    ? "ASO recebido para conferência"
    : states[result.state || ""] || "Situação não reconhecida";
  const access = result.revoked
    ? "acesso revogado"
    : !validExpiry
      ? "validade indisponível"
      : expired
        ? "acesso expirado"
        : "acesso vigente";
  return `${record} · ${access}${validExpiry ? ` · validade: ${expiry.toLocaleDateString("pt-BR")}` : ""}`;
}
