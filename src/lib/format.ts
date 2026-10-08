import type { Game } from '../shared/content';
import type { DeckStatus } from '../shared/steam';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatPrice(cents: number | null): string | null {
  return cents === null ? null : usd.format(cents / 100);
}

export function priceText(game: Game): string | null {
  if (game.comingSoon) return null;
  if (game.isFree) return 'Free to play';
  return formatPrice(game.price);
}

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const longDateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export function formatDate(iso: string | null): string | null {
  return iso ? dateFmt.format(new Date(iso)) : null;
}

export function todayLine(): string {
  return longDateFmt.format(new Date());
}

/** Release text the way Steam would show it. */
export function releaseText(game: Game): string | null {
  if (game.releaseLabel) return game.releaseLabel;
  return formatDate(game.releaseDate);
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 90) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} hr ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} d ago`;
  return formatDate(iso) || '';
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export const DECK_LABEL: Record<DeckStatus, string> = {
  verified: 'Deck Verified',
  playable: 'Deck Playable',
  unsupported: 'Not on Deck',
  unknown: 'Deck: not tested'
};

export function reviewText(game: Game): string | null {
  if (!game.reviewLabel) return game.reviewCount > 0 ? `${compactNumber(game.reviewCount)} reviews` : null;
  return `${game.reviewLabel} · ${compactNumber(game.reviewCount)}`;
}

export function sectionOf(game: Game): 'cozy' | 'indie' {
  return game.cozy ? 'cozy' : 'indie';
}
