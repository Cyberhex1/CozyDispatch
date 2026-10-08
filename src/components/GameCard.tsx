/** Game presentations: a tile for grids and a compact row for ranked lists. */
import { gamePath, Link } from '../lib/router';
import { releaseText, reviewText } from '../lib/format';
import type { Game } from '../shared/content';
import { DeckLabel, PriceTag, SaveGameButton } from './ui';

function GameImage({ game, className = '', eager = false }: { game: Game; className?: string; eager?: boolean }) {
  const src = game.headerImage || game.capsuleImage;
  return src ? (
    <img
      src={src}
      alt=""
      width={460}
      height={215}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`h-full w-full object-cover ${className}`}
    />
  ) : (
    <div className={`grid h-full w-full place-items-center bg-rule/50 px-3 text-center font-display text-ink-soft ${className}`}>{game.title}</div>
  );
}

export function GameTile({ game, showSection = false, eager = false }: { game: Game; showSection?: boolean; eager?: boolean }) {
  const review = reviewText(game);
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[460/215] overflow-hidden rounded-sm bg-rule/40">
        <GameImage game={game} eager={eager} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute right-2 top-2 z-10 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <SaveGameButton game={game} />
        </div>
      </div>
      <div className="mt-2.5 flex flex-1 flex-col">
        {showSection && (
          <p className={`kicker mb-0.5 ${game.cozy ? 'text-cozy' : 'text-indie'}`}>{game.cozy ? 'Cozy' : 'Indie'}</p>
        )}
        <h3 className="font-display text-[17px] leading-snug text-ink">
          <Link href={gamePath(game)} className="after:absolute after:inset-0 after:content-[''] group-hover:underline decoration-1 underline-offset-2">
            {game.title}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-[13px] text-ink-faint">{game.developers[0] ?? ' '}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-2 text-[12px]">
          <span className="truncate text-ink-soft">
            {game.comingSoon ? releaseText(game) : review ?? <DeckLabel status={game.deck} />}
          </span>
          <PriceTag game={game} />
        </div>
      </div>
    </article>
  );
}

export function GameRow({ game, rank, meta }: { game: Game; rank?: number; meta?: string | null }) {
  return (
    <article className="group relative flex items-center gap-3 py-3">
      {rank !== undefined && (
        <span className="w-6 shrink-0 text-right font-display text-xl tabular-nums text-ink-faint">{rank}</span>
      )}
      <div className="h-[47px] w-[100px] shrink-0 overflow-hidden rounded-sm bg-rule/40">
        <GameImage game={game} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-[16px] leading-snug text-ink">
          <Link href={gamePath(game)} className="after:absolute after:inset-0 after:content-[''] group-hover:underline decoration-1 underline-offset-2">
            {game.title}
          </Link>
        </h3>
        <p className="truncate text-[12px] text-ink-faint">{meta ?? reviewText(game) ?? game.developers[0]}</p>
      </div>
      <div className="shrink-0 text-right">
        <PriceTag game={game} />
      </div>
    </article>
  );
}
