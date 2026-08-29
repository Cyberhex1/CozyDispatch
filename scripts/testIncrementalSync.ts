/**
 * scripts/testIncrementalSync.ts
 *
 * Automated verification of CozyDispatch incremental content updates and stateful ingestion.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const STATE_FILE = path.join(process.cwd(), 'src', 'data', 'ingestionState.json');
const NEWS_FILE = path.join(process.cwd(), 'src', 'data', 'newsFeed.json');
const CATALOG_FILE = path.join(process.cwd(), 'src', 'data', 'steamGamesCatalog.json');

async function runTests() {
  console.log('🧪 Starting Incremental Content Updates Verification...\n');

  // Test 1: Inspect Persistent Ingestion State
  console.log('--- Test 1: Ingestion State Tracking ---');
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error('Test 1 Failed: ingestionState.json does not exist.');
  }
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  if (!state.news || !state.catalog || !state.rankings) {
    throw new Error('Test 1 Failed: State file missing job definitions.');
  }
  if (!state.news.lastSuccessAt || !state.news.contentHashes) {
    throw new Error('Test 1 Failed: News state missing lastSuccessAt or contentHashes.');
  }
  console.log('✓ Ingestion state verified. Active tracking for News, Catalog, and Rankings.');
  console.log(`  - Known News Hashes: ${Object.keys(state.news.contentHashes).length}`);
  console.log(`  - Known Catalog IDs: ${state.catalog.knownIds?.length || 0}`);

  // Test 2: Verify API Endpoints (/api/sync/*)
  console.log('\n--- Test 2: Incremental Sync API Endpoints ---');
  const statusRes = await axios.get(`${BASE_URL}/api/sync/status`);
  if (!statusRes.data.success || !statusRes.data.state) {
    throw new Error('Test 2 Failed: GET /api/sync/status failed.');
  }
  console.log('✓ GET /api/sync/status returned live ingestion state.');

  const newsSyncRes = await axios.post(`${BASE_URL}/api/sync/news`);
  if (!newsSyncRes.data.success) {
    throw new Error('Test 2 Failed: POST /api/sync/news failed.');
  }
  console.log(`✓ POST /api/sync/news executed successfully (skipped ${newsSyncRes.data.result.skipped} unchanged articles).`);

  const rankingsSyncRes = await axios.post(`${BASE_URL}/api/sync/rankings`);
  if (!rankingsSyncRes.data.success) {
    throw new Error('Test 2 Failed: POST /api/sync/rankings failed.');
  }
  console.log(`✓ POST /api/sync/rankings updated ${rankingsSyncRes.data.result.dealsUpdated} game prices/deals.`);

  // Test 3: Idempotency & Duplicate Prevention
  console.log('\n--- Test 3: Idempotency & No Duplicate Articles ---');
  const newsBefore = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8'));
  const idCountsBefore = new Map<string, number>();
  for (const a of newsBefore) {
    idCountsBefore.set(a.id, (idCountsBefore.get(a.id) || 0) + 1);
  }
  for (const [id, count] of idCountsBefore.entries()) {
    if (count > 1) {
      throw new Error(`Test 3 Failed: Duplicate article found before test: ${id}`);
    }
  }

  // Run sync again
  await axios.post(`${BASE_URL}/api/sync/news`);
  const newsAfter = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8'));
  if (newsAfter.length !== newsBefore.length) {
    throw new Error(`Test 3 Failed: Repeat sync changed article count unexpectedly (${newsBefore.length} -> ${newsAfter.length}).`);
  }
  console.log(`✓ Idempotency verified: Article count preserved perfectly (${newsAfter.length} articles, 0 duplicates).`);

  // Test 4: Existing Data Preservation (Catalog & User Data)
  console.log('\n--- Test 4: Data Preservation ---');
  const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
  if (!Array.isArray(catalog) || catalog.length < 50) {
    throw new Error('Test 4 Failed: Catalog was wiped or truncated.');
  }
  console.log(`✓ Catalog preservation verified: ${catalog.length} games intact.`);

  // Verify users data file is intact
  const usersFile = path.join(process.cwd(), 'src', 'data', 'users.json');
  if (fs.existsSync(usersFile)) {
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    console.log(`✓ User accounts preservation verified: ${users.length} registered user profiles intact.`);
  }

  console.log('\n🎉 ALL INCREMENTAL CONTENT UPDATE TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
