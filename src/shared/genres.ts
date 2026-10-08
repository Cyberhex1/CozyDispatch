/**
 * Site sections and genres, defined purely in terms of Steam user tags.
 *
 * Shared by the sync job (classification) and the frontend (labels/filters),
 * so what a reader sees under "Farming" is exactly the games whose Steam
 * community tags say so.
 */

export type Section = 'cozy' | 'indie';

export const SECTIONS: Record<Section, { label: string; blurb: string }> = {
  cozy: {
    label: 'Cozy',
    blurb: 'Low-stakes, warm-hearted games: farms, towns, little shops and quiet afternoons.'
  },
  indie: {
    label: 'Indie',
    blurb: 'Small studios, strange ideas and handmade worlds, from roguelikes to indie horror.'
  }
};

export interface GenreDef {
  id: string;
  label: string;
  /** Steam tags that put a game in this genre (any match within the game's top tags). */
  tags: string[];
  /** Restrict to games in one section (e.g. horror only appears for indie games). */
  onlySection?: Section;
}

export const GENRES: GenreDef[] = [
  { id: 'farming', label: 'Farming', tags: ['Farming Sim', 'Agriculture'] },
  { id: 'life-sim', label: 'Life Sims', tags: ['Life Sim'] },
  { id: 'cooking', label: 'Cooking', tags: ['Cooking'] },
  { id: 'building', label: 'Building', tags: ['Building', 'City Builder', 'Colony Sim', 'Base Building'] },
  { id: 'shops', label: 'Shops & Management', tags: ['Management', 'Shop Keeper', 'Time Management', 'Resource Management'] },
  { id: 'creatures', label: 'Creatures & Pets', tags: ['Creature Collector', 'Cats', 'Dog', 'Animals'] },
  { id: 'puzzle', label: 'Puzzle', tags: ['Puzzle', 'Logic', 'Hidden Object', 'Puzzle Platformer'] },
  { id: 'story', label: 'Story-Rich', tags: ['Story Rich', 'Visual Novel', 'Interactive Fiction', 'Narrative', 'Choices Matter'] },
  { id: 'exploration', label: 'Exploration', tags: ['Exploration', 'Walking Simulator'] },
  { id: 'mystery', label: 'Mystery', tags: ['Mystery', 'Detective', 'Point & Click'] },
  { id: 'roguelike', label: 'Roguelikes', tags: ['Roguelike', 'Roguelite', 'Action Roguelike', 'Roguelike Deckbuilder'] },
  { id: 'cards', label: 'Cards & Deckbuilders', tags: ['Card Game', 'Deckbuilding', 'Card Battler', 'Roguelike Deckbuilder'] },
  { id: 'platformer', label: 'Platformers', tags: ['Platformer', '2D Platformer', 'Precision Platformer', 'Metroidvania'] },
  { id: 'strategy', label: 'Strategy & Tactics', tags: ['Strategy', 'Tactical', 'Turn-Based Tactics'] },
  { id: 'co-op', label: 'Co-op', tags: ['Co-op', 'Online Co-Op', 'Local Co-Op'] },
  { id: 'horror', label: 'Indie Horror', tags: ['Horror', 'Psychological Horror', 'Survival Horror'], onlySection: 'indie' }
];

export const GENRE_BY_ID: Record<string, GenreDef> = Object.fromEntries(GENRES.map((g) => [g.id, g]));

// ---------------------------------------------------------------------------
// Classification rules (used by the sync job)
// ---------------------------------------------------------------------------

/** Any of these in a game's top 15 tags makes it a cozy candidate. */
export const COZY_CORE_TAGS = ['Cozy', 'Wholesome', 'Farming Sim', 'Life Sim'];
/** Two of these in the top 10 also count (e.g. relaxing + cute builders). */
export const COZY_SOFT_TAGS = ['Relaxing', 'Cute', 'Family Friendly'];
/** Any of these in the top 10 rules a game out of the cozy section. */
export const NOT_COZY_TAGS = [
  'Horror', 'Psychological Horror', 'Survival Horror', 'Gore', 'Violent', 'Shooter', 'Souls-like',
  'Blood', 'Zombies', 'War', 'Military', 'PvP', 'Battle Royale'
];
export const HORROR_TAGS = ['Horror', 'Psychological Horror', 'Survival Horror'];
/** Anywhere in the top 20: excluded from the site entirely. */
export const ADULT_TAGS = ['Sexual Content', 'Nudity', 'Hentai'];
export const INDIE_TAG = 'Indie';

export interface Classification {
  isCozy: boolean;
  isIndie: boolean;
  isHorror: boolean;
  isAdult: boolean;
  genres: string[];
}

/** `tags` must be ordered most-voted first. */
export function classifyTags(tags: string[]): Classification {
  const rank = new Map<string, number>();
  tags.forEach((t, i) => { if (!rank.has(t)) rank.set(t, i); });
  const within = (list: string[], top: number) => list.some((t) => (rank.get(t) ?? Infinity) < top);
  const countWithin = (list: string[], top: number) => list.filter((t) => (rank.get(t) ?? Infinity) < top).length;

  const isAdult = within(ADULT_TAGS, 20);
  const isIndie = rank.has(INDIE_TAG);
  const isHorror = within(HORROR_TAGS, 10);
  const cozySignal = within(COZY_CORE_TAGS, 15) || countWithin(COZY_SOFT_TAGS, 10) >= 2;
  const isCozy = cozySignal && !within(NOT_COZY_TAGS, 10);

  const genres = GENRES.filter((g) => {
    if (g.onlySection === 'indie' && !isIndie) return false;
    if (g.onlySection === 'cozy' && !isCozy) return false;
    return within(g.tags, 12);
  }).map((g) => g.id);

  return { isCozy, isIndie, isHorror, isAdult, genres };
}
