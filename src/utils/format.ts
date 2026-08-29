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
