/**
 * scripts/fetchNews.ts
 *
 * Real Cozy & Indie Gaming News Ingestion Pipeline
 * Fetches RSS feeds from Rock Paper Shotgun, Eurogamer, Nintendo Life, Siliconera, PC Gamer,
 * and Steam News API for top cozy titles.
 * Deduplicates, scores cozy relevance, optionally classifies with Gemini, and outputs src/data/newsFeed.json.
 *
 * Usage:
 *   npx tsx scripts/fetchNews.ts
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { runFullNewsIngestion } from '../src/services/newsService';

dotenv.config();

const OUTPUT_FILE = path.resolve(process.cwd(), 'src', 'data', 'newsFeed.json');

async function main() {
  console.log('📰 CozyDispatch News Feed Ingestion starting...');
  const startTime = Date.now();

  try {
    const articles = await runFullNewsIngestion(process.env.GEMINI_API_KEY);
    
    await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
    await writeFile(OUTPUT_FILE, JSON.stringify(articles, null, 2), 'utf-8');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Successfully saved ${articles.length} real news articles to src/data/newsFeed.json in ${duration}s.`);
  } catch (error: any) {
    console.error('❌ Ingestion failed:', error);
    process.exit(1);
  }
}

main();
