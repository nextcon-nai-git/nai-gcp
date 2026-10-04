interface HttpJsonOptions {
  cacheTtlMs?: number;
  headers?: HeadersInit;
  maxResponseBytes?: number;
  revalidate?: number;
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

interface CachedResponse {
  expiresAt: number;
  promise: Promise<unknown>;
}

const responseCache = new Map<string, CachedResponse>();
const MAX_CACHE_ENTRIES = 100;

async function cacheSuccessfulResponse(
  cacheKey: string,
  promise: Promise<unknown>,
  ttl: number
): Promise<void> {
  try {
    await promise;
    const entry = responseCache.get(cacheKey);
    if (entry?.promise === promise) entry.expiresAt = Date.now() + ttl;
  } catch {
    responseCache.delete(cacheKey);
  }
}

async function requestJson<T>(url: string, options: HttpJsonOptions): Promise<T> {
  const {
    headers,
    maxResponseBytes = 5 * 1024 * 1024,
    revalidate,
    retries = 2,
    retryDelayMs = 150,
    timeoutMs = 8_000,
  } = options;

  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
        ...(revalidate ? { next: { revalidate } } : {}),
      });

      if (!response.ok) {
        if (attempt < retries && (response.status === 429 || response.status >= 500)) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 2 ** attempt));
          continue;
        }
        const error = new Error(`External request failed: ${response.status}`);
        Object.assign(error, { retryable: false });
        throw error;
      }

      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
        throw new Error("External response exceeds the configured size limit");
      }

      const body = await response.arrayBuffer();
      if (body.byteLength > maxResponseBytes) {
        throw new Error("External response exceeds the configured size limit");
      }
      return JSON.parse(new TextDecoder().decode(body)) as T;
    } catch (error) {
      if (
        attempt >= retries ||
        (error instanceof Error &&
          (error.message.includes("size limit") ||
            (error as Error & { retryable?: boolean }).retryable === false))
      ) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function fetchJson<T>(url: string, options: HttpJsonOptions = {}): Promise<T> {
  const ttl = options.cacheTtlMs ?? 0;
  const headers = new Headers(options.headers);
  if (ttl <= 0 || headers.has("authorization")) return requestJson<T>(url, options);

  const now = Date.now();
  const cacheKey = JSON.stringify({
    url,
    headers: [...headers.entries()].sort(([a], [b]) => a.localeCompare(b)),
    timeoutMs: options.timeoutMs,
    retries: options.retries,
    revalidate: options.revalidate,
  });
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.promise as Promise<T>;
  if (cached) responseCache.delete(cacheKey);

  while (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (!oldestKey) break;
    responseCache.delete(oldestKey);
  }

  const promise = requestJson<T>(url, options);
  responseCache.set(cacheKey, { expiresAt: Number.POSITIVE_INFINITY, promise });
  void cacheSuccessfulResponse(cacheKey, promise, ttl);
  return promise;
}
