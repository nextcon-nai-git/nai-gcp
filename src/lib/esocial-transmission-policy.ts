/** Explicit operator switch. Missing or malformed configuration always blocks transmission. */
export function isEsocialTransmissionEnabled(
  value = process.env.ESOCIAL_TRANSMISSION_ENABLED
): boolean {
  return value === "true";
}

export const ESOCIAL_TRANSMISSION_DISABLED_MESSAGE =
  "Transmissões ao eSocial estão desativadas durante a validação. A instalação do A1 não habilita envios; é necessária liberação explícita da operação.";
