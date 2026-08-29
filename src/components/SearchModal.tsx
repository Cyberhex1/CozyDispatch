import React, { useState, useEffect, useRef } from 'react';
import { Game, NewsArticle, PatchNote } from '../types';
import { 
  Search, 
  X, 
  Gamepad2, 
  Newspaper, 
  Wrench, 
  Star, 
  Tv, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: Game[];
  articles: NewsArticle[];
  patchNotes: PatchNote[];
  onSelectGame: (game: Game) => void;
  onSelectArticle: (article: NewsArticle) => void;
  onSelectPatch: (patch: PatchNote) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  games,
  articles,
  patchNotes,
  onSelectGame,
  onSelectArticle,
  onSelectPatch
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  const matchedGames = q
    ? games.filter((g) => 
        g.title.toLowerCase().includes(q) ||
        g.developer.toLowerCase().includes(q) ||
        g.tags.some((t) => t.toLowerCase().includes(q)) ||
        g.vibes.some((v) => v.toLowerCase().includes(q))
      )
    : [];

  const matchedArticles = q
    ? articles.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      )
    : [];

  const matchedPatches = q
    ? patchNotes.filter((p) =>
        p.gameTitle.toLowerCase().includes(q) ||
        p.version.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q)
      )
    : [];

  const totalMatches = matchedGames.length + matchedArticles.length + matchedPatches.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-xs flex items-start justify-center p-2 sm:p-6 animate-in fade-in duration-150">
      <div className="relative bg-base text-text-main rounded-3xl border border-border shadow-2xl max-w-2xl w-full overflow-hidden mt-4 sm:mt-12 mb-4 sm:mb-8 max-h-[90vh] flex flex-col">
        {/* Search Bar Input */}
        <div className="p-3.5 sm:p-5 border-b border-border flex items-center gap-2.5 sm:gap-3 bg-base shrink-0">
          <Search className="w-4 sm:w-5 h-4 sm:h-5 text-brand shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search cozy games, indie releases, IGN/GameSpot news, patch notes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm sm:text-base text-text-main placeholder-[#A0A090] focus:outline-hidden"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-text-muted hover:text-text-main text-xs font-bold px-2 py-1 cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-base hover:bg-surface text-text-muted hover:text-text-main border border-border cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-5">
          {!query ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-xs text-brand uppercase tracking-wider font-bold">
                Quick Suggested Searches
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 max-w-md mx-auto">
                {['Fields of Mistria', 'Tiny Glade', 'Balatro', 'Steam Deck OLED', 'Stardew Valley 1.6', 'Cottagecore', 'Farming Sim', 'Dave the Diver'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-base hover:bg-surface-brand hover:text-text-heading text-text-muted border border-border transition-colors cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ) : totalMatches === 0 ? (
            <div className="text-center py-12 text-text-muted text-sm">
              No results found for "<strong className="text-text-heading">{query}</strong>". Try a broader tag like "farm", "deck", or "builder".
            </div>
          ) : (
            <>
              {/* Games */}
              {matchedGames.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-1.5">
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>Games ({matchedGames.length})</span>
                  </div>

                  <div className="space-y-1.5">
                    {matchedGames.map((game) => (
                      <div
                        key={game.id}
                        onClick={() => {
                          onSelectGame(game);
                          onClose();
                        }}
                        className="bg-base hover:bg-surface p-3 rounded-2xl border border-border flex items-center justify-between gap-3 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={game.coverImage}
                            alt={game.title}
                            className="w-10 h-10 rounded-lg object-cover border border-border"
                          />
                          <div className="min-w-0">
                            <h4 className="font-serif-natural font-normal text-xs text-text-heading truncate">
                              {game.title}
                            </h4>
                            <div className="text-[11px] text-text-muted mt-0.5">
                              {game.developer} • {game.price} • ★ {game.cozyScore}/10
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {game.steamDeckStatus === 'Verified' && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-surface-brand text-text-heading border border-brand/30">
                              Deck Verified
                            </span>
                          )}
                          <ArrowRight className="w-4 h-4 text-text-faint" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* News Articles */}
              {matchedArticles.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-1.5">
                    <Newspaper className="w-3.5 h-3.5" />
                    <span>News & Coverage ({matchedArticles.length})</span>
                  </div>

                  <div className="space-y-1.5">
                    {matchedArticles.map((article) => (
                      <div
                        key={article.id}
                        onClick={() => {
                          onSelectArticle(article);
                          onClose();
                        }}
                        className="bg-base hover:bg-surface p-3 rounded-2xl border border-border flex items-center justify-between gap-3 cursor-pointer transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-surface-brand text-text-heading border border-brand/30">
                            {article.source}
                          </span>
                          <h4 className="font-serif-natural font-normal text-xs text-text-heading line-clamp-1 mt-1">
                            {article.title}
                          </h4>
                          <p className="text-[11px] text-text-muted line-clamp-1 mt-0.5">
                            {article.summary}
                          </p>
                        </div>

                        <ArrowRight className="w-4 h-4 text-text-faint shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Patch Notes */}
              {matchedPatches.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Patch Notes ({matchedPatches.length})</span>
                  </div>

                  <div className="space-y-1.5">
                    {matchedPatches.map((patch) => (
                      <div
                        key={patch.id}
                        onClick={() => {
                          onSelectPatch(patch);
                          onClose();
                        }}
                        className="bg-base hover:bg-surface p-3 rounded-2xl border border-border flex items-center justify-between gap-3 cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-serif-natural font-normal text-xs text-text-heading">
                              {patch.gameTitle}
                            </h4>
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-surface-brand text-text-heading border border-brand/30">
                              {patch.version}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted line-clamp-1 mt-0.5">
                            {patch.summary}
                          </p>
                        </div>

                        <ArrowRight className="w-4 h-4 text-text-faint shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
