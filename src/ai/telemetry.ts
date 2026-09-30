type TelemetryEnvironment = Pick<NodeJS.ProcessEnv,
  'NEXT_PHASE' | 'NODE_ENV' | 'GOOGLE_SERVICE_ACCOUNT_JSON' | 'GOOGLE_APPLICATION_CREDENTIALS'>;

/** Building pages must not initialize cloud exporters or probe cloud credentials. */
export function shouldEnableFirebaseTelemetry(env: TelemetryEnvironment): boolean {
  return env.NEXT_PHASE !== 'phase-production-build' && Boolean(
    env.NODE_ENV === 'production' || env.GOOGLE_SERVICE_ACCOUNT_JSON || env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

/** Provider initialization is asynchronous; both synchronous and async failures are contained. */
export async function initializeFirebaseTelemetry(
  enable: () => Promise<void>,
  log: Pick<Console, 'info' | 'warn'> = console,
): Promise<void> {
  try {
    await enable();
    log.info('NAI Telemetry: Sistema de monitoramento ativado.');
  } catch {
    // Provider errors may contain credentials or request details.
    log.warn('NAI Telemetry: Monitoramento indisponível neste ambiente.');
  }
}
