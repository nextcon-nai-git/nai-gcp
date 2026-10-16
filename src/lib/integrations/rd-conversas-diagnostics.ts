import type { RdWebhookDiagnostic } from "./rd-conversas-webhook";

export type RdWebhookObservation = Omit<RdWebhookDiagnostic, "fields"> & {
  receivedAt: string;
  fields: string[];
};

/** One replaceable record per outcome; no message, phone, ID or header values. */
export function createRdWebhookDiagnostics(options: {
  until: () => string | undefined;
  write: (observation: RdWebhookObservation) => Promise<void>;
  now?: () => number;
}) {
  const last = new Map<string, number>();
  return async ({ code, status, fields }: RdWebhookDiagnostic) => {
    const now = (options.now || Date.now)();
    const previous = last.get(code);
    if (previous !== undefined && now - previous < 60000) return;
    last.set(code, now);
    const until = Date.parse(options.until() || "");
    const captureShape = until > now && until - now <= 86400000;
    await options.write({
      code,
      status,
      receivedAt: new Date(now).toISOString(),
      fields: captureShape ? fields : [],
    });
  };
}
