import "server-only";
import { request } from "node:https";
import { isIP } from "node:net";
import { isPrivateOrReservedIp } from "@/lib/webhook-security-guard";

/** Connect to a previously validated public IP while retaining the original TLS hostname.
 * HTTP redirects are returned as failures by the caller; no redirect is followed.
 * Response bodies are discarded at the headers, so error endpoints cannot exhaust memory.
 */
export function postWebhook(
  targetUrl: string,
  resolvedIps: string[],
  headers: Record<string, string>,
  body: string,
  timeoutMs: number
): Promise<{ status: number; ok: boolean }> {
  const url = new URL(targetUrl);
  const address = resolvedIps[0];
  if (url.protocol !== "https:" || !address || isPrivateOrReservedIp(address))
    return Promise.reject(new Error("Destino HTTPS público validado obrigatório."));
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: "POST",
      agent: false,
      headers,
      lookup: (_hostname, options, callback) => {
        // Never resolve DNS again between validation and the socket connection.
        if (options.all) callback(null, [{ address, family: isIP(address) }]);
        else callback(null, address, isIP(address));
      },
    });
    const timer = setTimeout(
      () => req.destroy(new Error("Timeout no envio de webhook.")),
      timeoutMs
    );
    req.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    req.once("response", (response) => {
      clearTimeout(timer);
      const status = response.statusCode || 502;
      response.destroy();
      resolve({ status, ok: status >= 200 && status < 300 });
    });
    req.end(body);
  });
}
