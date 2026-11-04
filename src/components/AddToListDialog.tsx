/** "Add to a list": toggle a game in any of the reader's lists, or start a new one. */
import { Check, ListPlus, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '../lib/router';
import { useSaved } from '../lib/saved';
import { LIST_GAMES_MAX, LIST_TITLE_MAX } from '../shared/account';
import type { Game } from '../shared/content';
import type { GameListSummary } from '../shared/lists';
import { createList, fetchMyLists, listPath, updateList } from '../services/listsApi';
import { Dialog } from './Dialog';

/** Asks the app shell to open the sign-in dialog. */
export function requestSignIn() {
  window.dispatchEvent(new CustomEvent('cd:open-account'));
}

export function useMyLists(enabled: boolean) {
  const [lists, setLists] = useState<GameListSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    if (!enabled) return;
    setError(null);
    fetchMyLists()
      .then((r) => setLists(r.items))
      .catch((err) => setError(err?.message || 'Couldn’t load your lists.'));
  }, [enabled]);
  useEffect(() => {
    if (enabled) reload();
    else setLists(null);
  }, [enabled, reload]);
  return { lists, setLists, error, reload };
}

export function AddToListButton({ game }: { game: Game }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-quiet">
        <ListPlus className="h-4 w-4" aria-hidden />
        Add to a list
      </button>
      <AddToListDialog game={game} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AddToListDialog({ game, open, onClose }: { game: Game; open: boolean; onClose: () => void }) {
  const { account, showNotice } = useSaved();
  const signedIn = Boolean(account);
  const { lists, setLists, error } = useMyLists(open && signedIn);
  const [busy, setBusy] = useState<string | null>(null);
  const [title, setTitle] = useState('');

  const toggle = async (list: GameListSummary) => {
    const has = list.appIds.includes(game.appId);
    if (!has && list.appIds.length >= LIST_GAMES_MAX) {
      showNotice(`“${list.title}” is full (${LIST_GAMES_MAX} games).`);
      return;
    }
    setBusy(list.id);
    try {
      const updated = await updateList(list.id, {
        appIds: has ? list.appIds.filter((id) => id !== game.appId) : [...list.appIds, game.appId]
      });
      setLists((ls) => ls?.map((l) => (l.id === updated.id ? updated : l)) ?? null);
    } catch (err: any) {
      showNotice(err?.message || 'Couldn’t update that list.');
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    const name = title.trim();
    if (!name) return;
    setBusy('new');
    try {
      const made = await createList({ title: name, appIds: [game.appId] });
      setLists((ls) => [made, ...(ls ?? [])]);
      setTitle('');
    } catch (err: any) {
      showNotice(err?.message || 'Couldn’t make that list.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add to a list">
      {!signedIn ? (
        <div className="text-[15px] text-ink-soft">
          <p>Lists are pages you curate and share, like “Cozy games for autumn”. They live in your account so the link keeps working.</p>
          <button
            type="button"
            className="btn-primary mt-4"
            onClick={() => {
              onClose();
              requestSignIn();
            }}
          >
            Sign in to make lists
          </button>
        </div>
      ) : (
        <div>
          <p className="text-[14px] text-ink-soft">
            Choose where <span className="font-semibold text-ink">{game.title}</span> belongs.
          </p>
          {error && <p className="mt-3 text-sm text-deal">{error}</p>}
          {!lists && !error && <p className="mt-4 text-sm text-ink-faint">Loading your lists…</p>}
          {lists && lists.length > 0 && (
            <ul className="mt-3 divide-y divide-rule border-y border-rule">
              {lists.map((l) => {
                const has = l.appIds.includes(game.appId);
                return (
                  <li key={l.id} className="flex items-center gap-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggle(l)}
                      disabled={busy === l.id}
                      aria-pressed={has}
                      className="flex min-h-11 flex-1 items-center gap-3 text-left disabled:opacity-60"
                    >
                      <span
                        aria-hidden
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-sm border ${has ? 'border-ink bg-ink text-paper' : 'border-ink-faint'}`}
                      >
                        {has && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{l.title}</span>
                        <span className="block text-[12px] text-ink-faint">
                          {l.appIds.length} game{l.appIds.length === 1 ? '' : 's'}
                        </span>
                      </span>
                    </button>
                    <Link href={listPath(l)} onClick={onClose} className="shrink-0 text-[13px] font-semibold text-ink-faint hover:text-ink">
                      View
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <label className="sr-only" htmlFor="new-list-title">New list name</label>
            <input
              id="new-list-title"
              className="field"
              value={title}
              maxLength={LIST_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lists && lists.length ? 'Or start a new list…' : 'Name your first list…'}
            />
            <button type="submit" className="btn-primary shrink-0" disabled={!title.trim() || busy === 'new'}>
              <Plus className="h-4 w-4" aria-hidden /> Create
            </button>
          </form>
        </div>
      )}
    </Dialog>
  );
}
