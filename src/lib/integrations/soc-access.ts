/** Public launch metadata only. Never accept a password or a session token in a launch URL. */
export type SocWebAccess = {
  mode: "sso" | "login" | "invalid";
  href: string | null;
};

export function socWebAccess(env: Record<string, string | undefined> = process.env): SocWebAccess {
  const launch = env.SOC_SSO_LAUNCH_URL?.trim();
  const allowedOrigin = env.SOC_SSO_ALLOWED_ORIGIN?.trim();
  if (!launch && !allowedOrigin)
    return { mode: "login", href: "https://sistema.soc.com.br/WebSoc/" };
  if (!launch || !allowedOrigin) return { mode: "invalid", href: null };
  try {
    const url = new URL(launch);
    const origin = new URL(allowedOrigin);
    if (
      url.protocol !== "https:" ||
      url.origin !== origin.origin ||
      origin.href !== `${origin.origin}/` ||
      url.username ||
      url.password ||
      url.hash ||
      /[\u0000-\u0020\\]/.test(launch) ||
      /^(localhost|127\.|0\.|\[|169\.254\.|10\.|192\.168\.)/i.test(url.hostname) ||
      [...url.searchParams.keys()].some((key) =>
        /password|passwd|senha|secret|token|chave|credential|samlrequest|samlresponse|relaystate/i.test(
          key
        )
      )
    )
      return { mode: "invalid", href: null };
    return { mode: "sso", href: url.href };
  } catch {
    return { mode: "invalid", href: null };
  }
}
