import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const httpAgent = new HttpAgent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  freeSocketTimeout: 30000,
});

const httpsAgent = new HttpsAgent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  freeSocketTimeout: 30000,
});

// Cache simples com TTL
const responseCache = new Map<string, CacheEntry<any>>();

interface FetchOptions extends RequestInit {
  cacheTTL?: number; // TTL em ms (default: 5 minutos)
  retries?: number; // Número de retentativas (default: 3)
  retryDelay?: number; // Delay entre retentativas em ms (default: 1000)
}

/**
 * Cliente HTTP otimizado com:
 * - Connection pooling (keep-alive)
 * - Cache com TTL
 * - Retry com backoff exponencial
 * - Timeout automático
 */
export async function fetchWithPooling<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    cacheTTL = 5 * 60 * 1000, // 5 minutos
    retries = 3,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  const cacheKey = `${url}:${JSON.stringify(fetchOptions)}`;

  // Verifica cache
  if (responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey)!;
    if (cached.expiresAt > Date.now()) {
      return cached.data;
    } else {
      responseCache.delete(cacheKey);
    }
  }

  // Retry loop com backoff exponencial
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        agent: url.startsWith("https") ? httpsAgent : httpAgent,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Armazena em cache
      responseCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + cacheTTL,
      });

      return data as T;
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries - 1) {
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Failed to fetch after retries");
}

/**
 * Limpa cache expirado periodicamente.
 */
export function cleanupCacheExpired() {
  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (entry.expiresAt <= now) {
      responseCache.delete(key);
    }
  }
}

// Limpa cache a cada 5 minutos
if (typeof window === "undefined") {
  setInterval(cleanupCacheExpired, 5 * 60 * 1000);
}
