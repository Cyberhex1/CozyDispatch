/** The reader's shelf: saved games (with what's on sale) and bookmarked stories. */
import { buildUrl, useApi } from '../lib/api';
import { Link } from '../lib/router';
import { useSaved } from '../lib/saved';
import type { Article, Game } from '../shared/content';
import { GameTile } from '../components/GameCard';
import { ArticleRow } from '../components/ArticleItem';
import { EmptyState, ErrorState, SectionHeader, TileSkeletons } from '../components/ui';

export function ShelfPage({ onAccount }: { onAccount: () => void }) {
  const { account, wishlist, bookmarks } = useSaved();
  const games = useApi<{ items: Game[] }>(wishlist.length ? buildUrl('/api/games', { ids: wishlist.slice(0, 100).join(',') }) : null);
  const articles = useApi<{ items: Article[] }>(bookmarks.length ? buildUrl('/api/news', { ids: bookmarks.slice(0, 100).join(','), limit: 50 }) : null);

  const items = games.data?.items ?? [];
  const onSale = items.filter((g) => g.discountPct > 0);
  const released = items.filter((g) => !g.comingSoon);
  const upcoming = items.filter((g) => g.comingSoon);
  const missing = games.data ? wishlist.slice(0, 100).length - items.length : 0;

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
            to keep them on every device.
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
          <SectionHeader kicker="Good news" title={`${onSale.length} of your games ${onSale.length === 1 ? 'is' : 'are'} on sale`} accent="deal" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-6 lg:grid-cols-4">
            {onSale.map((g) => <GameTile key={g.appId} game={g} />)}
          </div>
        </section>
      )}

      {wishlist.length > 0 && (
        <section className="mt-10">
          <SectionHeader kicker="Games" title="Your games" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-6 lg:grid-cols-4">
            {games.loading ? <TileSkeletons count={Math.min(8, wishlist.length)} /> : released.map((g) => <GameTile key={g.appId} game={g} showSection />)}
          </div>
          {missing > 0 && <p className="mt-4 text-[13px] text-ink-faint">{missing} saved game{missing === 1 ? ' is' : 's are'} no longer in our catalog.</p>}
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mt-10">
          <SectionHeader kicker="Coming soon" title="Waiting for launch" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-6 lg:grid-cols-4">
            {upcoming.map((g) => <GameTile key={g.appId} game={g} />)}
          </div>
        </section>
      )}

      {bookmarks.length > 0 && (
        <section className="mt-10 max-w-3xl">
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
