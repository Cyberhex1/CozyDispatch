/**
 * "Find a game": three quick questions that become ordinary catalog filters.
 * Deterministic: it simply opens the matching list, best-reviewed first.
 */
import { useEffect, useState } from 'react';
import { buildUrl, useApi } from '../lib/api';
import { navigate } from '../lib/router';
import { SECTIONS, type Section } from '../shared/genres';
import { Dialog } from './Dialog';

interface GenreCount {
  id: string;
  label: string;
  count: number;
}

function Choice({ selected, onClick, title, detail }: { selected: boolean; onClick: () => void; title: string; detail?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-md border px-4 py-3 text-left transition ${selected ? 'border-ink bg-surface' : 'border-rule hover:border-ink-faint'}`}
    >
      <span className="block font-semibold text-ink">{title}</span>
      {detail && <span className="mt-0.5 block text-[13px] text-ink-soft">{detail}</span>}
    </button>
  );
}

export function FinderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [section, setSection] = useState<Section | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [deck, setDeck] = useState<'any' | 'verified'>('any');
  const [sale, setSale] = useState(false);
  const genres = useApi<{ items: GenreCount[] }>(section ? buildUrl('/api/genres', { section }) : null);

  useEffect(() => {
    if (open) {
      setSection(null);
      setGenre(null);
      setDeck('any');
      setSale(false);
    }
  }, [open]);

  const go = () => {
    if (!section) return;
    onClose();
    navigate(buildUrl(`/${section}`, { genre, deck: deck === 'verified' ? 'verified' : null, sale: sale || null, sort: 'rating' }));
  };

  return (
    <Dialog open={open} onClose={onClose} title="Find a game" wide>
      <ol className="space-y-6">
        <li>
          <p className="kicker mb-2 text-ink-faint">1 · What are you in the mood for?</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(SECTIONS) as Section[]).map((s) => (
              <Choice key={s} selected={section === s} onClick={() => { setSection(s); setGenre(null); }} title={SECTIONS[s].label} detail={SECTIONS[s].blurb} />
            ))}
          </div>
        </li>
        {section && (
          <li>
            <p className="kicker mb-2 text-ink-faint">2 · Any particular kind?</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="chip" aria-pressed={genre === null} onClick={() => setGenre(null)}>
                Anything good
              </button>
              {genres.data?.items.map((g) => (
                <button key={g.id} type="button" className="chip" aria-pressed={genre === g.id} onClick={() => setGenre(g.id)}>
                  {g.label}
                </button>
              ))}
              {genres.loading && <span className="text-sm text-ink-faint">Loading genres…</span>}
            </div>
          </li>
        )}
        {section && (
          <li>
            <p className="kicker mb-2 text-ink-faint">3 · Where will you play?</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Choice selected={deck === 'any'} onClick={() => setDeck('any')} title="At my desk" detail="Any PC game." />
              <Choice selected={deck === 'verified'} onClick={() => setDeck('verified')} title="On Steam Deck" detail="Only games Valve has marked Deck Verified." />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={sale} onChange={(e) => setSale(e.target.checked)} className="h-4 w-4 accent-[var(--deal)]" />
              Only games on sale right now
            </label>
          </li>
        )}
      </ol>
      <div className="mt-6 flex justify-end">
        <button type="button" className="btn-primary" disabled={!section} onClick={go}>
          Show me games
        </button>
      </div>
    </Dialog>
  );
}
