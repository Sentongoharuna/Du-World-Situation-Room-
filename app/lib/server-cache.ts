type CacheEntry<T> = {
  value: T;
  fetchedAt: string;
  expiresAt: number;
};

type CacheResult<T> = CacheEntry<T> & { stale: boolean };

const store = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<CacheResult<unknown>>>();

/** Small per-isolate cache that coalesces concurrent refreshes and serves stale data on failure. */
export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<CacheResult<T>> {
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    return { ...existing, stale: false };
  }

  const running = inFlight.get(key) as Promise<CacheResult<T>> | undefined;
  if (running) return running;

  const request = (async () => {
    try {
      const value = await loader();
      const fetchedAt = new Date().toISOString();
      const entry: CacheEntry<T> = {
        value,
        fetchedAt,
        expiresAt: Date.now() + ttlMs,
      };
      store.set(key, entry);
      return { ...entry, stale: false };
    } catch (error) {
      if (existing) return { ...existing, stale: true };
      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, request as Promise<CacheResult<unknown>>);
  return request;
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...init?.headers },
    });
    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

