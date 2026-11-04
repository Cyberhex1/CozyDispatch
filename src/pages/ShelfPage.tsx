/** The reader's shelf: saved games with status and notes, their lists, and bookmarked stories. */
import { useState } from 'react';
import { buildUrl, useApi } from '../lib/api';
import { Link } from '../lib/router';
import { useSaved } from '../lib/saved';
import { SHELF_STATUSES, SHELF_STATUS_LABEL, type ShelfStatus } from '../shared/account';
import type { Article, Game } from '../shared/content';
import { GameTile } from '../components/GameCard';
import { ArticleRow } from '../components/ArticleItem';
import { ShelfNote, StatusSelect } from '../components/ShelfControls';
import { useMyLists } from '../components/AddToListDialog';
import { EmptyState, ErrorState, SectionHeader, TileSkeletons } from '../components/ui';
import { createList, listPath } from '../services/listsApi';
import { navigate } from '../lib/router';
import { timeAgo } from '../lib/format';

function ShelfTile({ game }: { game: Game }) {
  return (
    <div className="flex flex-col">
      <GameTile game={game} showSection />
      <div className="mt-2 space-y-1.5 border-t border-rule pt-2">
        <StatusSelect appId={game.appId} title={game.title} />
        <ShelfNote appId={game.appId} title={game.title} />
      </div>
    </div>
  );
}

function YourLists() {
  const { account, showNotice } = useSaved();
  const { lists, error, reload } = useMyLists(Boolean(account));
  const [creating, setCreating] = useState(false);
  if (!account) return null;

  const create = async () => {
    setCreating(true);
    try {
      const made = await createList({ title: 'Untitled list' });
      navigate(`${listPath(made)}?edit=1`);
    } catch (err: any) {
      showNotice(err?.message || 'Couldn’t make a list.');
      setCreating(false);
    }
  };

  return (
    <section className="mt-12">
      <SectionHeader kicker="Share your picks" title="Your lists">
        <p className="mt-1 max-w-[60ch] text-[14px] text-ink-soft">Lists have their own page that anyone with the link can see. Add games from any game page.</p>
      </SectionHeader>
      {error && <ErrorState message={error} onRetry={reload} />}
      {lists && lists.length > 0 && (
        <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {lists.map((l) => (
            <li key={l.id} className="border-b border-rule">
              <Link href={listPath(l)} className="group flex items-baseline justify-between gap-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-display text-[18px] text-ink group-hover:underline decoration-1 underline-offset-2">{l.title}</span>
                  {l.description && <span className="block truncate text-[13px] text-ink-soft">{l.description}</span>}
                </span>
                <span className="shrink-0 text-right text-[12px] text-ink-faint">
                  {l.appIds.length} game{l.appIds.length === 1 ? '' : 's'}
                  <span className="block">updated {timeAgo(l.updatedAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {lists && lists.length === 0 && <p className="text-[15px] text-ink-soft">No lists yet. Start one for a season, a mood, or a friend who needs recommendations.</p>}
      <button type="button" onClick={create} disabled={creating} className="btn-quiet mt-5">
        {creating ? 'Starting…' : 'Start a new list'}
      </button>
    </section>
  );
}

export function ShelfPage({ onAccount }: { onAccount: () => void }) {
  const { account, wishlist, bookmarks, shelfEntry } = useSaved();
  const [filter, setFilter] = useState<ShelfStatus | 'all'>('all');
  const games = useApi<{ items: Game[] }>(wishlist.length ? buildUrl('/api/games', { ids: wishlist.slice(0, 100).join(',') }) : null);
  const articles = useApi<{ items: Article[] }>(bookmarks.length ? buildUrl('/api/news', { ids: bookmarks.slice(0, 100).join(','), limit: 50 }) : null);

  // The API answers in the order asked, but keep the newest-first order of the shelf when it changes.
  const byId = new Map((games.data?.items ?? []).map((g) => [g.appId, g]));
  const items = wishlist.map((id) => byId.get(id)).filter((g): g is Game => Boolean(g));
  const onSale = items.filter((g) => g.discountPct > 0 && shelfEntry(g.appId).status === 'want');
  const released = items.filter((g) => !g.comingSoon);
  const upcoming = items.filter((g) => g.comingSoon);
  const counts = Object.fromEntries(SHELF_STATUSES.map((s) => [s, released.filter((g) => shelfEntry(g.appId).status === s).length])) as Record<ShelfStatus, number>;
  const shown = filter === 'all' ? released : released.filter((g) => shelfEntry(g.appId).status === filter);
  const missing = games.data ? wishlist.slice(0, 100).length - (games.data.items.length) : 0;

  return (
    <div>
      <header className="border-b border-rule pb-5">
        <p className="kicker text-ink-faint">Your shelf</p>
        <h1 className="headline mt-2 text-4xl sm:text-5xl">Saved for later</h1>
        {account === null && (
          <p className="mt-3 max-w-[62ch] text-[15px] text-ink-soft">
            These are saved in this browser only.{' '}
            <button type="button" onClick={onAccount} className="font-semibold text-ink link-underline">
              Sign in or create an account
            </button>{' '}
            to keep them on every device and make lists you can share.
          </p>
        )}
      </header>

      {wishlist.length === 0 && bookmarks.length === 0 && (
        <div className="mt-8">
          <EmptyState title="Nothing saved yet">
            Tap the heart on any game to keep it here, and the bookmark on any story. We’ll show you when saved games go on sale.{' '}
            <Link href="/cozy" className="font-semibold text-ink link-underline">Start with the cozy section</Link>.
          </EmptyState>
        </div>
      )}

      {games.error && <div className="mt-8"><ErrorState message={games.error.message} onRetry={games.retry} /></div>}

      {onSale.length > 0 && (
        <section className="mt-10">
          <SectionHeader kicker="Good news" title={`${onSale.length} game${onSale.length === 1 ? '' : 's'} you want ${onSale.length === 1 ? 'is' : 'are'} on sale`} accent="deal" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-6 lg:grid-cols-4">
            {onSale.map((g) => <GameTile key={g.appId} game={g} />)}
          </div>
        </section>
      )}

      {wishlist.length > 0 && (
        <section className="mt-10">
          <SectionHeader kicker="Games" title="Your games" />
          {released.length > 0 && (
            <div role="group" aria-label="Show games by status" className="no-scrollbar -mt-1 mb-6 flex gap-2 overflow-x-auto">
              <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
                All <span className="tabular-nums opacity-70">{released.length}</span>
              </button>
              {SHELF_STATUSES.map((s) => (
                <button key={s} type="button" className="chip" aria-pressed={filter === s} onClick={() => setFilter(s)}>
                  {SHELF_STATUS_LABEL[s]} <span className="tabular-nums opacity-70">{counts[s]}</span>
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
            {games.loading ? <TileSkeletons count={Math.min(8, wishlist.length)} /> : shown.map((g) => <ShelfTile key={g.appId} game={g} />)}
          </div>
          {!games.loading && released.length > 0 && shown.length === 0 && (
            <p className="text-[15px] text-ink-soft">Nothing marked “{SHELF_STATUS_LABEL[filter as ShelfStatus]}” yet. Change a game’s status under its picture.</p>
          )}
          {missing > 0 && <p className="mt-4 text-[13px] text-ink-faint">{missing} saved game{missing === 1 ? ' is' : 's are'} no longer in our catalog.</p>}
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mt-10">
          <SectionHeader kicker="Coming soon" title="Waiting for launch" href="/calendar" linkLabel="Release calendar" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-6 lg:grid-cols-4">
            {upcoming.map((g) => <GameTile key={g.appId} game={g} />)}
          </div>
        </section>
      )}

      <YourLists />

      {bookmarks.length > 0 && (
        <section className="mt-12 max-w-3xl">
          <SectionHeader kicker="Reading list" title="Bookmarked stories" />
          {articles.data?.items.map((a) => <ArticleRow key={a.id} article={a} />)}
          {articles.data && articles.data.items.length < bookmarks.length && (
            <p className="mt-4 text-[13px] text-ink-faint">Stories older than four months are cleared from the archive.</p>
          )}
        </section>
      )}
    </div>
  );
}
