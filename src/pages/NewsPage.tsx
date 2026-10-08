/** News: press stories about catalog games, and official developer updates. */
import { Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { buildUrl, useApi } from '../lib/api';
import { setQuery, useLocation } from '../lib/router';
import type { Article, Paged } from '../shared/content';
import { ArticleRow } from '../components/ArticleItem';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';

const PAGE_SIZE = 20;

function NewsChunk({ url, onTotal }: { url: string; onTotal?: (n: number) => void }) {
  const { data, error, retry } = useApi<Paged<Article>>(url);
  useEffect(() => {
    if (data && onTotal) onTotal(data.total);
  }, [data, onTotal]);
  if (error) return <ErrorState message={error.message} onRetry={retry} />;
  if (!data) return <>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="my-5 h-20 w-full" />)}</>;
  return <>{data.items.map((a) => <ArticleRow key={a.id} article={a} />)}</>;
}

export function NewsPage() {
  const { query } = useLocation();
  const kind = query.get('kind') === 'update' ? 'update' : 'news';
  const section = query.get('section') === 'cozy' || query.get('section') === 'indie' ? query.get('section') : null;
  const q = (query.get('q') || '').trim();
  const [term, setTerm] = useState(q);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const key = [kind, section, q].join('|');

  useEffect(() => {
    setPages(1);
    setTotal(null);
    setTerm(q);
  }, [key, q]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setQuery({ q: term.trim() || null });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <header className="border-b border-rule pb-5">
        <p className="kicker text-ink-faint">Newsroom</p>
        <h1 className="headline mt-2 text-4xl sm:text-5xl">News &amp; updates</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Stories from games sites that mention cozy and indie games we track, and announcements straight from developers on Steam. Every headline links
          to its original source.
        </p>
      </header>

      <div className="flex border-b border-rule" role="tablist" aria-label="Kind of story">
        {(['news', 'update'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={kind === k}
            onClick={() => setQuery({ kind: k === 'news' ? null : k })}
            className={`-mb-px border-b-2 px-1 py-3 mr-6 text-[15px] font-semibold ${kind === k ? 'border-ink text-ink' : 'border-transparent text-ink-faint hover:text-ink'}`}
          >
            {k === 'news' ? 'Press' : 'Developer updates'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2" role="group" aria-label="Section">
          {([null, 'cozy', 'indie'] as const).map((s) => (
            <button key={s ?? 'all'} type="button" className="chip" aria-pressed={section === s} onClick={() => setQuery({ section: s })}>
              {s === 'cozy' ? 'Cozy' : s === 'indie' ? 'Indie' : 'Everything'}
            </button>
          ))}
        </div>
        <form onSubmit={submit} role="search" className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search stories" aria-label="Search stories" className="field min-h-10 pl-9 text-sm" />
        </form>
      </div>

      {total === 0 ? (
        <EmptyState title={q ? `No stories mention “${q}”` : 'No stories here yet'}>
          {kind === 'news' ? 'News is collected every couple of hours. Developer updates usually have something new.' : 'Try another section.'}
        </EmptyState>
      ) : (
        <div>
          {Array.from({ length: pages }, (_, i) => (
            <NewsChunk
              key={`${key}-${i}`}
              url={buildUrl('/api/news', { kind, section, q, page: i + 1, limit: PAGE_SIZE })}
              onTotal={i === 0 ? setTotal : undefined}
            />
          ))}
        </div>
      )}
      {total !== null && total > pages * PAGE_SIZE && (
        <div className="mt-8 text-center">
          <button type="button" className="btn-quiet" onClick={() => setPages((p) => p + 1)}>
            Older stories
          </button>
        </div>
      )}
    </div>
  );
}
