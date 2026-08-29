import { Game, GameCategory } from '../types';

/**
 * Tag and keyword mapping for all supported categories.
 * Allows games to be matched across primary category, sub-genres, tags, and vibes.
 */
const CATEGORY_TAG_MAP: Record<GameCategory, string[]> = {
  cozy: [
    'cozy',
    'wholesome',
    'relaxing',
    'cute',
    'casual',
    'life sim',
    'farming sim',
    'pastoral',
    'cottagecore',
    'feel good',
    'peaceful',
    'chill'
  ],
  indie: [
    'indie',
    'atmospheric',
    'story rich',
    'artistic',
    'pixel graphics',
    'emotional',
    'hand-drawn',
    'stylized',
    'original soundtrack',
    'indie gem'
  ],
  simulation: [
    'simulation',
    'building',
    'city builder',
    'sandbox',
    'management',
    'colony sim',
    'base building',
    'crafting',
    'physics',
    'gridless builder',
    'resource-free'
  ],
  'steam-deck': [
    'steam deck',
    'deck verified',
    'handheld',
    'controller',
    '60 fps',
    'oled ready'
  ],
  farming: [
    'farming',
    'farming sim',
    'agriculture',
    'ranching',
    'homestead',
    'crops',
    'livestock',
    'harvest',
    'cottagecore',
    'gardening'
  ],
  cooking: [
    'cooking',
    'baking',
    'restaurant',
    'food',
    'cafe',
    'culinary',
    'chef',
    'kitchen',
    'dining',
    'coffee shop',
    'tea shop'
  ],
  horror: [
    'horror',
    'psychological horror',
    'cozy horror',
    'spooky',
    'survival horror',
    'dark',
    'creepy',
    'mystery horror',
    'retro horror'
  ],
  'job-sim': [
    'job sim',
    'job simulator',
    'work',
    'cleaning',
    'repair',
    'store manager',
    'supermarket',
    'mechanic',
    'automation',
    'retail',
    'powerwash',
    'restoration'
  ],
  'driving-sim': [
    'driving',
    'automobile sim',
    'racing',
    'road trip',
    'train',
    'sailing',
    'flight',
    'travel',
    'vehicle sim',
    'trucking',
    'boating',
    'cruising'
  ],
  rpg: [
    'rpg',
    'jrpg',
    'turn-based',
    'action rpg',
    'adventure rpg',
    'role-playing',
    'role playing',
    'party-based rpg',
    'narrative rpg',
    'story-rich rpg',
    'dungeon crawler'
  ],
  roguelike: [
    'roguelike',
    'roguelite',
    'deckbuilder',
    'card battler',
    'traditional roguelike',
    'action roguelike',
    'permadeath'
  ],
  puzzle: [
    'puzzle',
    'logic',
    'puzzle platformer',
    'sokoban',
    'grid-based',
    'spatial sorting',
    'organization',
    'unpacking',
    'hidden object',
    'brain teaser'
  ]
};

/**
 * Checks whether a game matches a requested category.
 * Considers:
 * 1. Direct match on `game.category`
 * 2. Steam Deck verification for 'steam-deck'
 * 3. Tag and vibe inclusions
 * 4. High cozyScore threshold for 'cozy'
 */
export function matchesGameCategory(game: Game, category: GameCategory | 'all'): boolean {
  if (category === 'all') return true;

  // 1. Direct category match
  if (game.category === category) return true;

  // 2. Steam Deck special category
  if (category === 'steam-deck') {
    return game.steamDeckStatus === 'Verified';
  }

  // 3. Cozy special criteria (games with cozy score >= 7.5 are naturally cozy)
  if (category === 'cozy' && game.cozyScore >= 7.5) {
    return true;
  }

  // 4. Tag / Vibe / Description keyword matching
  const keywords = CATEGORY_TAG_MAP[category];
  if (!keywords) return false;

  const gameTagsLower = (game.tags || []).map((t) => t.toLowerCase());
  const gameVibesLower = (game.vibes || []).map((v) => v.toLowerCase());
  const gameTitleLower = (game.title || '').toLowerCase();
  const gameDescLower = (game.shortDescription || '').toLowerCase();

  for (const kw of keywords) {
    if (gameTagsLower.some((t) => t.includes(kw) || kw.includes(t))) {
      return true;
    }
    if (gameVibesLower.some((v) => v.includes(kw) || kw.includes(v))) {
      return true;
    }
  }

  // Fallback for title/description matches for specific sub-genres
  if (category === 'indie' && (gameDescLower.includes('indie') || gameDescLower.includes('independent') || gameTitleLower.includes('indie'))) {
    return true;
  }
  if (category === 'rpg' && (gameDescLower.includes('rpg') || gameDescLower.includes('role-playing') || gameDescLower.includes('role playing') || gameTitleLower.includes('rpg'))) {
    return true;
  }
  if (category === 'roguelike' && (gameDescLower.includes('roguelike') || gameDescLower.includes('roguelite') || gameDescLower.includes('deckbuilder'))) {
    return true;
  }
  if (category === 'cooking' && (gameTitleLower.includes('cook') || gameTitleLower.includes('cafe') || gameDescLower.includes('cooking') || gameDescLower.includes('recipes') || gameDescLower.includes('bake'))) {
    return true;
  }
  if (category === 'farming' && (gameTitleLower.includes('farm') || gameDescLower.includes('farming') || gameDescLower.includes('crops') || gameDescLower.includes('harvest'))) {
    return true;
  }
  if (category === 'horror' && (gameDescLower.includes('psychological horror') || gameDescLower.includes('cozy horror') || gameDescLower.includes('spooky') || gameDescLower.includes('dread'))) {
    return true;
  }
  if (category === 'job-sim' && (gameTitleLower.includes('simulator') && (gameDescLower.includes('cleaning') || gameDescLower.includes('shop') || gameDescLower.includes('store') || gameDescLower.includes('repair')))) {
    return true;
  }
  if (category === 'driving-sim' && (gameTitleLower.includes('truck') || gameTitleLower.includes('drive') || gameDescLower.includes('road trip') || gameDescLower.includes('trucking'))) {
    return true;
  }
  if (category === 'puzzle' && (gameTitleLower.includes('puzzle') || gameDescLower.includes('unpacking') || gameDescLower.includes('spatial puzzle') || gameDescLower.includes('jigsaw'))) {
    return true;
  }

  return false;
}

/**
 * Filter an array of games by category.
 */
export function filterGamesByCategory(games: Game[], category: GameCategory | 'all'): Game[] {
  if (category === 'all') return games;
  return games.filter((g) => matchesGameCategory(g, category));
}
