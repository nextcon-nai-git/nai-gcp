type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

export type LogContext = Record<string, unknown>;

function write(severity: Severity, message: string, context: LogContext = {}) {
  const entry = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };
  const line = JSON.stringify(entry);
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
