/** Browser client for shareable game lists. */
import type { GameList, GameListSummary } from '../shared/lists';
import { apiRequest } from './accountApi';

export function fetchMyLists(signal?: AbortSignal): Promise<{ items: GameListSummary[] }> {
  return apiRequest('GET', '/api/me/lists', undefined, signal);
}

export function fetchList(id: string, signal?: AbortSignal): Promise<GameList> {
  return apiRequest('GET', `/api/lists/${encodeURIComponent(id)}`, undefined, signal);
}

export function createList(input: { title: string; description?: string; appIds?: number[] }): Promise<GameListSummary> {
  return apiRequest('POST', '/api/me/lists', input);
}

export function updateList(id: string, patch: { title?: string; description?: string; appIds?: number[] }): Promise<GameListSummary> {
  return apiRequest('PATCH', `/api/me/lists/${encodeURIComponent(id)}`, patch);
}

export function deleteList(id: string): Promise<{ ok: true }> {
  return apiRequest('DELETE', `/api/me/lists/${encodeURIComponent(id)}`);
}

export function listPath(list: { id: string }): string {
  return `/list/${list.id}`;
}
