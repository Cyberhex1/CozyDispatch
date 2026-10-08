/** Front page: today's lead, the news wire, new releases, and the two sections side by side. */
import { useApi } from '../lib/api';
import { gamePath, Link } from '../lib/router';
import { releaseText, reviewText, timeAgo } from '../lib/format';
import type { Game, HomeFeed } from '../shared/content';
import { SECTIONS } from '../shared/genres';
import { GameRow, GameTile } from '../components/GameCard';
import { WireItem } from '../components/ArticleItem';
import { DeckLabel, EmptyState, ErrorState, PriceTag, SaveGameButton, SectionHeader, Skeleton, TileSkeletons } from '../components/ui';

function Lead({ game, isNew }: { game: Game; isNew: boolean }) {
  const image = game.heroImage || game.capsuleImage || game.headerImage;
  const review = reviewText(game);
  return (
    <article className="group relative">
      <Link href={gamePath(game)} className="block overflow-hidden rounded-sm bg-rule/40" tabIndex={-1} aria-hidden>
        {image && (
          <img
            src={image}
            alt=""
            fetchPriority="high"
            className="aspect-[16/8] w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          />
        )}
      </Link>
      <div className="mt-4">
        <p className={`kicker ${game.cozy ? 'text-cozy' : 'text-indie'}`}>
          {isNew ? 'New this month' : 'Popular now'} · {game.cozy ? 'Cozy' : 'Indie'}
        </p>
        <h1 className="headline mt-1.5 text-[34px] leading-[1.05] sm:text-5xl">
          <Link href={gamePath(game)} className="hover:underline decoration-2 underline-offset-4">
            {game.title}
          </Link>
        </h1>
        {game.description && <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-ink-soft">{game.description}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-soft">
          {game.developers[0] && <span>by {game.developers[0]}</span>}
          {review && <span>{review} reviews</span>}
          <DeckLabel status={game.deck} />
          <PriceTag game={game} />
          <SaveGameButton game={game} />
        </div>
      </div>
    </article>
  );
}

function GenreIndex() {
  const cozy = useApi<{ items: { id: string; label: string; count: number }[] }>('/api/genres?section=cozy');
  const indie = useApi<{ items: { id: string; label: string; count: number }[] }>('/api/genres?section=indie');
  const block = (section: 'cozy' | 'indie', items?: { id: string; label: string; count: number }[]) => (
    <div>
      <p className={`kicker mb-2 ${section === 'cozy' ? 'text-cozy' : 'text-indie'}`}>{SECTIONS[section].label}</p>
      <p className="mb-3 text-sm text-ink-soft">{SECTIONS[section].blurb}</p>
      <ul className="flex flex-wrap gap-2">
        {items
          ? items.map((g) => (
              <li key={g.id}>
                <Link href={`/${section}?genre=${g.id}`} className="chip">
                  {g.label} <span className="tabular-nums text-ink-faint">{g.count.toLocaleString()}</span>
                </Link>
              </li>
            ))
          : Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-9 w-24 rounded-full" />)}
      </ul>
    </div>
  );
  return (
    <section className="mt-14">
      <SectionHeader kicker="Browse" title="Every shelf in the shop" />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {block('cozy', cozy.data?.items)}
        {block('indie', indie.data?.items)}
      </div>
    </section>
  );
}

export function HomePage() {
  const { data, error, retry } = useApi<HomeFeed>('/api/home');

  if (error) return <ErrorState message={error.message} onRetry={retry} />;

  if (data && data.stats.games === 0) {
    return (
      <EmptyState title="The shelves are still empty">
        The catalog hasn’t been synced from Steam yet. Locally, run <code>npm run sync</code>; in production the scheduled sync fills it automatically.
      </EmptyState>
    );
  }

  return (
    <div>
      {/* Lead + wire */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {data?.lead ? (
          <Lead game={data.lead} isNew={Boolean(data.lead.releaseDate && Date.now() - Date.parse(data.lead.releaseDate) < 31 * 86400_000)} />
        ) : (
          <div>
            <Skeleton className="aspect-[16/8] w-full" />
            <Skeleton className="mt-4 h-10 w-2/3" />
            <Skeleton className="mt-3 h-4 w-full" />
          </div>
        )}
        <aside aria-labelledby="wire-heading" className="lg:border-l lg:border-rule lg:pl-8">
          <div className="flex items-baseline justify-between border-t-2 border-rule-strong pt-3">
            <h2 id="wire-heading" className="headline text-xl">The wire</h2>
            {data?.stats.newsUpdatedAt && <span className="text-[12px] text-ink-faint">updated {timeAgo(data.stats.newsUpdatedAt)}</span>}
          </div>
          {data ? (
            data.news.length ? (
              data.news.map((a) => <WireItem key={a.id} article={a} />)
            ) : (
              <p className="py-4 text-sm text-ink-soft">No stories yet today. Check the developer updates below.</p>
            )
          ) : (
            Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="my-4 h-10 w-full" />)
          )}
          <Link href="/news" className="mt-3 inline-block text-sm font-semibold link-underline">
            All news &amp; updates
          </Link>
        </aside>
      </div>

      {/* New releases */}
      <section className="mt-14">
        <SectionHeader kicker="Out now" title="New releases worth a look" href="/cozy?sort=newest" linkLabel="Newest">
          <p className="mt-1 text-sm text-ink-soft">Released in the last 30 days, most-reviewed first.</p>
        </SectionHeader>
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-6 lg:grid-cols-4">
          {data ? data.newReleases.slice(0, 8).map((g) => <GameTile key={g.appId} game={g} showSection />) : <TileSkeletons />}
        </div>
      </section>

      {/* The two sections */}
      <div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-2">
        {(['cozy', 'indie'] as const).map((section) => {
          const games = section === 'cozy' ? data?.cozyPopular : data?.indiePopular;
          return (
            <section key={section} className={section === 'indie' ? 'md:border-l md:border-rule md:pl-8' : ''}>
              <SectionHeader kicker={SECTIONS[section].label} title="Popular right now" accent={section} href={`/${section}`} linkLabel={`All ${section} games`} />
              <div className="divide-y divide-rule">
                {games
                  ? games.map((g, i) => <GameRow key={g.appId} game={g} rank={i + 1} />)
                  : Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="my-3 h-12 w-full" />)}
              </div>
            </section>
          );
        })}
      </div>

      {/* Deals */}
      {(!data || data.deals.length > 0) && (
        <section className="mt-14">
          <SectionHeader kicker="On sale" title="Well-loved games, marked down" accent="deal" href="/deals" linkLabel="All deals">
            <p className="mt-1 text-sm text-ink-soft">Steam prices in USD, checked every few hours.</p>
          </SectionHeader>
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-6 lg:grid-cols-4">
            {data ? data.deals.slice(0, 8).map((g) => <GameTile key={g.appId} game={g} />) : <TileSkeletons count={4} />}
          </div>
        </section>
      )}

      {/* Upcoming + developer updates */}
      <div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-2">
        <section>
          <SectionHeader kicker="On the horizon" title="Most-anticipated" href="/upcoming" linkLabel="All upcoming" />
          <div className="divide-y divide-rule">
            {data
              ? data.upcoming.map((g) => <GameRow key={g.appId} game={g} meta={`${releaseText(g) ?? 'Date to be announced'} · ${g.cozy ? 'Cozy' : 'Indie'}`} />)
              : Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="my-3 h-12 w-full" />)}
          </div>
        </section>
        <section className="md:border-l md:border-rule md:pl-8">
          <SectionHeader kicker="Patch notes & announcements" title="From the developers" href="/news?kind=update" linkLabel="All updates" />
          {data
            ? data.updates.map((a) => <WireItem key={a.id} article={a} />)
            : Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="my-4 h-10 w-full" />)}
        </section>
      </div>

      <GenreIndex />
    </div>
  );
}
