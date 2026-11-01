/** Client delivery is deliberately opt-in. Government messaging never sends client email. */
export function asoClientEmailSendingEnabled(
  env: Record<string, string | undefined> = process.env
) {
  return env.ASO_CLIENT_EMAIL_SEND_ENABLED === "true";
}
