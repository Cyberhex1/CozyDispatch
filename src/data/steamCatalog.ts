import type { Game } from '../types';
import steamGamesCatalog from './steamGamesCatalog.json';

/**
 * The dynamically generated Steam catalog (`scripts/fetchCatalog.ts`).
 * These entries conform to the `Game` interface and are merged with the
 * hand-curated `MOCK_GAMES` in `src/App.tsx` (curated entries win on id
 * collisions so hand-written fields are never overwritten).
 */
export const STEAM_CATALOG_GAMES: Game[] = steamGamesCatalog as Game[];

/** Total number of games in the generated catalog. */
export const STEAM_CATALOG_COUNT = STEAM_CATALOG_GAMES.length;
