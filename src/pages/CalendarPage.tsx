/**
 * Release calendar: cozy and indie games by the day Steam says they come out,
 * this month first. Vague dates ("Q2 2027", "To be announced") are grouped at the end.
 */
import { CalendarPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildUrl, useApi } from '../lib/api';
import { Link, setQuery, useLocation } from '../lib/router';
import { useSaved } from '../lib/saved';
import { downloadIcs, hasExactDate } from '../lib/ics';
import type { Game } from '../shared/content';
import { GameRow } from '../components/GameCard';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_LABEL_RE = new RegExp(`^(${MONTHS.join('|')}) (\\d{4})$`);
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
const PER_MONTH = 30;

interface Day {
  day: number | null; // null: "sometime this month"
  date: Date | null;
  games: Game[];
}

interface Month {
  key: string; // 2026-11
  label: string;
  days: Day[];
  count: number;
}

function group(games: Game[]) {
  const months = new Map<string, { label: string; byDay: Map<number, Game[]>; loose: Game[] }>();
  const later = new Map<string, Game[]>();
  const monthOf = (y: number, m: number) => {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    if (!months.has(key)) months.set(key, { label: `${MONTHS[m]} ${y}`, byDay: new Map(), loose: [] });
    return months.get(key)!;
  };

  for (const g of games) {
    if (hasExactDate(g)) {
      const d = new Date(g.releaseDate!);
      const m = monthOf(d.getUTCFullYear(), d.getUTCMonth());
      const list = m.byDay.get(d.getUTCDate()) ?? [];
      list.push(g);
      m.byDay.set(d.getUTCDate(), list);
      continue;
    }
    const match = g.releaseLabel ? MONTH_LABEL_RE.exec(g.releaseLabel) : null;
    if (match) {
      monthOf(Number(match[2]), MONTHS.indexOf(match[1])).loose.push(g);
      continue;
    }
    const label = g.releaseLabel || 'Date not announced';
    later.set(label, [...(later.get(label) ?? []), g]);
  }

  const ordered: Month[] = [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, m]) => {
      const [y, mo] = key.split('-').map(Number);
      const days: Day[] = [...m.byDay.entries()]
        .sort(([a], [b]) => a - b)
        .map(([day, list]) => ({ day, date: new Date(Date.UTC(y, mo - 1, day)), games: list }));
      if (m.loose.length) days.push({ day: null, date: null, games: m.loose });
      return { key, label: m.label, days, count: days.reduce((n, d) => n + d.games.length, 0) };
    });

  // Quarters and years in time order, then the open-ended labels.
  const rank = (label: string) => {
    const q = /^Q([1-4]) (\d{4})$/.exec(label);
    if (q) return Number(q[2]) * 10 + Number(q[1]);
    const y = /^(\d{4})$/.exec(label);
    if (y) return Number(y[1]) * 10 + 5;
    return label === 'Coming soon' ? 1e6 : label === 'To be announced' ? 1e6 + 1 : 1e6 + 2;
  };
  const vague = [...later.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  return { months: ordered, vague };
}

function AddToCalendar({ game }: { game: Game }) {
  return (
    <button
      type="button"
      onClick={() => downloadIcs([game], `${game.slug || game.appId}-release.ics`)}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-faint transition hover:bg-rule/50 hover:text-ink"
      aria-label={`Add ${game.title}’s release to your calendar`}
      title="Add to calendar"
    >
      <CalendarPlus className="h-4 w-4" aria-hidden />
    </button>
  );
}

function MonthSection({ month, isCurrent, todayDay }: { month: Month; isCurrent: boolean; todayDay: number }) {
  const [expanded, setExpanded] = useState(false);
  let budget = expanded ? Infinity : PER_MONTH;
  const days = month.days
    .map((d) => {
      const games = d.games.slice(0, Math.max(0, budget));
      budget -= games.length;
      return { ...d, games };
    })
    .filter((d) => d.games.length);
  const hidden = month.count - days.reduce((n, d) => n + d.games.length, 0);

  return (
    <section className="mt-12 first:mt-8" aria-labelledby={`m-${month.key}`}>
      <header className="flex items-end justify-between gap-4 border-t-2 border-rule-strong pt-3">
        <div>
          {isCurrent && <p className="kicker mb-1 text-cozy">This month</p>}
          <h2 id={`m-${month.key}`} className="headline text-2xl sm:text-[28px]">{month.label}</h2>
        </div>
        <p className="pb-1 text-[13px] tabular-nums text-ink-faint">{month.count} game{month.count === 1 ? '' : 's'}</p>
      </header>
      <ol>
        {days.map((d) => {
          const out = isCurrent && d.day !== null && d.day <= todayDay;
          return (
            <li key={d.day ?? 'loose'} className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-4 border-b border-rule py-1 sm:grid-cols-[88px_minmax(0,1fr)]">
              <div className="pt-3.5">
                {d.day !== null ? (
                  <>
                    <p className={`font-display text-[28px] leading-none tabular-nums ${out ? 'text-ink-faint' : 'text-ink'}`}>{d.day}</p>
                    <p className="kicker mt-1 text-ink-faint">{out ? (d.day === todayDay ? 'Today' : 'Out now') : weekday.format(d.date!)}</p>
                  </>
                ) : (
                  <p className="kicker pt-1 leading-snug text-ink-faint">Day not set</p>
                )}
              </div>
              <div className="divide-y divide-rule/70">
                {d.games.map((g) => (
                  <div key={g.appId} className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <GameRow game={g} meta={`${g.cozy ? 'Cozy' : 'Indie'} · ${g.developers[0] ?? 'Unknown developer'}`} />
                    </div>
                    {hasExactDate(g) && !out && <AddToCalendar game={g} />}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      {hidden > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className="btn-quiet mt-4">
          Show {hidden} more in {month.label.split(' ')[0]}
        </button>
      )}
    </section>
  );
}

export function CalendarPage() {
  const { query } = useLocation();
  const { wishlist } = useSaved();
  const section = query.get('section') === 'cozy' || query.get('section') === 'indie' ? query.get('section')! : '';
  const mine = query.get('saved') === '1';
  const { data, error, retry } = useApi<{ items: Game[] }>(buildUrl('/api/calendar', { section: section || undefined }));

  const saved = useMemo(() => new Set(wishlist), [wishlist]);
  const games = useMemo(() => (data?.items ?? []).filter((g) => !mine || saved.has(g.appId)), [data, mine, saved]);
  const { months, vague } = useMemo(() => group(games), [games]);
  const savedUpcoming = (data?.items ?? []).filter((g) => saved.has(g.appId) && g.comingSoon && hasExactDate(g));

  const now = new Date();
  const currentKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  return (
    <div>
      <header className="border-b border-rule pb-5">
        <p className="kicker text-ink-faint">Release calendar</p>
        <h1 className="headline mt-2 text-4xl sm:text-5xl">What’s coming out, and when</h1>
        <p className="mt-3 max-w-[62ch] text-[15px] text-ink-soft">
          Cozy and indie games by the date Steam lists today. Developers move dates often, so we refresh them several times a day.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {[
            { id: '', label: 'Everything' },
            { id: 'cozy', label: 'Cozy' },
            { id: 'indie', label: 'Indie' }
          ].map((s) => (
            <button key={s.id || 'all'} type="button" className="chip" aria-pressed={section === s.id} onClick={() => setQuery({ section: s.id || null })}>
              {s.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-rule" aria-hidden />
          <button type="button" className="chip" aria-pressed={mine} onClick={() => setQuery({ saved: mine ? null : '1' })}>
            Only my saved games
          </button>
          {savedUpcoming.length > 0 && (
            <button
              type="button"
              className="chip"
              onClick={() => downloadIcs(savedUpcoming, 'cozy-dispatch-my-releases.ics')}
              title="Download a calendar file with every saved game that has a release date"
            >
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Add my {savedUpcoming.length} saved release{savedUpcoming.length === 1 ? '' : 's'} to my calendar
            </button>
          )}
        </div>
      </header>

      {error && <div className="mt-8"><ErrorState message={error.message} onRetry={retry} /></div>}
      {!data && !error && (
        <div className="mt-8 space-y-3">
          <Skeleton className="h-8 w-48" />
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}
      {data && games.length === 0 && (
        <div className="mt-8">
          <EmptyState title={mine ? 'None of your saved games have a date yet' : 'No releases to show'}>
            {mine ? 'Save upcoming games with the heart and they’ll appear here.' : 'Try a different section.'}
          </EmptyState>
        </div>
      )}

      {months.map((m) => (
        <MonthSection key={m.key} month={m} isCurrent={m.key === currentKey} todayDay={now.getUTCDate()} />
      ))}

      {vague.length > 0 && (
        <section className="mt-14">
          <header className="border-t-2 border-rule-strong pt-3">
            <p className="kicker mb-1 text-ink-faint">Further out</p>
            <h2 className="headline text-2xl sm:text-[28px]">No exact date yet</h2>
          </header>
          <div className="mt-2 grid grid-cols-1 gap-x-10 md:grid-cols-2">
            {vague.map(([label, list]) => (
              <div key={label} className="mt-4">
                <h3 className="kicker border-b border-rule pb-2 text-ink-soft">{label} <span className="tabular-nums text-ink-faint">· {list.length}</span></h3>
                <div className="divide-y divide-rule/70">
                  {list.slice(0, 12).map((g) => <GameRow key={g.appId} game={g} />)}
                </div>
                {list.length > 12 && (
                  <p className="pt-2 text-[13px] text-ink-faint">
                    and {list.length - 12} more in <Link href="/upcoming" className="font-semibold text-ink link-underline">Upcoming</Link>
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
