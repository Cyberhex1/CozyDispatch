/** Newspaper-style masthead: date line, wordmark, utilities, and the section nav. */
import { Heart, Moon, Search, Sun, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from '../lib/router';
import { compactNumber, timeAgo, todayLine } from '../lib/format';
import { useApi } from '../lib/api';
import { useSaved } from '../lib/saved';
import type { SiteStats } from '../shared/content';
import { AVATAR_EMOJI } from './AccountDialog';

const NAV: { href: string; label: string; accent?: string }[] = [
  { href: '/', label: 'Today' },
  { href: '/cozy', label: 'Cozy', accent: 'after:bg-cozy' },
  { href: '/indie', label: 'Indie', accent: 'after:bg-indie' },
  { href: '/deals', label: 'Deals', accent: 'after:bg-deal' },
  { href: '/upcoming', label: 'Upcoming' },
  { href: '/news', label: 'News' }
];

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('cd_theme', dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [dark]);
  return [dark, () => setDark((d) => !d)] as const;
}

const iconBtn = 'relative grid h-10 w-10 place-items-center rounded-full text-ink-soft transition hover:bg-rule/50 hover:text-ink';

export function Masthead({ onSearch, onAccount, onFinder }: { onSearch: () => void; onAccount: () => void; onFinder: () => void }) {
  const { path } = useLocation();
  const { account, wishlist, bookmarks } = useSaved();
  const { data: stats } = useApi<SiteStats>('/api/status');
  const [dark, toggleTheme] = useTheme();
  const savedCount = wishlist.length + bookmarks.length;
  const active = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));

  return (
    <>
      <header className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="hidden items-center justify-between border-b border-rule py-2 text-[12px] text-ink-faint md:flex">
          <span>{todayLine()}</span>
          {stats && stats.games > 0 && (
            <span>
              {compactNumber(stats.games)} games tracked
              {stats.catalogUpdatedAt && <> · Steam data updated {timeAgo(stats.catalogUpdatedAt)}</>}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 py-3 md:py-5">
          <Link href="/" className="group flex items-baseline gap-2" aria-label="Cozy Dispatch home">
            <span className="headline text-[26px] leading-none sm:text-4xl md:text-[44px]">Cozy Dispatch</span>
          </Link>
          <nav aria-label="Utilities" className="flex items-center gap-0.5">
            <button type="button" className={iconBtn} onClick={onSearch} aria-label="Search games and news (Ctrl+K)">
              <Search className="h-5 w-5" aria-hidden />
            </button>
            <Link href="/shelf" className={iconBtn} aria-label={`Your shelf (${savedCount} saved)`}>
              <Heart className="h-5 w-5" aria-hidden />
              {savedCount > 0 && (
                <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-deal px-1 text-[10px] font-bold leading-4 text-on-accent">
                  {savedCount > 99 ? '99+' : savedCount}
                </span>
              )}
            </Link>
            <button type="button" className={`${iconBtn} hidden sm:grid`} onClick={toggleTheme} aria-label={dark ? 'Use light theme' : 'Use dark theme'}>
              {dark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
            </button>
            <button type="button" className={iconBtn} onClick={onAccount} aria-label={account ? `Account: ${account.user.displayName}` : 'Sign in'}>
              {account ? <span className="text-xl leading-none">{AVATAR_EMOJI[account.user.avatar]}</span> : <User className="h-5 w-5" aria-hidden />}
            </button>
          </nav>
        </div>
      </header>
      <div className="sticky top-0 z-30 border-y border-rule bg-paper/95 backdrop-blur">
        <nav aria-label="Sections" className="no-scrollbar mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-2 sm:px-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active(item.href) ? 'page' : undefined}
              className={`relative shrink-0 px-3 py-3 text-[14px] font-semibold transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t after:opacity-0 after:transition-opacity ${
                item.accent ?? 'after:bg-ink'
              } ${active(item.href) ? 'text-ink after:opacity-100' : 'text-ink-soft hover:text-ink'}`}
            >
              {item.label}
            </Link>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-rule" aria-hidden />
          <button type="button" onClick={onFinder} className="shrink-0 px-3 py-3 text-[14px] font-semibold text-ink-soft hover:text-ink">
            Find a game
          </button>
          <button type="button" onClick={toggleTheme} className="shrink-0 px-3 py-3 text-[14px] font-semibold text-ink-soft hover:text-ink sm:hidden" aria-label={dark ? 'Use light theme' : 'Use dark theme'}>
            {dark ? 'Light' : 'Dark'}
          </button>
        </nav>
      </div>
    </>
  );
}
