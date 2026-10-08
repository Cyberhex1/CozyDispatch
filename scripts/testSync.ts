/**
 * Unit tests for catalog classification, Steam data mapping, feed parsing and
 * news matching. No network. Run: npx tsx scripts/testSync.ts
 */
import assert from 'node:assert/strict';
import { classifyTags } from '../src/shared/genres';
import { releaseLabel, toGameRow, GAME_COLUMNS, type Candidate } from '../src/sync/catalogSync';
import { buildTitleMatchers, cleanSteamAnnouncement, parseFeed, type CatalogTitle } from '../src/sync/newsSync';
import { sqlLiteral, upsertRows } from '../src/sync/sqlWrite';
import { createLocalD1 } from '../src/server/db/localSqlite';
import { queryGames } from '../src/server/catalog/catalogRoutes';

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failures.push(name);
    console.log(`  ✗ ${name}\n    ${err?.message}`);
  }
}

const NOW = Math.floor(Date.UTC(2026, 9, 8) / 1000);
const tagIds = new Map<number, string>();
const tagNameToId = new Map<string, number>();
function tagObjs(names: string[]) {
  return names.map((n, i) => {
    if (!tagNameToId.has(n)) {
      const id = tagNameToId.size + 1;
      tagNameToId.set(n, id);
      tagIds.set(id, n);
    }
    return { tagid: tagNameToId.get(n)!, weight: 1000 - i };
  });
}

function candidate(over: Omit<Partial<Candidate['item']>, 'tags'> & { tags: string[] }, upcomingRank: number | null = null): Candidate {
  const { tags, ...rest } = over;
  return {
    popularity: 10,
    upcomingRank,
    item: {
      id: 1, appid: 1, type: 0, success: 1, visible: true, name: 'Test Game',
      tags: tagObjs(tags),
      reviews: { summary_filtered: { review_count: 5000, percent_positive: 95, review_score: 9, review_score_label: 'Very Positive' } },
      release: { steam_release_date: NOW - 400 * 86400 },
      assets: { asset_url_format: 'steam/apps/1/${FILENAME}?t=99', header: 'header.jpg' },
      platforms: { steam_deck_compat_category: 3 },
      best_purchase_option: { final_price_in_cents: '999', original_price_in_cents: '1999', discount_pct: 50 },
      ...rest
    }
  };
}
const col = (row: any[], name: string) => row[GAME_COLUMNS.indexOf(name as any)];

async function main() {
  console.log('Classification');
  await test('farming sim is cozy with farming + life-sim genres', () => {
    const c = classifyTags(['Farming Sim', 'Pixel Graphics', 'RPG', 'Life Sim', 'Cozy', 'Indie']);
    assert.equal(c.isCozy, true);
    assert.equal(c.isIndie, true);
    assert.deepEqual(c.genres.filter((g) => ['farming', 'life-sim'].includes(g)), ['farming', 'life-sim']);
  });
  await test('horror in top tags is never cozy', () => {
    const c = classifyTags(['Horror', 'Cute', 'Cozy', 'Indie']);
    assert.equal(c.isCozy, false);
    assert.equal(c.isHorror, true);
  });
  await test('non-indie horror gets no horror genre and no section', () => {
    const c = classifyTags(['Horror', 'Survival Horror', 'Action', 'Shooter']);
    assert.equal(c.isIndie, false);
    assert.equal(c.isCozy, false);
    assert.ok(!c.genres.includes('horror'));
  });
  await test('indie horror gets the horror genre', () => {
    assert.ok(classifyTags(['Horror', 'Co-op', 'Indie']).genres.includes('horror'));
  });
  await test('adult content is flagged', () => {
    assert.equal(classifyTags(['Cozy', 'Life Sim', 'Sexual Content']).isAdult, true);
  });
  await test('two soft cozy tags qualify; one does not', () => {
    assert.equal(classifyTags(['Relaxing', 'Building', 'Cute']).isCozy, true);
    assert.equal(classifyTags(['Relaxing', 'Strategy', 'Building']).isCozy, false);
  });

  console.log('Steam mapping');
  await test('maps real fields and keeps a released cozy game', () => {
    const row = toGameRow(candidate({ tags: ['Cozy', 'Farming Sim', 'Indie'] }), tagIds, 'now', NOW)!;
    assert.ok(row);
    assert.equal(col(row.values, 'price_cents'), 999);
    assert.equal(col(row.values, 'discount_pct'), 50);
    assert.equal(col(row.values, 'deck_compat'), 3);
    assert.equal(col(row.values, 'asset_base'), 'steam/apps/1/');
    assert.equal(col(row.values, 'asset_version'), '99');
  });
  await test('drops games that are neither cozy nor indie', () => {
    assert.equal(toGameRow(candidate({ tags: ['Action', 'Shooter'] }), tagIds, 'now', NOW), null);
  });
  await test('drops indie games below the review bar but keeps new releases', () => {
    const few = { review_count: 40, percent_positive: 90, review_score: 6, review_score_label: 'Positive' };
    assert.equal(toGameRow(candidate({ tags: ['Indie', 'Roguelike'], reviews: { summary_filtered: few } }), tagIds, 'now', NOW), null);
    const fresh = candidate({ tags: ['Indie', 'Roguelike'], reviews: { summary_filtered: few }, release: { steam_release_date: NOW - 5 * 86400 } });
    assert.ok(toGameRow(fresh, tagIds, 'now', NOW));
  });
  await test('upcoming games need an upcoming rank', () => {
    const up = { tags: ['Cozy'], release: { is_coming_soon: true, coming_soon_display: 'date_quarter', steam_release_date: NOW + 90 * 86400 }, best_purchase_option: undefined };
    assert.equal(toGameRow(candidate(up), tagIds, 'now', NOW), null);
    const row = toGameRow(candidate(up, 12), tagIds, 'now', NOW)!;
    assert.equal(col(row.values, 'release_label'), 'Q1 2027');
    assert.equal(col(row.values, 'price_cents'), null);
  });
  await test('unknown review score stays NULL, not invented', () => {
    const none = { review_count: 0, percent_positive: 0, review_score: 0, review_score_label: 'No user reviews' };
    const row = toGameRow(candidate({ tags: ['Cozy'], reviews: { summary_filtered: none } }, 3), tagIds, 'now', NOW);
    assert.equal(row, null); // released, 0 reviews -> below bar
  });
  await test('release labels mirror Steam', () => {
    const ts = Date.UTC(2026, 10, 15) / 1000;
    assert.equal(releaseLabel({ is_coming_soon: true, steam_release_date: ts, coming_soon_display: 'date_month' }), 'November 2026');
    assert.equal(releaseLabel({ is_coming_soon: true, coming_soon_display: 'text_comingsoon' }), 'Coming soon');
    assert.equal(releaseLabel({ steam_release_date: ts }), null);
  });

  console.log('Feeds & matching');
  await test('parses RSS with CDATA, entities and media', () => {
    const xml = `<rss><channel><item><title><![CDATA[Stardew Valley &amp; friends]]></title><link>https://x.test/a?utm_source=rss</link>
      <pubDate>Tue, 06 Oct 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;&lt;/p&gt;</description>
      <media:content url="https://img.test/a.jpg" medium="image"/></item></channel></rss>`;
    const [e] = parseFeed(xml);
    assert.equal(e.title, 'Stardew Valley & friends');
    assert.equal(e.summary, 'Hello world');
    assert.equal(e.image, 'https://img.test/a.jpg');
  });
  await test('title matching avoids common words and shared franchise prefixes', () => {
    const g = (app_id: number, title: string, review_count = 1000): CatalogTitle => ({ app_id, title, review_count, is_cozy: 1, is_indie: 1, asset_base: null, header_file: null, asset_version: null });
    const m = buildTitleMatchers([
      g(1, 'House'), g(2, 'Stardew Valley'), g(3, 'Warhammer 40,000: Boltgun'), g(4, 'Warhammer 40,000: Mechanicus'),
      g(5, 'Celeste', 90_000), g(6, 'Hades II: Collector Edition')
    ]);
    const hits = (title: string) => m.filter((x) => x.re.test(title)).map((x) => x.appId).sort();
    assert.deepEqual(hits('The house that Stardew Valley built'), [2]);
    assert.deepEqual(hits('Warhammer 40,000 is getting a new game'), []);
    assert.deepEqual(hits('Celeste speedrun record'), [5]);
    assert.deepEqual(hits('Hades II patch notes'), [6]);
  });
  await test('cleans Steam announcement markup', () => {
    const { text, image } = cleanSteamAnnouncement('[h1]Patch 1.2[/h1][img]{STEAM_CLAN_IMAGE}/123/abc.png[/img] Fixed [b]bugs[/b].');
    assert.equal(text, 'Patch 1.2 Fixed bugs .');
    assert.equal(image, 'https://clan.akamai.steamstatic.com/images/123/abc.png');
  });

  console.log('Storage & queries');
  await test('sqlLiteral escapes quotes and rejects non-finite numbers', () => {
    assert.equal(sqlLiteral("it's"), "'it''s'");
    assert.equal(sqlLiteral(NaN), 'NULL');
    assert.equal(sqlLiteral(true), '1');
  });
  await test('upsert + query: sections, genres, search and paging', async () => {
    const db = createLocalD1(':memory:');
    const rows = [
      toGameRow({ ...candidate({ tags: ['Cozy', 'Farming Sim', 'Indie'], name: "Bramble's Farm", appid: 10, id: 10 }) }, tagIds, 'now', NOW)!,
      toGameRow({ ...candidate({ tags: ['Indie', 'Horror'], name: 'Night Shift', appid: 11, id: 11 }) }, tagIds, 'now', NOW)!
    ];
    await upsertRows(db, 'games', [...GAME_COLUMNS], 'app_id', rows.map((r) => r.values), ['first_seen_at']);
    await upsertRows(db, 'games', [...GAME_COLUMNS], 'app_id', rows.map((r) => r.values), ['first_seen_at']); // idempotent
    assert.equal((await queryGames(db, { section: 'cozy' })).total, 1);
    assert.equal((await queryGames(db, { section: 'indie' })).total, 2);
    assert.equal((await queryGames(db, { genre: 'horror' })).items[0].title, 'Night Shift');
    assert.equal((await queryGames(db, { q: "bramble's" })).items[0].appId, 10);
    assert.equal((await queryGames(db, { q: '100%_' })).total, 0);
    const g = (await queryGames(db, { section: 'cozy' })).items[0];
    assert.equal(g.headerImage, 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1/header.jpg?t=99');
    assert.equal(g.deck, 'verified');
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main();
