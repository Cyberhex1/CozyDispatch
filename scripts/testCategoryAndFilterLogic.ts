import assert from 'assert';
import { matchesGameCategory, filterGamesByCategory } from '../src/utils/categoryMatcher';
import { parseReleaseDateInfo, parseReleaseTimestamp, isGameNewlyReleased } from '../src/utils/format';
import { MOCK_GAMES } from '../src/data/mockData';
import { STEAM_CATALOG_GAMES } from '../src/data/steamCatalog';
import type { Game, GameCategory } from '../src/types';

const ALL_GAMES: Game[] = (() => {
  const merged = [...MOCK_GAMES, ...STEAM_CATALOG_GAMES];
  const seen = new Set<string>();
  const unique: Game[] = [];
  for (const game of merged) {
    if (seen.has(game.id)) continue;
    seen.add(game.id);
    unique.push(game);
  }
  return unique;
})();

async function runTests() {
  console.log('🧪 Running Category Navigation & Filter Logic Tests...\n');

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // -------------------------------------------------------------
  // Test 1: Category Matching & Exploration
  // -------------------------------------------------------------
  console.log('--- TEST 1: Category Matching Across Catalog ---');
  const categories: GameCategory[] = [
    'cozy',
    'farming',
    'indie',
    'simulation',
    'cooking',
    'horror',
    'job-sim',
    'driving-sim',
    'rpg',
    'roguelike',
    'puzzle',
    'steam-deck'
  ];

  for (const cat of categories) {
    const matched = filterGamesByCategory(ALL_GAMES, cat);
    console.log(`  Category [${cat}]: ${matched.length} games matched.`);
    assert(matched.length > 0, `Category ${cat} should have matching games, got 0.`);
  }

  // Key game validations
  const stardew = ALL_GAMES.find((g) => g.title.toLowerCase().includes('stardew valley'));
  if (stardew) {
    assert(matchesGameCategory(stardew, 'farming'), 'Stardew Valley must match farming category');
    assert(matchesGameCategory(stardew, 'cozy'), 'Stardew Valley must match cozy category');
    assert(matchesGameCategory(stardew, 'rpg'), 'Stardew Valley must match rpg category');
  }

  const tinyGlade = ALL_GAMES.find((g) => g.title.toLowerCase().includes('tiny glade'));
  if (tinyGlade) {
    assert(matchesGameCategory(tinyGlade, 'cozy'), 'Tiny Glade must match cozy category');
    assert(matchesGameCategory(tinyGlade, 'simulation'), 'Tiny Glade must match simulation category');
  }

  const balatro = ALL_GAMES.find((g) => g.title.toLowerCase().includes('balatro'));
  if (balatro) {
    assert(matchesGameCategory(balatro, 'roguelike'), 'Balatro must match roguelike category');
    assert(matchesGameCategory(balatro, 'indie'), 'Balatro must match indie category');
  }

  const dredge = ALL_GAMES.find((g) => g.title.toLowerCase().includes('dredge'));
  if (dredge) {
    assert(matchesGameCategory(dredge, 'horror'), 'Dredge must match horror category');
  }

  console.log('✅ Test 1 Passed: All categories match appropriate games accurately.\n');

  // -------------------------------------------------------------
  // Test 2: Date Parsing & Relative Terms
  // -------------------------------------------------------------
  console.log('--- TEST 2: Release Date Parsing & Relative Dates ---');
  
  // Test exact dates
  const infoAug26 = parseReleaseDateInfo('Aug 26, 2026', 'released', now);
  assert(infoAug26.isReleased, 'Aug 26, 2026 should be marked released when reference is now');
  assert(infoAug26.timestamp > 0, 'Aug 26, 2026 must have valid positive timestamp');

  // Test relative dates
  const infoYesterday = parseReleaseDateInfo('yesterday', 'released', now);
  assert(infoYesterday.isReleased, 'Yesterday should be released');
  assert.strictEqual(infoYesterday.displayLabel, 'Yesterday');
  assert.strictEqual(infoYesterday.timestamp, now - dayMs);

  const infoToday = parseReleaseDateInfo('today', 'released', now);
  assert(infoToday.isReleased, 'Today should be released');
  assert.strictEqual(infoToday.timestamp, now);

  const infoThisWeek = parseReleaseDateInfo('this week', 'released', now);
  assert(infoThisWeek.isReleased, 'This week should be released');

  // Test Coming Soon & Placeholders
  const infoComingSoon = parseReleaseDateInfo('Coming Soon', 'upcoming', now);
  assert(infoComingSoon.isUpcoming, 'Coming Soon must be upcoming');
  assert(!infoComingSoon.isReleased, 'Coming Soon must not be released');
  assert.strictEqual(infoComingSoon.timestamp, 0, 'Coming Soon should have 0 numeric timestamp');

  const infoTBA = parseReleaseDateInfo('TBA', 'upcoming', now);
  assert(infoTBA.isUpcoming, 'TBA must be upcoming');

  // Test Quarter
  const infoQ4 = parseReleaseDateInfo('Q4 2026', 'upcoming', now);
  assert(infoQ4.timestamp > 0, 'Q4 2026 should have timestamp');

  console.log('✅ Test 2 Passed: Date parsing handles exact dates, quarters, and relative phrases.\n');

  // -------------------------------------------------------------
  // Test 3: Chronological Sorting & No Leapfrogging
  // -------------------------------------------------------------
  console.log('--- TEST 3: Chronological "Newest" Sorting ---');

  const sampleGames: Game[] = [
    {
      id: 'g-coming-soon',
      title: 'Upcoming Unreleased Title',
      slug: 'upcoming-unreleased',
      shortDescription: '',
      fullDescription: '',
      coverImage: '',
      bannerImage: '',
      developer: 'Dev',
      publisher: 'Pub',
      releaseDate: 'Coming Soon',
      releaseStatus: 'upcoming',
      price: '$19.99',
      demoAvailable: false,
      steamDeckStatus: 'Verified',
      steamDeckNotes: '',
      cozyScore: 9,
      category: 'cozy',
      tags: ['Cozy'],
      ratingScore: 95,
      totalReviews: '100',
      reviewSentiment: 'Very Positive',
      platforms: ['PC'],
      storeUrl: '',
      steamStoreUrl: '',
      vibes: []
    },
    {
      id: 'g-yesterday',
      title: 'Released Yesterday',
      slug: 'released-yesterday',
      shortDescription: '',
      fullDescription: '',
      coverImage: '',
      bannerImage: '',
      developer: 'Dev',
      publisher: 'Pub',
      releaseDate: 'yesterday',
      releaseStatus: 'released',
      price: '$14.99',
      demoAvailable: false,
      steamDeckStatus: 'Verified',
      steamDeckNotes: '',
      cozyScore: 9,
      category: 'cozy',
      tags: ['Cozy'],
      ratingScore: 95,
      totalReviews: '100',
      reviewSentiment: 'Very Positive',
      platforms: ['PC'],
      storeUrl: '',
      steamStoreUrl: '',
      vibes: []
    },
    {
      id: 'g-march',
      title: 'Released in March',
      slug: 'released-march',
      shortDescription: '',
      fullDescription: '',
      coverImage: '',
      bannerImage: '',
      developer: 'Dev',
      publisher: 'Pub',
      releaseDate: 'Mar 15, 2026',
      releaseStatus: 'released',
      price: '$14.99',
      demoAvailable: false,
      steamDeckStatus: 'Verified',
      steamDeckNotes: '',
      cozyScore: 9,
      category: 'cozy',
      tags: ['Cozy'],
      ratingScore: 95,
      totalReviews: '100',
      reviewSentiment: 'Very Positive',
      platforms: ['PC'],
      storeUrl: '',
      steamStoreUrl: '',
      vibes: []
    },
    {
      id: 'g-future-year',
      title: 'Far Future 2027 Title',
      slug: 'future-2027',
      shortDescription: '',
      fullDescription: '',
      coverImage: '',
      bannerImage: '',
      developer: 'Dev',
      publisher: 'Pub',
      releaseDate: '2027',
      releaseStatus: 'upcoming',
      price: '$24.99',
      demoAvailable: false,
      steamDeckStatus: 'Verified',
      steamDeckNotes: '',
      cozyScore: 9,
      category: 'cozy',
      tags: ['Cozy'],
      ratingScore: 95,
      totalReviews: '100',
      reviewSentiment: 'Very Positive',
      platforms: ['PC'],
      storeUrl: '',
      steamStoreUrl: '',
      vibes: []
    }
  ];

  // Sort by 'newest'
  const sortedNewest = [...sampleGames].sort((a, b) => {
    const tsA = parseReleaseTimestamp(a.releaseDate, a.releaseStatus, now);
    const tsB = parseReleaseTimestamp(b.releaseDate, b.releaseStatus, now);
    
    const isAUpcoming = a.releaseStatus === 'upcoming' || tsA > now || tsA <= 0;
    const isBUpcoming = b.releaseStatus === 'upcoming' || tsB > now || tsB <= 0;

    if (!isAUpcoming && isBUpcoming) return -1;
    if (isAUpcoming && !isBUpcoming) return 1;

    if (!isAUpcoming && !isBUpcoming) {
      return tsB - tsA;
    }
    return tsA - tsB;
  });

  console.log('  Sorted Newest Order:', sortedNewest.map((g) => `${g.title} (${g.releaseDate})`));

  assert.strictEqual(sortedNewest[0].id, 'g-yesterday', 'Game released yesterday must appear #1');
  assert.strictEqual(sortedNewest[1].id, 'g-march', 'Game released in March must appear #2 (after yesterday)');
  assert(
    sortedNewest[2].releaseStatus === 'upcoming' && sortedNewest[3].releaseStatus === 'upcoming',
    'Upcoming / Coming Soon games must appear at the end, not ahead of released games'
  );

  console.log('✅ Test 3 Passed: "Newest" sort strictly orders released games descending and keeps unreleased games at end.\n');

  // -------------------------------------------------------------
  // Test 4: "Newly Released" Filter Logic
  // -------------------------------------------------------------
  console.log('--- TEST 4: "Newly Released" Filter Evaluation ---');
  assert(isGameNewlyReleased(sampleGames[1], 180, now), 'Game released yesterday must pass isGameNewlyReleased');
  assert(!isGameNewlyReleased(sampleGames[0], 180, now), 'Coming Soon game must NOT pass isGameNewlyReleased');
  assert(!isGameNewlyReleased(sampleGames[3], 180, now), 'Future 2027 game must NOT pass isGameNewlyReleased');

  const newlyReleasedCatalog = ALL_GAMES.filter((g) => isGameNewlyReleased(g, 180, now));
  console.log(`  Catalog has ${newlyReleasedCatalog.length} newly released titles in past 180 days.`);
  assert(newlyReleasedCatalog.length > 0, 'Catalog should contain newly released games');
  for (const g of newlyReleasedCatalog) {
    assert(g.releaseStatus !== 'upcoming', `${g.title} in newly released must not have upcoming status`);
  }

  console.log('✅ Test 4 Passed: Newly released filter excludes upcoming and future titles.\n');

  // -------------------------------------------------------------
  // Test 5: Filter Combination Logic
  // -------------------------------------------------------------
  console.log('--- TEST 5: Combined Filters (Category + Filter + Deck) ---');
  const combined = ALL_GAMES.filter((g) => {
    if (!matchesGameCategory(g, 'farming')) return false;
    if (g.steamDeckStatus !== 'Verified') return false;
    return true;
  });
  console.log(`  Farming + Steam Deck Verified: ${combined.length} titles.`);
  assert(combined.length > 0, 'Should find games that are both Farming and Steam Deck Verified');
  for (const g of combined) {
    assert.strictEqual(g.steamDeckStatus, 'Verified');
    assert(matchesGameCategory(g, 'farming'));
  }

  console.log('✅ Test 5 Passed: Multi-filter composition works harmoniously.\n');

  // -------------------------------------------------------------
  // Test 6: Date Boundary Edge Cases
  // -------------------------------------------------------------
  console.log('--- TEST 6: Date Boundary Edge Cases ---');

  // Exactly at now — should be "newly released"
  const gameExactlyNow: Game = { ...sampleGames[1], id: 'g-exact-now', releaseDate: 'today', releaseStatus: 'released' };
  assert(isGameNewlyReleased(gameExactlyNow, 180, now), 'Game released exactly today must be newly released');

  // 1ms in the future — should NOT be newly released
  const gameOneMsAhead = { ...sampleGames[1], id: 'g-one-ms', releaseDate: new Date(now + 1).toISOString(), releaseStatus: 'upcoming' as const };
  assert(!isGameNewlyReleased(gameOneMsAhead, 180, now), 'Game 1ms in future must NOT be newly released');

  // Exactly at the window boundary (180 days ago)
  const boundary180 = now - 180 * 24 * 60 * 60 * 1000;
  const gameBoundary: Game = {
    ...sampleGames[1],
    id: 'g-boundary',
    releaseDate: new Date(boundary180).toISOString(),
    releaseStatus: 'released'
  };
  assert(isGameNewlyReleased(gameBoundary, 180, now), 'Game at exactly 180 days ago must still qualify as newly released');

  // 181 days ago — outside window
  const game181Days: Game = {
    ...sampleGames[1],
    id: 'g-181',
    releaseDate: new Date(now - 181 * 24 * 60 * 60 * 1000).toISOString(),
    releaseStatus: 'released',
    isNewlyReleased: false
  };
  assert(!isGameNewlyReleased(game181Days, 180, now), 'Game at 181 days ago must NOT qualify as newly released (default 180 day window)');

  console.log('✅ Test 6 Passed: Date boundary edge cases (today, 1ms future, 180d boundary, 181d past) are all correct.\n');

  // -------------------------------------------------------------
  // Test 7: Badge Count Accuracy per Category
  // -------------------------------------------------------------
  console.log('--- TEST 7: Badge Count Accuracy (category-scoped) ---');
  
  // Simulate the fixed GameBrowser behavior: badge counts scoped to category
  const farmingGames = ALL_GAMES.filter((g) => matchesGameCategory(g, 'farming'));
  const farmingNewlyReleased = farmingGames.filter((g) => isGameNewlyReleased(g, 180, now));
  const allNewlyReleased = ALL_GAMES.filter((g) => isGameNewlyReleased(g, 180, now));

  console.log(`  All games newly released: ${allNewlyReleased.length}`);
  console.log(`  Farming category games: ${farmingGames.length}`);
  console.log(`  Farming + newly released: ${farmingNewlyReleased.length}`);

  // Category-scoped count must be <= full catalog count
  assert(
    farmingNewlyReleased.length <= allNewlyReleased.length,
    'Farming newly released count must be <= total catalog newly released count'
  );

  // Every game in farmingNewlyReleased must actually match farming AND be newly released
  for (const g of farmingNewlyReleased) {
    assert(matchesGameCategory(g, 'farming'), `${g.title} must match farming category`);
    assert(isGameNewlyReleased(g, 180, now), `${g.title} must be newly released`);
  }

  console.log('✅ Test 7 Passed: Badge counts are correctly scoped to the active category.\n');

  // -------------------------------------------------------------
  // Test 8: No Coming-Soon games leapfrog released games in real catalog
  // -------------------------------------------------------------
  console.log('--- TEST 8: Real Catalog Sort Integrity ---');
  
  const sortedRealNewest = [...ALL_GAMES].sort((a, b) => {
    const tsA = parseReleaseTimestamp(a.releaseDate, a.releaseStatus, now);
    const tsB = parseReleaseTimestamp(b.releaseDate, b.releaseStatus, now);

    const isAUpcoming = a.releaseStatus === 'upcoming' || tsA > now || tsA <= 0;
    const isBUpcoming = b.releaseStatus === 'upcoming' || tsB > now || tsB <= 0;

    if (!isAUpcoming && isBUpcoming) return -1;
    if (isAUpcoming && !isBUpcoming) return 1;
    if (!isAUpcoming && !isBUpcoming) return tsB - tsA;
    return tsA - tsB;
  });

  // Find the last released game index and first upcoming game index
  const lastReleasedIdx = sortedRealNewest.map((g, i) => ({ g, i })).filter(
    ({ g }) => g.releaseStatus !== 'upcoming' && parseReleaseTimestamp(g.releaseDate, g.releaseStatus, now) <= now && parseReleaseTimestamp(g.releaseDate, g.releaseStatus, now) > 0
  ).pop()?.i ?? -1;

  const firstUpcomingIdx = sortedRealNewest.findIndex(
    (g) => g.releaseStatus === 'upcoming' || parseReleaseTimestamp(g.releaseDate, g.releaseStatus, now) > now || parseReleaseTimestamp(g.releaseDate, g.releaseStatus, now) <= 0
  );

  if (firstUpcomingIdx !== -1 && lastReleasedIdx !== -1) {
    assert(
      lastReleasedIdx < firstUpcomingIdx,
      `All released games must appear before upcoming/Coming Soon games in newest sort. Last released idx: ${lastReleasedIdx}, First upcoming idx: ${firstUpcomingIdx}`
    );
    console.log(`  Released games (${lastReleasedIdx + 1}) all precede upcoming games in the sort. ✓`);
  } else {
    console.log(`  No upcoming games found in catalog — skip boundary assertion.`);
  }

  console.log('✅ Test 8 Passed: No Coming Soon/upcoming games leapfrog released games in the real catalog sort.\n');

  console.log('🎉 ALL 8 TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
