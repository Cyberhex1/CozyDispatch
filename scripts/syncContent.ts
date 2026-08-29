/**
 * scripts/syncContent.ts
 *
 * Incremental Content Ingestion CLI
 * Runs stateful, idempotent updates for news, game catalog, and rankings/deals.
 *
 * Usage:
 *   npx tsx scripts/syncContent.ts
 *   npx tsx scripts/syncContent.ts --target=news
 *   npx tsx scripts/syncContent.ts --target=catalog
 *   npx tsx scripts/syncContent.ts --target=rankings
 *   npx tsx scripts/syncContent.ts --target=all
 */

import dotenv from 'dotenv';
import { 
  syncNewsIncremental, 
  syncCatalogIncremental, 
  syncRankingsIncremental, 
  runAllIncrementalSyncs, 
  loadIngestionState 
} from '../src/services/incrementalSyncService';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const targetArg = args.find(a => a.startsWith('--target='))?.split('=')[1] || 'all';

  console.log(`🚀 Starting Incremental Content Sync (Target: ${targetArg.toUpperCase()})...\n`);
  const startTime = Date.now();

  try {
    if (targetArg === 'news') {
      const res = await syncNewsIncremental(process.env.GEMINI_API_KEY);
      console.log(`📰 News Sync Result:`, res);
    } else if (targetArg === 'catalog') {
      const res = await syncCatalogIncremental();
      console.log(`🎮 Catalog Sync Result:`, res);
    } else if (targetArg === 'rankings') {
      const res = await syncRankingsIncremental();
      console.log(`🏆 Rankings/Deals Sync Result:`, res);
    } else {
      const res = await runAllIncrementalSyncs(process.env.GEMINI_API_KEY);
      console.log(`✨ All Ingestion Jobs Completed:`, JSON.stringify(res, null, 2));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Incremental sync completed in ${duration}s.`);
    const finalState = loadIngestionState();
    console.log(`📊 Ingestion State:`, {
      newsLastSuccess: finalState.news.lastSuccessAt,
      catalogLastSuccess: finalState.catalog.lastSuccessAt,
      rankingsLastSuccess: finalState.rankings.lastSuccessAt
    });
  } catch (err: any) {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  }
}

main();
