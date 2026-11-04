/** A shared game list: readable by anyone with the link, editable by its owner. */
import { ArrowDown, ArrowUp, Link2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, navigate, useLocation } from '../lib/router';
import { useSaved } from '../lib/saved';
import { formatDate } from '../lib/format';
import { LIST_DESCRIPTION_MAX, LIST_TITLE_MAX } from '../shared/account';
import type { GameList } from '../shared/lists';
import { deleteList, fetchList, updateList } from '../services/listsApi';
import { GameTile } from '../components/GameCard';
import { AVATAR_EMOJI } from '../components/AccountDialog';
import { EmptyState, ErrorState, Skeleton, TileSkeletons } from '../components/ui';
import { requestSignIn } from '../components/AddToListDialog';

const iconBtn = 'grid h-9 w-9 place-items-center rounded-full bg-paper/90 text-ink shadow-sm backdrop-blur transition hover:bg-paper disabled:opacity-40';

export function ListPage({ id }: { id: string }) {
  const { query } = useLocation();
  const { account, showNotice } = useSaved();
  const [list, setList] = useState<GameList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(query.get('edit') === '1');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Refetch when the viewer signs in or out, since that decides who can edit.
  const viewer = account === undefined ? 'pending' : account?.user.id ?? 'anon';
  useEffect(() => {
    if (viewer === 'pending') return;
    const ctrl = new AbortController();
    setError(null);
    fetchList(id, ctrl.signal)
      .then((l) => {
        setList(l);
        setTitle(l.title);
        setDescription(l.description);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(err?.message || 'Couldn’t load this list.');
      });
    return () => ctrl.abort();
  }, [id, viewer, attempt]);

  useEffect(() => {
    if (list) document.title = `${list.title} — a list on Cozy Dispatch`;
    return () => {
      document.title = 'Cozy Dispatch — Cozy & indie PC games, updated daily';
    };
  }, [list?.title]);

  if (error) {
    return error.includes('doesn’t exist') ? (
      <EmptyState title="This list isn’t here">
        Its owner may have deleted it, or the link is incomplete.{' '}
        <Link href="/" className="font-semibold link-underline">Back to today’s edition</Link>
      </EmptyState>
    ) : (
      <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
    );
  }

  if (!list) {
    return (
      <div>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-12 w-2/3" />
        <Skeleton className="mt-4 h-4 w-1/2" />
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-6 lg:grid-cols-4">
          <TileSkeletons count={4} />
        </div>
      </div>
    );
  }

  const owner = list.isOwner;

  const saveOrder = async (appIds: number[]) => {
    const previous = list;
    const byId = new Map(list.games.map((g) => [g.appId, g]));
    setList({ ...list, appIds, games: appIds.map((i) => byId.get(i)).filter((g) => g !== undefined) });
    try {
      const updated = await updateList(list.id, { appIds });
      setList((l) => (l ? { ...l, ...updated } : l));
    } catch (err: any) {
      setList(previous);
      showNotice(err?.message || 'Couldn’t update the list.');
    }
  };

  const move = (index: number, delta: number) => {
    const ids = list.games.map((g) => g.appId);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    saveOrder(ids);
  };

  const saveDetails = async () => {
    setSaving(true);
    try {
      const updated = await updateList(list.id, { title, description });
      setList({ ...list, ...updated });
      setEditing(false);
      if (query.get('edit')) navigate(`/list/${list.id}`, { replace: true, keepScroll: true });
    } catch (err: any) {
      showNotice(err?.message || 'Couldn’t save the list.');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/list/${list.id}`;
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: list.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showNotice('Link copied. Anyone with it can see this list.');
    } catch {
      showNotice(url);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${list.title}”? Anyone with the link will see that it’s gone.`)) return;
    try {
      await deleteList(list.id);
      showNotice('List deleted.');
      navigate('/shelf');
    } catch (err: any) {
      showNotice(err?.message || 'Couldn’t delete the list.');
    }
  };

  return (
    <article>
      <header className="border-b border-rule pb-6">
        <p className="kicker text-ink-faint">A list by {list.owner.displayName}</p>
        {editing ? (
          <form
            className="mt-3 max-w-2xl space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveDetails();
            }}
          >
            <label className="block">
              <span className="kicker text-ink-faint">Name</span>
              <input className="field mt-1 font-display text-2xl" value={title} maxLength={LIST_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} required autoFocus />
            </label>
            <label className="block">
              <span className="kicker text-ink-faint">What’s it about? (optional)</span>
              <textarea
                className="field mt-1 min-h-24 py-2"
                value={description}
                maxLength={LIST_DESCRIPTION_MAX}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short sessions, no stress, perfect for rainy evenings…"
              />
            </label>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Save'}</button>
              <button
                type="button"
                className="btn-quiet"
                onClick={() => {
                  setTitle(list.title);
                  setDescription(list.description);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <h1 className="headline mt-2 text-4xl leading-[1.05] sm:text-[52px]">{list.title}</h1>
            {list.description && <p className="mt-4 max-w-[62ch] whitespace-pre-line text-[18px] leading-relaxed text-ink-soft">{list.description}</p>}
          </>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-[13px] text-ink-faint">
          <span className="inline-flex items-center gap-2">
            <span className="text-lg leading-none" aria-hidden>{AVATAR_EMOJI[list.owner.avatar]}</span>
            {list.games.length} game{list.games.length === 1 ? '' : 's'} · updated {formatDate(list.updatedAt)}
          </span>
          <span className="flex flex-wrap gap-2">
            <button type="button" onClick={copyLink} className="btn-quiet min-h-9 px-3 text-[13px]">
              <Link2 className="h-4 w-4" aria-hidden /> Share link
            </button>
            {owner && !editing && (
              <button type="button" onClick={() => setEditing(true)} className="btn-quiet min-h-9 px-3 text-[13px]">Edit name</button>
            )}
            {owner && (
              <button type="button" onClick={remove} className="btn-quiet min-h-9 px-3 text-[13px] text-deal">Delete list</button>
            )}
          </span>
        </div>
      </header>

      {list.games.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={owner ? 'Your list is empty' : 'Nothing here yet'}>
            {owner ? (
              <>
                Open any game and choose <span className="font-semibold text-ink">Add to a list</span>.{' '}
                <Link href="/cozy" className="font-semibold text-ink link-underline">Browse cozy games</Link>
              </>
            ) : (
              'Check back later.'
            )}
          </EmptyState>
        </div>
      ) : (
        <ol className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
          {list.games.map((g, i) => (
            <li key={g.appId} className="relative">
              <span className="kicker mb-1.5 block tabular-nums text-ink-faint">No. {i + 1}</span>
              <GameTile game={g} eager={i < 4} showSection />
              {owner && (
                <div className="absolute left-2 top-8 z-10 flex gap-1">
                  <button type="button" className={iconBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${g.title} earlier`}>
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" className={iconBtn} onClick={() => move(i, 1)} disabled={i === list.games.length - 1} aria-label={`Move ${g.title} later`}>
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    onClick={() => saveOrder(list.games.filter((x) => x.appId !== g.appId).map((x) => x.appId))}
                    aria-label={`Remove ${g.title} from this list`}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {!owner && (
        <aside className="mt-14 border-t-2 border-rule-strong pt-4">
          <p className="kicker text-cozy">Make your own</p>
          <p className="mt-1 max-w-[60ch] text-[15px] text-ink-soft">
            Lists are free with a Cozy Dispatch account. Gather games for a season, a mood or a friend, and share the link.{' '}
            {account ? (
              <Link href="/shelf" className="font-semibold text-ink link-underline">Go to your shelf</Link>
            ) : (
              <button type="button" onClick={requestSignIn} className="font-semibold text-ink link-underline">Create an account</button>
            )}
          </p>
        </aside>
      )}
    </article>
  );
}
