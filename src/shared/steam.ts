/** Steam helpers shared by the sync job, the API and the frontend. */

const STEAM_ASSET_CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/';

/** Builds a store asset URL from the pieces stored in the games table. */
export function steamAssetUrl(base: string | null | undefined, file: string | null | undefined, version?: string | null): string | null {
  if (!base || !file) return null;
  return `${STEAM_ASSET_CDN}${base}${file}${version ? `?t=${version}` : ''}`;
}

export function steamStoreUrl(appId: number): string {
  return `https://store.steampowered.com/app/${appId}/`;
}

/** Steam Deck compatibility categories as reported by Steam. */
export type DeckStatus = 'verified' | 'playable' | 'unsupported' | 'unknown';

export function deckStatusFromCategory(category: number | null | undefined): DeckStatus {
  switch (category) {
    case 3: return 'verified';
    case 2: return 'playable';
    case 1: return 'unsupported';
    default: return 'unknown';
  }
}
