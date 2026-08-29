import { Game } from '../types';

/**
 * Formats a game's rating for display.
 *
 * Catalog games without a published rating have `ratingScore === 0`, which
 * would otherwise render as a misleading "0%". Returns a neutral "Unrated"
 * label instead. Optional `suffix` (e.g. " Positive", " Pos") is appended to
 * the percentage for rated games.
 */
export function formatRating(ratingScore: number, suffix = ''): string {
  if (ratingScore <= 0) return 'Unrated';
  return `${ratingScore}%${suffix}`;
}

export interface ReleaseDateInfo {
  timestamp: number;
  isReleased: boolean;
  isUpcoming: boolean;
  isMissing: boolean;
  displayLabel: string;
}

/**
 * Parses Steam release date strings into unix epoch millisecond timestamps
 * and structured metadata relative to a given reference time (defaults to `Date.now()`).
 */
export function parseReleaseDateInfo(
  dateStr?: string, 
  releaseStatus?: string, 
  referenceNow: number = Date.now()
): ReleaseDateInfo {
  if (!dateStr || typeof dateStr !== 'string') {
    const isUpcoming = releaseStatus === 'upcoming';
    return {
      timestamp: 0,
      isReleased: false,
      isUpcoming,
      isMissing: true,
      displayLabel: isUpcoming ? 'Coming Soon' : 'TBA'
    };
  }

  const str = dateStr.trim();
  const lower = str.toLowerCase();

  // 1. Placeholder & Upcoming strings
  if (
    lower.includes('coming soon') ||
    lower.includes('to be announced') ||
    lower.includes('tba') ||
    lower.includes('tbd') ||
    lower === 'upcoming'
  ) {
    return {
      timestamp: 0,
      isReleased: false,
      isUpcoming: true,
      isMissing: false,
      displayLabel: 'Coming Soon'
    };
  }

  // 2. Relative date terms
  const dayMs = 24 * 60 * 60 * 1000;
  if (lower === 'today') {
    return {
      timestamp: referenceNow,
      isReleased: true,
      isUpcoming: false,
      isMissing: false,
      displayLabel: 'Today'
    };
  }
  if (lower === 'yesterday') {
    return {
      timestamp: referenceNow - dayMs,
      isReleased: true,
      isUpcoming: false,
      isMissing: false,
      displayLabel: 'Yesterday'
    };
  }
  if (lower === 'this week') {
    return {
      timestamp: referenceNow - (3 * dayMs),
      isReleased: true,
      isUpcoming: false,
      isMissing: false,
      displayLabel: 'This Week'
    };
  }
  if (lower === 'this month') {
    return {
      timestamp: referenceNow - (15 * dayMs),
      isReleased: true,
      isUpcoming: false,
      isMissing: false,
      displayLabel: 'This Month'
    };
  }

  // 3. Quarter-based dates e.g. "Q4 2026", "Q1 2027"
  const qMatch = lower.match(/^q([1-4])\s+(\d{4})/);
  if (qMatch) {
    const q = parseInt(qMatch[1], 10);
    const year = parseInt(qMatch[2], 10);
    const month = (q - 1) * 3;
    const ts = Date.UTC(year, month, 1);
    const isUpcoming = ts > referenceNow || releaseStatus === 'upcoming';
    return {
      timestamp: ts,
      isReleased: !isUpcoming,
      isUpcoming,
      isMissing: false,
      displayLabel: str
    };
  }

  // 4. Year only e.g. "2026", "2027"
  if (/^\d{4}$/.test(str)) {
    const year = parseInt(str, 10);
    const ts = Date.UTC(year, 0, 1);
    const isUpcoming = ts > referenceNow || releaseStatus === 'upcoming';
    return {
      timestamp: ts,
      isReleased: !isUpcoming,
      isUpcoming,
      isMissing: false,
      displayLabel: str
    };
  }

  // 5. Month Year e.g. "August 2026", "Feb 2027"
  const monthYearMatch = str.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const parsed = Date.parse(`${monthYearMatch[1]} 1, ${monthYearMatch[2]}`);
    if (!isNaN(parsed)) {
      const isUpcoming = parsed > referenceNow || releaseStatus === 'upcoming';
      return {
        timestamp: parsed,
        isReleased: !isUpcoming,
        isUpcoming,
        isMissing: false,
        displayLabel: str
      };
    }
  }

  // 6. Standard full date parsing e.g. "Aug 26, 2026", "Sep 23, 2024", "2026-08-29"
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const isUpcoming = parsed > referenceNow || releaseStatus === 'upcoming';
    return {
      timestamp: parsed,
      isReleased: !isUpcoming,
      isUpcoming,
      isMissing: false,
      displayLabel: str
    };
  }

  // Fallback for unrecognized strings
  const isUpcoming = releaseStatus === 'upcoming';
  return {
    timestamp: 0,
    isReleased: !isUpcoming && releaseStatus === 'released',
    isUpcoming,
    isMissing: true,
    displayLabel: str
  };
}

/**
 * Returns the numeric release timestamp for sorting.
 * Past releases return their exact timestamp.
 * Unreleased / upcoming games return 0 so they do not leapfrog released games when sorting descending.
 */
export function parseReleaseTimestamp(dateStr?: string, releaseStatus?: string, referenceNow: number = Date.now()): number {
  const info = parseReleaseDateInfo(dateStr, releaseStatus, referenceNow);
  return info.timestamp;
}

/**
 * Determines whether a game qualifies as "Newly Released".
 * A game is newly released if:
 * 1. It has been released (timestamp <= referenceNow, not upcoming/TBA)
 * 2. It was released within the recent window (e.g. within the last 180 days)
 *    OR is explicitly flagged `isNewlyReleased` while not having a legacy date.
 */
export function isGameNewlyReleased(
  game: Game, 
  recentWindowDays: number = 180, 
  referenceNow: number = Date.now()
): boolean {
  if (game.releaseStatus === 'upcoming') return false;

  const info = parseReleaseDateInfo(game.releaseDate, game.releaseStatus, referenceNow);
  if (info.isUpcoming || info.isMissing || info.timestamp <= 0) {
    return false;
  }

  // Must be in the past or today
  if (info.timestamp > referenceNow) {
    return false;
  }

  const windowMs = recentWindowDays * 24 * 60 * 60 * 1000;
  const isWithinWindow = (referenceNow - info.timestamp) <= windowMs;

  if (isWithinWindow) return true;

  if (game.isNewlyReleased) {
    const isLegacyYear = /(?:201\d|202[0-3])/.test(game.releaseDate || '');
    return !isLegacyYear && (referenceNow - info.timestamp) <= (365 * 24 * 60 * 60 * 1000);
  }

  return false;
}
