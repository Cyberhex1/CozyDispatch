/**
 * Catalog listing used by /cozy, /indie, /deals, /upcoming and /search.
 * All filters live in the URL, so every view can be bookmarked and shared.
 */
import { useEffect, useState } from 'react';
import { buildUrl, useApi } from '../lib/api';
import { Link, setQuery, useLocation } from '../lib/router';
import type { Game, GameSort, Paged } from '../shared/content';
import { GENRE_BY_ID, SECTIONS, type Section } from '../shared/genres';
import { GameTile } from '../components/GameCard';
import { EmptyState, ErrorState, TileSkeletons } from '../components/ui';

export type BrowseMode = Section | 'deals' | 'upcoming' | 'search';

const PAGE_SIZE = 24;

const COPY: Record<BrowseMode, { kicker: string; title: string; blurb: string; accent: string }> = {
  cozy: { kicker: 'Section', title: 'Cozy games', blurb: SECTIONS.cozy.blurb, accent: 'text-cozy' },
  indie: { kicker: 'Section', title: 'Indie games', blurb: SECTIONS.indie.blurb, accent: 'text-indie' },
  deals: { kicker: 'On sale', title: 'Deals', blurb: 'Cozy and indie games discounted on Steam right now. US prices, refreshed several times a day.', accent: 'text-deal' },
  upcoming: { kicker: 'Coming soon', title: 'Upcoming', blurb: 'The most-followed cozy and indie games that haven’t launched yet, with dates as Steam lists them.', accent: 'text-ink-soft' },
  search: { kicker: 'Search', title: 'Search results', blurb: '', accent: 'text-ink-soft' }
};

const SORTS: { id: GameSort; label: string }[] = [
  { id: 'popular', label: 'Popular now' },
  { id: 'rating', label: 'Best reviewed' },
  { id: 'newest', label: 'Newest' },
  { id: 'discount', label: 'Biggest discount' },
  { id: 'price', label: 'Lowest price' }
];

function ResultsPage({ url, onTotal, showSection }: { url: string; onTotal?: (n: number) => void; showSection: boolean }) {
  const { data, error, retry } = useApi<Paged<Game>>(url);
  useEffect(() => {
    if (data && onTotal) onTotal(data.total);
  }, [data, onTotal]);
  if (error) return <div className="col-span-full"><ErrorState message={error.message} onRetry={retry} /></div>;
  if (!data) return <TileSkeletons count={8} />;
  return (
    <>
      {data.items.map((g, i) => (
        <GameTile key={g.appId} game={g} eager={i < 4} showSection={showSection} />
      ))}
    </>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink-soft">
      <span className="shrink-0">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field min-h-9 w-auto py-1 pr-8 text-[13px] font-semibold">
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function BrowsePage({ mode }: { mode: BrowseMode }) {
  const { query } = useLocation();
  const isSection = mode === 'cozy' || mode === 'indie';
  const sectionParam = query.get('section');
  const section: Section | null = isSection ? mode : sectionParam === 'cozy' || sectionParam === 'indie' ? sectionParam : null;
  const genre = query.get('genre') && GENRE_BY_ID[query.get('genre')!] ? query.get('genre') : null;
  const q = (query.get('q') || '').trim();
  const deck = query.get('deck') === 'verified' || query.get('deck') === 'playable' ? query.get('deck')! : '';
  const sale = mode === 'deals' || query.get('sale') === '1';
  const defaultSort: GameSort = mode === 'deals' ? 'discount' : mode === 'upcoming' ? 'upcoming' : 'popular';
  const sort = (mode === 'upcoming' ? 'upcoming' : (query.get('sort') as GameSort)) || defaultSort;

  const filterKey = [mode, section, genre, q, deck, sale, sort].join('|');
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    setPages(1);
    setTotal(null);
  }, [filterKey]);

  const genres = useApi<{ items: { id: string; label: string; count: number }[] }>(buildUrl('/api/genres', { section }));
  const pageUrl = (page: number) =>
    buildUrl('/api/games', {
      section,
      genre,
      q: mode === 'search' ? q : null,
      deck: deck || null,
      sale,
      sort,
      page,
      limit: PAGE_SIZE
    });

  const copy = COPY[mode];
  const genreLabel = genre ? GENRE_BY_ID[genre].label : null;
  const title = mode === 'search' ? (q ? `“${q}”` : 'Search') : genreLabel && isSection ? genreLabel : copy.title;

  return (
    <div>
      <header className="border-b border-rule pb-5">
        <nav aria-label="Breadcrumb" className="kicker flex items-center gap-1.5 text-ink-faint">
          <Link href="/" className="hover:text-ink">Today</Link>
          <span aria-hidden>›</span>
          {genreLabel && isSection ? (
            <Link href={`/${mode}`} className={`${copy.accent} hover:underline`}>{copy.title}</Link>
          ) : (
            <span className={copy.accent}>{copy.kicker}</span>
          )}
        </nav>
        <h1 className="headline mt-2 text-4xl sm:text-5xl">{title}</h1>
        {mode !== 'search' && <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">{genre && isSection ? `${copy.title} that Steam players tag ${GENRE_BY_ID[genre].tags.map((t) => `“${t}”`).join(', ').replace(/, ([^,]*)$/, ' or $1')}.` : copy.blurb}</p>}
      </header>

      {/* Filters */}
      <div className="space-y-3 border-b border-rule py-4">
        {!isSection && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Section">
            {([null, 'cozy', 'indie'] as const).map((s) => (
              <button key={s ?? 'all'} type="button" className="chip" aria-pressed={section === s} onClick={() => setQuery({ section: s, genre: null })}>
                {s ? SECTIONS[s].label : 'Cozy + Indie'}
              </button>
            ))}
          </div>
        )}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Genre">
          <button type="button" className="chip" aria-pressed={!genre} onClick={() => setQuery({ genre: null })}>
            All genres
          </button>
          {genres.data?.items.map((g) => (
            <button key={g.id} type="button" className="chip" aria-pressed={genre === g.id} onClick={() => setQuery({ genre: genre === g.id ? null : g.id })}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {mode !== 'upcoming' && (
            <Select label="Sort" value={sort} onChange={(v) => setQuery({ sort: v === defaultSort ? null : v })} options={SORTS} />
          )}
          <Select
            label="Steam Deck"
            value={deck}
            onChange={(v) => setQuery({ deck: v || null })}
            options={[
              { id: '', label: 'Any' },
              { id: 'verified', label: 'Verified' },
              { id: 'playable', label: 'Verified or Playable' }
            ]}
          />
          {mode !== 'deals' && mode !== 'upcoming' && (
            <button type="button" className="chip" aria-pressed={sale} onClick={() => setQuery({ sale: sale ? null : '1' })}>
              On sale
            </button>
          )}
          <p className="ml-auto text-[13px] text-ink-faint" aria-live="polite">
            {total !== null && `${total.toLocaleString()} game${total === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="mt-8">
          <EmptyState title="Nothing on this shelf">
            {mode === 'search' && !q ? 'Type something in the search box to begin.' : 'Try removing a filter or two.'}
          </EmptyState>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: pages }, (_, i) => (
            <ResultsPage key={`${filterKey}-${i}`} url={pageUrl(i + 1)} onTotal={i === 0 ? setTotal : undefined} showSection={!isSection} />
          ))}
        </div>
      )}

      {total !== null && total > pages * PAGE_SIZE && (
        <div className="mt-10 text-center">
          <button type="button" className="btn-quiet" onClick={() => setPages((p) => p + 1)}>
            Show more · {(total - pages * PAGE_SIZE).toLocaleString()} left
          </button>
        </div>
      )}
    </div>
  );
}
