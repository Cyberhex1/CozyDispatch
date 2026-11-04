/** Status picker and private note for a saved game, used on the shelf and on game pages. */
import { useEffect, useId, useState } from 'react';
import { useSaved } from '../lib/saved';
import { SHELF_NOTE_MAX, SHELF_STATUSES, SHELF_STATUS_LABEL, type ShelfStatus } from '../shared/account';

export const STATUS_DOT: Record<ShelfStatus, string> = {
  want: 'border border-ink-faint',
  playing: 'bg-cozy',
  finished: 'bg-ink-soft'
};

export function StatusSelect({ appId, title, className = '' }: { appId: number; title: string; className?: string }) {
  const { shelfEntry, setShelfEntry } = useSaved();
  const { status } = shelfEntry(appId);
  return (
    <label className={`flex items-center gap-2 ${className}`}>
      <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
      <span className="sr-only">Status for {title}</span>
      <select
        value={status}
        onChange={(e) => setShelfEntry(appId, { status: e.target.value as ShelfStatus })}
        className="field min-h-9 w-auto py-1 pr-8 text-[13px] font-semibold"
      >
        {SHELF_STATUSES.map((s) => (
          <option key={s} value={s}>
            {SHELF_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ShelfNote({ appId, title }: { appId: number; title: string }) {
  const { shelfEntry, setShelfEntry } = useSaved();
  const { note } = shelfEntry(appId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const id = useId();

  useEffect(() => {
    if (!editing) setDraft(note);
  }, [note, editing]);

  if (!editing) {
    return (
      <div className="text-[13px]">
        {note && <p className="whitespace-pre-line text-ink-soft italic">“{note}”</p>}
        <button type="button" onClick={() => setEditing(true)} className="mt-1 font-semibold text-ink-faint hover:text-ink">
          {note ? 'Edit note' : '+ Add a note'}
        </button>
      </div>
    );
  }

  const save = () => {
    const next = draft.trim();
    if (next !== note) setShelfEntry(appId, { note: next });
    setEditing(false);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="text-[13px]"
    >
      <label htmlFor={id} className="sr-only">Note about {title}</label>
      <textarea
        id={id}
        autoFocus
        value={draft}
        maxLength={SHELF_NOTE_MAX}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setEditing(false);
          }
        }}
        rows={2}
        placeholder="A friend recommended it, save for winter…"
        className="field min-h-16 py-2 text-[13px]"
      />
      <div className="mt-1.5 flex items-center gap-3">
        <button type="submit" className="font-semibold text-ink hover:underline">Save note</button>
        <button type="button" onClick={() => setEditing(false)} className="text-ink-faint hover:text-ink">Cancel</button>
        <span className="ml-auto tabular-nums text-ink-faint">{draft.trim().length}/{SHELF_NOTE_MAX}</span>
      </div>
    </form>
  );
}
