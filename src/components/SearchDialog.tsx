/** Quick search across the catalog and news (debounced, cached). */
import { Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { buildUrl, useApi } from '../lib/api';
import { navigate } from '../lib/router';
import type { Article, Game, Paged } from '../shared/content';
import { Dialog } from './Dialog';
import { GameRow } from './GameCard';
import { WireItem } from './ArticleItem';

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [term, setTerm] = useState('');
  const q = useDebounced(term.trim(), 250);
  const games = useApi<Paged<Game>>(q.length >= 2 ? buildUrl('/api/games', { q, limit: 6 }) : null);
  const news = useApi<Paged<Article>>(q.length >= 2 ? buildUrl('/api/news', { q, limit: 4 }) : null);

  useEffect(() => {
    if (!open) setTerm('');
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;
    onClose();
    navigate(buildUrl('/search', { q: term.trim() }));
  };

  const noResults = q.length >= 2 && games.data?.total === 0 && news.data?.total === 0;

  return (
    <Dialog open={open} onClose={onClose} title="Search" wide>
      <form onSubmit={submit} role="search" className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
        <input
          autoFocus
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Game, developer or tag — e.g. “farming”, “ConcernedApe”"
          aria-label="Search games and news"
          className="field pl-9"
        />
      </form>
      <div className="mt-4 min-h-24" aria-live="polite">
        {q.length < 2 && <p className="text-sm text-ink-faint">Type at least two letters.</p>}
        {noResults && <p className="text-sm text-ink-soft">Nothing matches “{q}”. Try a broader word, like a genre or developer.</p>}
        {games.data && games.data.items.length > 0 && (
          <section>
            <h3 className="kicker text-ink-faint">Games · {games.data.total.toLocaleString()} found</h3>
            <div className="divide-y divide-rule" onClick={(e) => (e.target as HTMLElement).closest('a') && onClose()}>
              {games.data.items.map((g) => (
                <GameRow key={g.appId} game={g} />
              ))}
            </div>
            {games.data.total > games.data.items.length && (
              <button type="button" onClick={submit as any} className="mt-2 text-sm font-semibold link-underline">
                See all {games.data.total.toLocaleString()} games
              </button>
            )}
          </section>
        )}
        {news.data && news.data.items.length > 0 && (
          <section className="mt-5">
            <h3 className="kicker text-ink-faint">News</h3>
            {news.data.items.map((a) => (
              <WireItem key={a.id} article={a} />
            ))}
          </section>
        )}
        {(games.error || news.error) && <p className="text-sm text-deal">{(games.error || news.error)!.message}</p>}
      </div>
    </Dialog>
  );
}
