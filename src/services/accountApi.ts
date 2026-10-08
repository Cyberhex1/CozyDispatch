/**
 * Typed browser client for the account API. Cookie-based (HttpOnly session),
 * same-origin only. No UI concerns here.
 */
import type { AccountState, Avatar } from '../shared/account';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Shared fetch wrapper: JSON in/out, `{ error }` bodies become ApiError. */
export async function apiRequest<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(0, 'We couldn’t reach Cozy Dispatch. Check your connection and try again.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data && typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.';
    throw new ApiError(res.status, message);
  }
  return data as T;
}

/** Current account, or null when signed out. */
export async function fetchMe(signal?: AbortSignal): Promise<AccountState | null> {
  try {
    return await apiRequest<AccountState>('GET', '/api/me', undefined, signal);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export function signup(input: { email: string; password: string; displayName: string }): Promise<AccountState> {
  return apiRequest('POST', '/api/auth/signup', input);
}

export function login(input: { email: string; password: string }): Promise<AccountState> {
  return apiRequest('POST', '/api/auth/login', input);
}

export function logout(): Promise<{ ok: true }> {
  return apiRequest('POST', '/api/auth/logout');
}

export function updateProfile(patch: { displayName?: string; avatar?: Avatar; bio?: string }): Promise<AccountState> {
  return apiRequest('PATCH', '/api/me', patch);
}

export function addToWishlist(appId: number): Promise<{ wishlist: number[] }> {
  return apiRequest('PUT', `/api/me/wishlist/${appId}`);
}

export function removeFromWishlist(appId: number): Promise<{ wishlist: number[] }> {
  return apiRequest('DELETE', `/api/me/wishlist/${appId}`);
}

export function addBookmark(articleId: string): Promise<{ bookmarks: string[] }> {
  return apiRequest('PUT', `/api/me/bookmarks/${encodeURIComponent(articleId)}`);
}

export function removeBookmark(articleId: string): Promise<{ bookmarks: string[] }> {
  return apiRequest('DELETE', `/api/me/bookmarks/${encodeURIComponent(articleId)}`);
}

/** Folds items saved while signed out into the account (union, server-validated). */
export function mergeSaved(input: { wishlist?: number[]; bookmarks?: string[] }): Promise<AccountState> {
  return apiRequest('POST', '/api/me/merge', input);
}

export function changePassword(input: { currentPassword: string; newPassword: string }): Promise<{ ok: true }> {
  return apiRequest('POST', '/api/me/password', input);
}

export function deleteAccount(password: string): Promise<{ ok: true }> {
  return apiRequest('DELETE', '/api/me', { password });
}
