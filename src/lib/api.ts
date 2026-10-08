/**
 * Read-side data fetching with an in-memory cache and request de-duplication,
 * so moving between pages doesn't refetch what we already have.
 */
import { useEffect, useState } from 'react';

interface Entry {
  promise: Promise<unknown>;
  data?: unknown;
  error?: Error;
  at: number;
}

const cache = new Map<string, Entry>();
const TTL_MS = 5 * 60 * 1000;

export class LoadError extends Error {}

export function fetchJson<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && !hit.error && Date.now() - hit.at < TTL_MS) return hit.promise as Promise<T>;
  const entry: Entry = { at: Date.now(), promise: Promise.resolve() };
  entry.promise = fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
    .then(async (res) => {
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new LoadError(body?.error || `Request failed (${res.status})`);
      entry.data = body;
      return body;
    })
    .catch((err) => {
      entry.error = err instanceof LoadError ? err : new LoadError('We couldn’t reach Cozy Dispatch. Check your connection.');
      cache.delete(url);
      throw entry.error;
    });
  cache.set(url, entry);
  return entry.promise as Promise<T>;
}

export interface Resource<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  retry: () => void;
}

export function useApi<T>(url: string | null): Resource<T> {
  const cached = url ? (cache.get(url)?.data as T | undefined) : undefined;
  const [state, setState] = useState<{ url: string | null; data?: T; error?: Error }>({ url, data: cached });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    const existing = cache.get(url)?.data as T | undefined;
    setState({ url, data: existing });
    fetchJson<T>(url)
      .then((data) => alive && setState({ url, data }))
      .catch((error) => alive && setState({ url, error }));
    return () => {
      alive = false;
    };
  }, [url, attempt]);

  const current = state.url === url ? state : { url, data: cached };
  return {
    data: current.data,
    error: current.error,
    loading: Boolean(url) && current.data === undefined && !current.error,
    retry: () => setAttempt((n) => n + 1)
  };
}

export function buildUrl(path: string, params: Record<string, string | number | boolean | null | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === false || v === '') continue;
    qs.set(k, v === true ? '1' : String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}
