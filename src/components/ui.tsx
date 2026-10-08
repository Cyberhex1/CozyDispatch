/** Small presentational pieces reused across pages. */
import type { ReactNode } from 'react';
import { ArrowRight, Bookmark, Heart } from 'lucide-react';
import { Link } from '../lib/router';
import { DECK_LABEL, formatPrice } from '../lib/format';
import { useSaved } from '../lib/saved';
import type { Game } from '../shared/content';
import type { DeckStatus } from '../shared/steam';

export type Accent = 'cozy' | 'indie' | 'deal' | 'ink';

const ACCENT_TEXT: Record<Accent, string> = {
  cozy: 'text-cozy',
  indie: 'text-indie',
  deal: 'text-deal',
  ink: 'text-ink-soft'
};

export function SectionHeader({
  kicker,
  title,
  accent = 'ink',
  href,
  linkLabel = 'See all',
  children
}: {
  kicker?: string;
  title: string;
  accent?: Accent;
  href?: string;
  linkLabel?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4 border-t-2 border-rule-strong pt-3">
      <div className="min-w-0">
        {kicker && <p className={`kicker mb-1 ${ACCENT_TEXT[accent]}`}>{kicker}</p>}
        <h2 className="headline text-2xl sm:text-[28px] leading-tight">{title}</h2>
        {children}
      </div>
      {href && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-1 py-2 text-sm font-semibold text-ink-soft hover:text-ink">
          {linkLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
    </header>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-rule/60 ${className}`} aria-hidden />;
}

export function TileSkeletons({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[460/215] w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-md border border-rule bg-surface px-5 py-6 text-sm text-ink-soft">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 font-semibold text-ink link-underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border-y border-rule py-10 text-center">
      <p className="headline text-xl">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{children}</div>}
    </div>
  );
}

const DECK_STYLE: Record<DeckStatus, string> = {
  verified: 'text-cozy',
  playable: 'text-ink-soft',
  unsupported: 'text-ink-faint',
  unknown: 'text-ink-faint'
};

export function DeckLabel({ status, className = '' }: { status: DeckStatus; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${DECK_STYLE[status]} ${className}`}>
      <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${status === 'verified' ? 'bg-cozy' : status === 'playable' ? 'bg-ink-soft' : 'border border-ink-faint'}`} />
      {DECK_LABEL[status]}
    </span>
  );
}

export function PriceTag({ game, size = 'sm' }: { game: Game; size?: 'sm' | 'lg' }) {
  const big = size === 'lg';
  if (game.comingSoon) return <span className={`${big ? 'text-base' : 'text-[13px]'} font-semibold text-ink-soft`}>Upcoming</span>;
  if (game.isFree) return <span className={`${big ? 'text-base' : 'text-[13px]'} font-semibold text-ink`}>Free</span>;
  if (game.price === null) return null;
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${big ? 'text-lg' : 'text-[13px]'} tabular-nums`}>
      {game.discountPct > 0 && (
        <>
          <span className="rounded-sm bg-deal px-1 text-[11px] font-bold leading-[18px] text-on-accent">−{game.discountPct}%</span>
          <s className="text-ink-faint">{formatPrice(game.originalPrice)}</s>
        </>
      )}
      <span className={`font-semibold ${game.discountPct > 0 ? 'text-deal' : 'text-ink'}`}>{formatPrice(game.price)}</span>
    </span>
  );
}

export function SaveGameButton({ game, variant = 'icon' }: { game: Game; variant?: 'icon' | 'full' }) {
  const { isGameSaved, toggleGame } = useSaved();
  const saved = isGameSaved(game.appId);
  const label = saved ? `Remove ${game.title} from your shelf` : `Save ${game.title} to your shelf`;
  if (variant === 'full') {
    return (
      <button type="button" onClick={() => toggleGame(game.appId)} aria-pressed={saved} className="btn-quiet">
        <Heart className={`h-4 w-4 ${saved ? 'fill-deal text-deal' : ''}`} aria-hidden />
        {saved ? 'On your shelf' : 'Save to shelf'}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleGame(game.appId);
      }}
      aria-pressed={saved}
      aria-label={label}
      title={saved ? 'On your shelf' : 'Save to shelf'}
      className="grid h-9 w-9 place-items-center rounded-full bg-paper/90 text-ink shadow-sm backdrop-blur transition hover:bg-paper"
    >
      <Heart className={`h-4 w-4 ${saved ? 'fill-deal text-deal' : ''}`} aria-hidden />
    </button>
  );
}

export function BookmarkButton({ id, title }: { id: string; title: string }) {
  const { isArticleSaved, toggleArticle } = useSaved();
  const saved = isArticleSaved(id);
  return (
    <button
      type="button"
      onClick={() => toggleArticle(id)}
      aria-pressed={saved}
      aria-label={saved ? `Remove bookmark: ${title}` : `Bookmark: ${title}`}
      title={saved ? 'Bookmarked' : 'Bookmark'}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-faint transition hover:bg-rule/50 hover:text-ink"
    >
      <Bookmark className={`h-4 w-4 ${saved ? 'fill-ink text-ink' : ''}`} aria-hidden />
    </button>
  );
}
