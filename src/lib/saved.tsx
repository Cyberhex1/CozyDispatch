/**
 * Account + saved items ("the shelf").
 *
 * Signed out: saves live in this browser only (localStorage).
 * Signed in: the server is the source of truth; anything saved while signed
 * out is merged into the account on sign-in, and the device copy is cleared
 * on sign-out so the next person on a shared computer starts fresh.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isShelfStatus, type AccountState, type ShelfEntry, type ShelfStatus } from '../shared/account';
import {
  addBookmark,
  addToWishlist,
  fetchMe,
  logout,
  mergeSaved,
  removeBookmark,
  removeFromWishlist,
  updateShelfEntry
} from '../services/accountApi';

const LOCAL_KEY = 'cd_saved_v2';
const LEGACY_KEYS = ['cozy_wishlist', 'cozy_bookmarks', 'cozy_user_profile', 'cozy_notifications', 'cozy_auth_token', 'cozy_theme'];

interface LocalSaved {
  wishlist: number[];
  bookmarks: string[];
  shelf: Record<number, ShelfEntry>;
}

const EMPTY_LOCAL: LocalSaved = { wishlist: [], bookmarks: [], shelf: {} };
const DEFAULT_ENTRY: ShelfEntry = { status: 'want', note: '' };

function readShelf(value: unknown): Record<number, ShelfEntry> {
  const out: Record<number, ShelfEntry> = {};
  if (!value || typeof value !== 'object') return out;
  for (const [k, v] of Object.entries(value as Record<string, any>)) {
    const id = Number(k);
    if (!Number.isInteger(id) || id <= 0 || !v || typeof v !== 'object') continue;
    out[id] = { status: isShelfStatus(v.status) ? v.status : 'want', note: typeof v.note === 'string' ? v.note.slice(0, 280) : '' };
  }
  return out;
}

/** Drops default entries so storage and payloads only carry what the reader set. */
function setEntry(shelf: Record<number, ShelfEntry>, appId: number, entry: ShelfEntry | null): Record<number, ShelfEntry> {
  const next = { ...shelf };
  if (!entry || (entry.status === 'want' && !entry.note)) delete next[appId];
  else next[appId] = entry;
  return next;
}

function readLocal(): LocalSaved {
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    const v = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    return {
      wishlist: Array.isArray(v.wishlist) ? v.wishlist.filter((n: unknown) => Number.isInteger(n) && (n as number) > 0) : [],
      bookmarks: Array.isArray(v.bookmarks) ? v.bookmarks.filter((s: unknown) => typeof s === 'string') : [],
      shelf: readShelf(v.shelf)
    };
  } catch {
    return EMPTY_LOCAL;
  }
}

function writeLocal(saved: LocalSaved | null) {
  try {
    if (saved) localStorage.setItem(LOCAL_KEY, JSON.stringify(saved));
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* storage unavailable: saves last for this visit only */
  }
}

interface SavedContextValue {
  /** undefined while we check for a session */
  account: AccountState | null | undefined;
  wishlist: number[];
  bookmarks: string[];
  isGameSaved: (appId: number) => boolean;
  isArticleSaved: (id: string) => boolean;
  toggleGame: (appId: number) => void;
  toggleArticle: (id: string) => void;
  /** Status and note for a saved game (defaults when none was set). */
  shelfEntry: (appId: number) => ShelfEntry;
  /** Changes a game's status or note; saves the game if it wasn't saved. */
  setShelfEntry: (appId: number, patch: { status?: ShelfStatus; note?: string }) => void;
  onSignedIn: (state: AccountState) => Promise<void>;
  setAccount: (state: AccountState) => void;
  signOut: () => Promise<void>;
  notice: string | null;
  showNotice: (message: string) => void;
}

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const [account, setAccountState] = useState<AccountState | null | undefined>(undefined);
  const [local, setLocal] = useState<LocalSaved>(readLocal);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4000);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchMe(ctrl.signal)
      .then((me) => setAccountState(me))
      .catch(() => setAccountState(null));
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (account === null) writeLocal(local);
  }, [account, local]);

  const wishlist = account ? account.wishlist : local.wishlist;
  const bookmarks = account ? account.bookmarks : local.bookmarks;
  const shelf = account ? account.shelf ?? {} : local.shelf;

  const toggleGame = useCallback(
    (appId: number) => {
      if (!account) {
        setLocal((s) =>
          s.wishlist.includes(appId)
            ? { ...s, wishlist: s.wishlist.filter((id) => id !== appId), shelf: setEntry(s.shelf, appId, null) }
            : { ...s, wishlist: [appId, ...s.wishlist] }
        );
        return;
      }
      const saved = account.wishlist.includes(appId);
      const previous = account;
      setAccountState({
        ...account,
        wishlist: saved ? account.wishlist.filter((id) => id !== appId) : [appId, ...account.wishlist],
        shelf: saved ? setEntry(account.shelf ?? {}, appId, null) : account.shelf
      });
      (saved ? removeFromWishlist(appId) : addToWishlist(appId))
        .then(({ wishlist, shelf }) => setAccountState((a) => (a ? { ...a, wishlist, shelf } : a)))
        .catch((err) => {
          setAccountState(previous);
          showNotice(err?.message || 'Couldn’t update your shelf.');
        });
    },
    [account, showNotice]
  );

  const toggleArticle = useCallback(
    (id: string) => {
      if (!account) {
        setLocal((s) => ({
          ...s,
          bookmarks: s.bookmarks.includes(id) ? s.bookmarks.filter((x) => x !== id) : [id, ...s.bookmarks]
        }));
        return;
      }
      const saved = account.bookmarks.includes(id);
      const previous = account;
      setAccountState({ ...account, bookmarks: saved ? account.bookmarks.filter((x) => x !== id) : [id, ...account.bookmarks] });
      (saved ? removeBookmark(id) : addBookmark(id))
        .then(({ bookmarks }) => setAccountState((a) => (a ? { ...a, bookmarks } : a)))
        .catch((err) => {
          setAccountState(previous);
          showNotice(err?.message || 'Couldn’t update your bookmarks.');
        });
    },
    [account, showNotice]
  );

  const setShelfEntry = useCallback(
    (appId: number, patch: { status?: ShelfStatus; note?: string }) => {
      if (!account) {
        setLocal((s) => ({
          ...s,
          wishlist: s.wishlist.includes(appId) ? s.wishlist : [appId, ...s.wishlist],
          shelf: setEntry(s.shelf, appId, { ...DEFAULT_ENTRY, ...s.shelf[appId], ...patch })
        }));
        return;
      }
      const previous = account;
      const current = account.shelf ?? {};
      setAccountState({
        ...account,
        wishlist: account.wishlist.includes(appId) ? account.wishlist : [appId, ...account.wishlist],
        shelf: setEntry(current, appId, { ...DEFAULT_ENTRY, ...current[appId], ...patch })
      });
      updateShelfEntry(appId, patch)
        .then(({ wishlist, shelf }) => setAccountState((a) => (a ? { ...a, wishlist, shelf } : a)))
        .catch((err) => {
          setAccountState(previous);
          showNotice(err?.message || 'Couldn’t update your shelf.');
        });
    },
    [account, showNotice]
  );

  const onSignedIn = useCallback(
    async (state: AccountState) => {
      setAccountState(state);
      if (local.wishlist.length || local.bookmarks.length) {
        try {
          setAccountState(await mergeSaved(local));
          setLocal(EMPTY_LOCAL);
          writeLocal(null);
        } catch {
          showNotice('Signed in, but we couldn’t move this device’s saved games into your account yet.');
        }
      }
    },
    [local, showNotice]
  );

  const signOut = useCallback(async () => {
    try {
      await logout();
    } finally {
      setAccountState(null);
      setLocal(EMPTY_LOCAL);
      writeLocal(null);
    }
  }, []);

  const value = useMemo<SavedContextValue>(
    () => ({
      account,
      wishlist,
      bookmarks,
      isGameSaved: (id) => wishlist.includes(id),
      isArticleSaved: (id) => bookmarks.includes(id),
      toggleGame,
      toggleArticle,
      shelfEntry: (id) => shelf[id] ?? DEFAULT_ENTRY,
      setShelfEntry,
      onSignedIn,
      setAccount: setAccountState,
      signOut,
      notice,
      showNotice
    }),
    [account, wishlist, bookmarks, shelf, toggleGame, toggleArticle, setShelfEntry, onSignedIn, signOut, notice, showNotice]
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedContextValue {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used inside SavedProvider');
  return ctx;
}
