type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

export type LogContext = Record<string, unknown>;

const secretKeys = new Set([
  "password",
  "senha",
  "authorization",
  "cookie",
  "setcookie",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "apikey",
  "privatekey",
  "clientsecret",
  "secret",
]);

function serialize(entry: LogContext): string {
  const ancestors: object[] = [];
  return JSON.stringify(
    { ...entry, toJSON: undefined },
    function (this: unknown, key: string, value: unknown) {
      if (
        secretKeys.has(key.toLowerCase().replace(/[-_]/g, "")) ||
        /password|senha|secret|token|private.?key/i.test(key)
      )
        return "[REDACTED]";
      if (typeof value === "string")
        return value.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, maskCpf);
      if (typeof value === "bigint") return value.toString();
      if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack };
      }
      if (value !== null && typeof value === "object") {
        while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) ancestors.pop();
        if (ancestors.includes(value)) return "[Circular]";
        ancestors.push(value);
      }
      return value;
    }
  );
}

function write(severity: Severity, message: string, context: LogContext = {}) {
  const entry = {
    severity,
    message,
    timestamp: new Date().toISOString(),
  };
  let line: string;
  try {
    // Cloud Logging fields belong to the logger, even if context contains the same keys.
    line = serialize({ ...context, ...entry });
  } catch {
    // A getter or toJSON hook in diagnostic context must not break error recovery.
    line = JSON.stringify({ ...entry, contextSerializationFailed: true });
  }
  if (severity === "ERROR") console.error(line);
  else if (severity === "WARNING") console.warn(line);
  else console.log(line);
}

/** Structured JSON logger compatible with Cloud Logging. */
export const logger = {
  debug: (message: string, context?: LogContext) => write("DEBUG", message, context),
  info: (message: string, context?: LogContext) => write("INFO", message, context),
  warn: (message: string, context?: LogContext) => write("WARNING", message, context),
  error: (message: string, context?: LogContext) => write("ERROR", message, context),
  audit: (action: string, message: string, context?: LogContext) =>
    write("INFO", message, { ...context, action, audit: true }),
};

export function maskCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 ? `***.***.***-${digits.slice(-2)}` : "***.***.***-**";
}
export function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 ? `(**) *****-${digits.slice(-4)}` : "(**) *****-****";
}
export function maskPatientName(value: string) {
  if (!value.trim()) return "Anônimo";
  const parts = value.trim().split(/\s+/);
  return parts.length === 1
    ? `${parts[0][0]}.`
    : `${parts[0]} ${parts
        .slice(1)
        .map((p) => `${p[0]}.`)
        .join(" ")}`;
}
export function sanitizeLogData(value: unknown): unknown {
  const text = serialize({ value });
  return JSON.parse(text).value;
}
