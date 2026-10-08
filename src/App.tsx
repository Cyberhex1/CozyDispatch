import { useEffect, useState } from 'react';
import { navigate, RouterProvider, useLocation } from './lib/router';
import { SavedProvider, useSaved } from './lib/saved';
import { Masthead } from './components/Masthead';
import { Footer } from './components/Footer';
import { SearchDialog } from './components/SearchDialog';
import { AccountDialog } from './components/AccountDialog';
import { FinderDialog } from './components/FinderDialog';
import { EmptyState } from './components/ui';
import { HomePage } from './pages/HomePage';
import { BrowsePage } from './pages/BrowsePage';
import { GamePage } from './pages/GamePage';
import { NewsPage } from './pages/NewsPage';
import { ShelfPage } from './pages/ShelfPage';

/** Old single-page URLs (?view=deals etc.) from the previous version of the site. */
function redirectLegacyUrl() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (window.location.pathname !== '/' || !view) return;
  const map: Record<string, string> = { browser: '/cozy', categories: '/cozy', catalogs: '/cozy', news: '/news', deals: '/deals', home: '/' };
  navigate(map[view] ?? '/', { replace: true });
}

function Routes({ openAccount }: { openAccount: () => void }) {
  const { path } = useLocation();
  const game = path.match(/^\/game\/(\d+)(?:\/[^/]*)?$/);
  if (path === '/') return <HomePage />;
  if (path === '/cozy' || path === '/indie' || path === '/deals' || path === '/upcoming' || path === '/search') {
    return <BrowsePage key={path} mode={path.slice(1) as 'cozy'} />;
  }
  if (game) return <GamePage key={game[1]} appId={Number(game[1])} />;
  if (path === '/news') return <NewsPage />;
  if (path === '/shelf') return <ShelfPage onAccount={openAccount} />;
  return (
    <EmptyState title="Page not found">
      That page isn’t here. Try the sections above, or search for a game.
    </EmptyState>
  );
}

function Notice() {
  const { notice } = useSaved();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      {notice && <p className="pointer-events-auto rounded-md bg-ink px-4 py-3 text-sm text-paper shadow-lg">{notice}</p>}
    </div>
  );
}

function Shell() {
  const [dialog, setDialog] = useState<'search' | 'account' | 'finder' | null>(null);
  const close = () => setDialog(null);

  useEffect(() => {
    redirectLegacyUrl();
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setDialog((d) => (d === 'search' ? null : 'search'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
        Skip to content
      </a>
      <Masthead onSearch={() => setDialog('search')} onAccount={() => setDialog('account')} onFinder={() => setDialog('finder')} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 sm:px-6">
        <Routes openAccount={() => setDialog('account')} />
      </main>
      <Footer />
      <SearchDialog open={dialog === 'search'} onClose={close} />
      <AccountDialog open={dialog === 'account'} onClose={close} />
      <FinderDialog open={dialog === 'finder'} onClose={close} />
      <Notice />
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <SavedProvider>
        <Shell />
      </SavedProvider>
    </RouterProvider>
  );
}
