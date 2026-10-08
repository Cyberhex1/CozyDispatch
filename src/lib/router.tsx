/**
 * Tiny History-API router (no dependency). Paths are real URLs, so every page
 * can be shared and reloaded; Cloudflare Pages serves index.html for them.
 */
import { createContext, useContext, useEffect, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

interface Location {
  path: string;
  query: URLSearchParams;
}

const RouterContext = createContext<Location>({ path: '/', query: new URLSearchParams() });

function readLocation(): Location {
  return { path: window.location.pathname.replace(/\/+$/, '') || '/', query: new URLSearchParams(window.location.search) };
}

export function navigate(to: string, opts: { replace?: boolean; keepScroll?: boolean } = {}) {
  if (to === window.location.pathname + window.location.search) return;
  window.history[opts.replace ? 'replaceState' : 'pushState']({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  if (!opts.keepScroll) window.scrollTo({ top: 0 });
}

/** Updates query parameters on the current page without scrolling. */
export function setQuery(updates: Record<string, string | null | undefined>, opts: { replace?: boolean } = {}) {
  const params = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(updates)) {
    if (v === null || v === undefined || v === '') params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  navigate(window.location.pathname + (qs ? `?${qs}` : ''), { replace: opts.replace ?? true, keepScroll: true });
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return <RouterContext.Provider value={location}>{children}</RouterContext.Provider>;
}

export function useLocation() {
  return useContext(RouterContext);
}

/** Internal link: client-side navigation, but still a real <a> for middle-click / copy link. */
export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handle} {...rest} />;
}

export function gamePath(game: { appId: number; slug: string }) {
  return `/game/${game.appId}/${game.slug}`;
}
