/**
 * Refreshes the game catalog and news.
 *
 *   npm run sync                 # catalog + news into the local dev database (.data/)
 *   npm run sync -- --target=news
 *   npm run sync -- --remote     # write to production D1 (used by the GitHub Action)
 *
 * --remote needs CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (D1 Edit) and
 * D1_DATABASE_ID in the environment.
 */
import 'dotenv/config';
import { createLocalD1 } from '../src/server/db/localSqlite';
import { createHttpD1 } from '../src/sync/d1Http';
import { syncCatalog } from '../src/sync/catalogSync';
import { syncNews } from '../src/sync/newsSync';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'] as const;
  })
);
const target = args.get('target') ?? 'all';
const remote = args.get('remote') === 'true';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. See README → "Automatic updates".`);
    process.exit(1);
  }
  return v;
}

const db = remote
  ? createHttpD1({
      accountId: requireEnv('CLOUDFLARE_ACCOUNT_ID'),
      apiToken: requireEnv('CLOUDFLARE_API_TOKEN'),
      databaseId: requireEnv('D1_DATABASE_ID')
    })
  : createLocalD1();

const log = (m: string) => console.log(m);

async function main() {
  console.log(`Syncing ${target} → ${remote ? 'production D1' : 'local database'}`);
  let failed = false;
  if (target === 'all' || target === 'catalog') {
    const t = Date.now();
    try {
      const r = await syncCatalog(db, log);
      console.log(`Catalog: kept ${r.kept} of ${r.discovered} discovered (cozy ${r.cozy}, indie ${r.indie}), removed ${r.removedStale} stale — ${((Date.now() - t) / 1000).toFixed(0)}s`);
    } catch (err: any) {
      failed = true;
      console.error('Catalog sync failed:', err?.message || err);
    }
  }
  if (target === 'all' || target === 'news') {
    try {
      const r = await syncNews(db, log);
      const kept = Object.values(r.feeds).reduce((n, f) => n + f.kept, 0);
      console.log(`News: ${kept} press stories, ${r.updates} developer updates, removed ${r.removedOld} old`);
      if (Object.values(r.feeds).every((f) => f.error)) failed = true;
    } catch (err: any) {
      failed = true;
      console.error('News sync failed:', err?.message || err);
    }
  }
  process.exit(failed ? 1 : 0);
}

main();
