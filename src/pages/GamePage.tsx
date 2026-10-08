/** A game's own page: facts from Steam, developer updates, press mentions and related games. */
import { ExternalLink } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useApi } from '../lib/api';
import { Link } from '../lib/router';
import { DECK_LABEL, formatDate, releaseText, timeAgo } from '../lib/format';
import type { Article, Game } from '../shared/content';
import { GENRE_BY_ID } from '../shared/genres';
import { GameTile } from '../components/GameCard';
import { WireItem } from '../components/ArticleItem';
import { EmptyState, ErrorState, PriceTag, SaveGameButton, SectionHeader, Skeleton } from '../components/ui';

interface GameResponse {
  game: Game;
  related: Game[];
  articles: Article[];
}

const DECK_EXPLAINER: Record<Game['deck'], string> = {
  verified: 'Valve has tested it: it works great on Steam Deck out of the box.',
  playable: 'Valve has tested it: it works, but may need some fiddling (small text, a launcher, etc.).',
  unsupported: 'Valve has tested it and it doesn’t currently run well on Steam Deck.',
  unknown: 'Valve hasn’t tested this game on Steam Deck yet.'
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-rule py-3 last:border-b-0">
      <dt className="kicker text-ink-faint">{label}</dt>
      <dd className="mt-1 text-[15px] text-ink">{children}</dd>
    </div>
  );
}

function DeveloperUpdates({ appId }: { appId: number }) {
  const { data, error } = useApi<{ items: Article[] }>(`/api/games/${appId}/updates`);
  if (error) return <p className="text-sm text-ink-soft">Couldn’t load updates from Steam right now.</p>;
  if (!data) return <Skeleton className="h-24 w-full" />;
  if (data.items.length === 0) return <p className="text-sm text-ink-soft">No announcements from the developer on Steam yet.</p>;
  return (
    <div>
      {data.items.map((a) => (
        <article key={a.id} className="border-b border-rule py-4 last:border-b-0">
          <p className="text-[12px] text-ink-faint">
            <time dateTime={a.publishedAt}>{timeAgo(a.publishedAt)}</time>
          </p>
          <h3 className="mt-1 font-display text-lg leading-snug">
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="hover:underline decoration-1 underline-offset-2">
              {a.title}
            </a>
          </h3>
          {a.summary && <p className="mt-1 line-clamp-3 text-[15px] leading-relaxed text-ink-soft">{a.summary}</p>}
        </article>
      ))}
    </div>
  );
}

export function GamePage({ appId }: { appId: number }) {
  const { data, error, retry } = useApi<GameResponse>(`/api/games/${appId}`);
  const game = data?.game;

  useEffect(() => {
    if (game) document.title = `${game.title} — Cozy Dispatch`;
    return () => {
      document.title = 'Cozy Dispatch — Cozy & indie PC games, updated daily';
    };
  }, [game]);

  if (error) {
    return error.message.includes('isn’t in the catalog') ? (
      <EmptyState title="That game isn’t on our shelves">
        It may have dropped out of the cozy and indie catalog, or the link is wrong.{' '}
        <Link href="/" className="font-semibold link-underline">Back to today’s edition</Link>
      </EmptyState>
    ) : (
      <ErrorState message={error.message} onRetry={retry} />
    );
  }

  if (!game) {
    return (
      <div>
        <Skeleton className="aspect-[32/10] w-full" />
        <Skeleton className="mt-6 h-12 w-1/2" />
        <Skeleton className="mt-4 h-4 w-3/4" />
      </div>
    );
  }

  const section = game.cozy ? 'cozy' : 'indie';
  const firstGenre = game.genres.find((g) => GENRE_BY_ID[g] && !(section === 'cozy' && GENRE_BY_ID[g].onlySection === 'indie'));
  const banner = game.heroImage || game.capsuleImage || game.headerImage;
  const release = releaseText(game);

  return (
    <article>
      <nav aria-label="Breadcrumb" className="kicker mb-4 flex flex-wrap items-center gap-1.5 text-ink-faint">
        <Link href="/" className="hover:text-ink">Today</Link>
        <span aria-hidden>›</span>
        <Link href={`/${section}`} className={`${game.cozy ? 'text-cozy' : 'text-indie'} hover:underline`}>
          {game.cozy ? 'Cozy' : 'Indie'}
        </Link>
        {firstGenre && (
          <>
            <span aria-hidden>›</span>
            <Link href={`/${section}?genre=${firstGenre}`} className="hover:text-ink">{GENRE_BY_ID[firstGenre].label}</Link>
          </>
        )}
      </nav>

      {banner && (
        <div className="overflow-hidden rounded-sm bg-rule/40">
          <img src={banner} alt="" fetchPriority="high" className="aspect-[32/10] w-full object-cover" />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <header className="min-w-0 lg:col-start-1">
          <div>
            <p className="text-sm text-ink-soft">
              {game.developers.join(', ') || 'Unknown developer'}
              {game.earlyAccess && <span className="ml-2 rounded-sm border border-rule px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">Early Access</span>}
            </p>
            <h1 className="headline mt-1 text-4xl leading-[1.05] sm:text-[52px]">{game.title}</h1>
            {game.description && <p className="mt-4 max-w-[62ch] text-[18px] leading-relaxed text-ink-soft">{game.description}</p>}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a href={game.storeUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
              View on Steam <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
            <SaveGameButton game={game} variant="full" />
          </div>
        </header>

        <aside aria-label="At a glance" className="lg:sticky lg:top-16 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div className="rounded-md border border-rule bg-surface px-5 py-2">
            <h2 className="kicker pb-1 pt-3 text-ink">At a glance</h2>
            <dl>
              <Fact label="Price (US)">
                <PriceTag game={game} size="lg" />
                {game.discountPct > 0 && game.discountEndsAt && (
                  <span className="mt-1 block text-[12px] text-ink-faint">Sale ends {formatDate(game.discountEndsAt)}</span>
                )}
              </Fact>
              <Fact label="Steam reviews">
                {game.reviewLabel ? (
                  <>
                    {game.reviewLabel}
                    <span className="block text-[13px] text-ink-faint">
                      {game.reviewPercent}% of {game.reviewCount.toLocaleString()} reviews positive
                    </span>
                  </>
                ) : game.reviewCount > 0 ? (
                  `${game.reviewCount.toLocaleString()} reviews so far`
                ) : (
                  'No reviews yet'
                )}
              </Fact>
              <Fact label={game.comingSoon ? 'Release' : 'Released'}>{release ?? 'Date not announced'}</Fact>
              <Fact label="Steam Deck">
                {DECK_LABEL[game.deck]}
                <span className="block text-[13px] leading-snug text-ink-faint">{DECK_EXPLAINER[game.deck]}</span>
              </Fact>
              {game.publishers.length > 0 && game.publishers.join() !== game.developers.join() && <Fact label="Publisher">{game.publishers.join(', ')}</Fact>}
              {game.genres.length > 0 && (
                <Fact label="Find more">
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {game.genres
                      .filter((g) => GENRE_BY_ID[g])
                      .map((g) => (
                        <Link key={g} href={`/${GENRE_BY_ID[g].onlySection ?? section}?genre=${g}`} className="link-underline">
                          {GENRE_BY_ID[g].label}
                        </Link>
                      ))}
                  </span>
                </Fact>
              )}
            </dl>
          </div>
        </aside>

        <div className="min-w-0 lg:col-start-1">

          {game.tags.length > 0 && (
            <section>
              <h2 className="kicker mb-2 text-ink-faint">What players tag it</h2>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[14px] text-ink-soft">
                {game.tags.slice(0, 14).map((t, i) => (
                  <li key={t}>
                    {t}
                    {i < Math.min(game.tags.length, 14) - 1 && <span className="ml-3 text-rule" aria-hidden>/</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10">
            <SectionHeader kicker="From the developer" title="Latest updates" />
            <DeveloperUpdates appId={game.appId} />
          </section>

          {data.articles.length > 0 && (
            <section className="mt-10">
              <SectionHeader kicker="Coverage" title="In the news" />
              {data.articles.map((a) => (
                <WireItem key={a.id} article={a} />
              ))}
            </section>
          )}
        </div>

      </div>

      {data.related.length > 0 && (
        <section className="mt-14">
          <SectionHeader kicker="Keep browsing" title={`If you like ${game.title}`} accent={section} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-6 lg:grid-cols-4">
            {data.related.slice(0, 8).map((g) => (
              <GameTile key={g.appId} game={g} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
