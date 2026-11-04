/**
 * Builds the weekly newsletter draft from the catalog: the week's best new
 * cozy and indie releases, well-reviewed games on sale, and what launches in
 * the next two weeks. Deterministic: the same data gives the same draft.
 * Games featured in the last four issues are skipped so issues don't repeat.
 */
import type { ID1Database } from '../db/d1Client';

export interface DigestGame {
  appId: number;
  title: string;
  /** Why it's in the issue, e.g. "new this week", "−40%", "out Nov 12". */
  reason: string;
}

export interface DigestSection {
  title: string;
  games: DigestGame[];
}

export interface WeeklyDraft {
  subject: string;
  intro: string;
  appIds: number[];
  sections: DigestSection[];
}

const DAY = 86400;
const MAX_GAMES = 8;
const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const longDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });

async function recentlyFeatured(db: ID1Database): Promise<Set<number>> {
  const { results } = await db
    .prepare('SELECT app_ids_json FROM newsletter_issues ORDER BY created_at DESC LIMIT 4')
    .all<{ app_ids_json: string }>();
  const ids = new Set<number>();
  for (const r of results) {
    try {
      for (const id of JSON.parse(r.app_ids_json || '[]')) ids.add(Number(id));
    } catch {
      /* ignore a malformed row */
    }
  }
  return ids;
}

interface Row {
  app_id: number;
  title: string;
  discount_pct: number;
  release_ts: number | null;
  is_cozy: number;
}

async function rows(db: ID1Database, sql: string, ...params: unknown[]): Promise<Row[]> {
  return (
    await db.prepare(`SELECT app_id, title, discount_pct, release_ts, is_cozy FROM games WHERE ${sql}`).bind(...params).all<Row>()
  ).results;
}

function joinTitles(titles: string[]): string {
  if (titles.length <= 1) return titles[0] ?? '';
  return `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`;
}

export async function buildWeeklyDraft(db: ID1Database, nowMs = Date.now()): Promise<WeeklyDraft> {
  const now = Math.floor(nowMs / 1000);
  const skip = await recentlyFeatured(db);
  const taken = new Set<number>();
  const pick = (list: Row[], n: number) => {
    const out: Row[] = [];
    for (const r of list) {
      if (out.length >= n || skip.has(r.app_id) || taken.has(r.app_id)) continue;
      taken.add(r.app_id);
      out.push(r);
    }
    return out;
  };

  // Ask for more than we need so skipped games can be replaced.
  const [fresh, deals, soon] = await Promise.all([
    rows(
      db,
      `is_coming_soon = 0 AND release_ts BETWEEN ? AND ? AND (is_cozy = 1 OR is_indie = 1)
       ORDER BY is_cozy DESC, review_count DESC, popularity ASC LIMIT 20`,
      now - 7 * DAY,
      now
    ),
    rows(
      db,
      `is_coming_soon = 0 AND discount_pct >= 25 AND review_count >= 500 AND COALESCE(review_percent, 0) >= 80
       ORDER BY is_cozy DESC, popularity ASC LIMIT 20`
    ),
    rows(
      db,
      `is_coming_soon = 1 AND release_label IS NULL AND release_ts BETWEEN ? AND ?
       ORDER BY popularity ASC LIMIT 20`,
      now,
      now + 14 * DAY
    )
  ]);

  const newPicks = pick(fresh, 3);
  const dealPicks = pick(deals, 3);
  const soonPicks = pick(soon, Math.min(2, MAX_GAMES - newPicks.length - dealPicks.length));

  const sections: DigestSection[] = [];
  if (newPicks.length) {
    sections.push({ title: 'New this week', games: newPicks.map((r) => ({ appId: r.app_id, title: r.title, reason: 'new this week' })) });
  }
  if (dealPicks.length) {
    sections.push({ title: 'Worth it on sale', games: dealPicks.map((r) => ({ appId: r.app_id, title: r.title, reason: `−${r.discount_pct}%` })) });
  }
  if (soonPicks.length) {
    sections.push({
      title: 'Coming soon',
      games: soonPicks.map((r) => ({ appId: r.app_id, title: r.title, reason: `out ${monthDay.format(new Date((r.release_ts ?? now) * 1000))}` }))
    });
  }

  const appIds = sections.flatMap((s) => s.games.map((g) => g.appId));
  const lead = newPicks[0] ?? dealPicks[0] ?? soonPicks[0];
  const subject = lead ? `This week in cozy: ${lead.title}${appIds.length > 1 ? ' and more' : ''}` : 'This week in cozy';

  const paragraphs = ['Hello!'];
  if (newPicks.length) paragraphs.push(`New this week: ${joinTitles(newPicks.map((r) => r.title))}.`);
  if (dealPicks.length) {
    paragraphs.push(`On sale and well loved: ${joinTitles(dealPicks.map((r) => `${r.title} (−${r.discount_pct}%)`))}.`);
  }
  if (soonPicks.length) {
    paragraphs.push(
      `Coming in the next two weeks: ${joinTitles(soonPicks.map((r) => `${r.title} on ${longDate.format(new Date((r.release_ts ?? now) * 1000))}`))}.`
    );
  }
  if (!appIds.length) paragraphs.push('A quiet week on Steam. Here’s the latest from Cozy Dispatch.');
  paragraphs.push('Happy playing,\nCozy Dispatch');

  return { subject, intro: paragraphs.join('\n\n'), appIds, sections };
}
