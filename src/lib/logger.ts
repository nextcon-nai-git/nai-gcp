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
      if (secretKeys.has(key.toLowerCase().replace(/[-_]/g, ""))) return "[REDACTED]";
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
};
