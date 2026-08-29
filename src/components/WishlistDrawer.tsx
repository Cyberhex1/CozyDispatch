import React from 'react';
import { Game, NewsArticle } from '../types';
import { 
  X, 
  Bookmark, 
  Trash2, 
  ExternalLink, 
  Gamepad2, 
  Newspaper, 
  Star, 
  Tv, 
  Heart,
  ArrowRight,
  Bell,
  Sliders,
  TrendingDown
} from 'lucide-react';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedGames: Game[];
  bookmarkedArticles: NewsArticle[];
  onRemoveGame: (gameId: string) => void;
  onRemoveArticle: (articleId: string) => void;
  onSelectGame: (game: Game) => void;
  onSelectArticle: (article: NewsArticle) => void;
  onClearAll: () => void;
  onOpenProfileWishlist?: () => void;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  isOpen,
  onClose,
  savedGames,
  bookmarkedArticles,
  onRemoveGame,
  onRemoveArticle,
  onSelectGame,
  onSelectArticle,
  onClearAll,
  onOpenProfileWishlist
}) => {
  if (!isOpen) return null;

  const totalCount = savedGames.length + bookmarkedArticles.length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-stone-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-base text-text-main h-full shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-base">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface-brand text-brand border border-brand/30 flex items-center justify-center">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif-natural text-base font-normal text-text-heading">
                My Cozy PC Wishlist & Shelf
              </h2>
              <span className="text-xs text-text-muted">
                {totalCount} saved item{totalCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalCount > 0 && (
              <button
                onClick={onClearAll}
                className="text-[11px] text-text-muted hover:text-accent transition-colors mr-2 font-medium cursor-pointer"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-base hover:bg-surface text-text-muted hover:text-text-main border border-border cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Shelf Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {totalCount === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 rounded-full bg-surface text-text-faint flex items-center justify-center mx-auto border border-border">
                <Heart className="w-6 h-6" />
              </div>
              <h3 className="font-serif-natural font-normal text-sm text-text-heading">Your Cozy Shelf is empty</h3>
              <p className="text-xs text-text-muted max-w-xs mx-auto">
                Tap the heart icon on any PC game or bookmark icon on articles to save them here and receive discount alerts.
              </p>
            </div>
          ) : (
            <>
              {/* Saved Games */}
              {savedGames.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-brand">
                    <span className="flex items-center gap-1.5">
                      <Gamepad2 className="w-3.5 h-3.5" />
                      Wishlisted PC Games ({savedGames.length})
                    </span>
                    {onOpenProfileWishlist && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenProfileWishlist();
                        }}
                        className="text-[10px] text-text-heading hover:text-brand font-bold flex items-center gap-1 cursor-pointer lowercase"
                      >
                        <span>manage alerts</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {savedGames.map((game) => (
                      <div
                        key={game.id}
                        className="bg-base p-3 rounded-2xl border border-border flex items-center justify-between gap-3 group hover:border-brand transition-colors"
                      >
                        <div
                          onClick={() => {
                            onSelectGame(game);
                            onClose();
                          }}
                          className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                        >
                          <img
                            src={game.coverImage}
                            alt={game.title}
                            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-border"
                          />
                          <div className="min-w-0">
                            <h4 className="font-serif-natural font-normal text-xs text-text-heading group-hover:text-brand truncate">
                              {game.title}
                            </h4>
                            <div className="text-[10px] text-text-muted mt-0.5 flex items-center gap-2">
                              <span className="font-bold text-text-heading">{game.salePrice || game.price}</span>
                              {game.isOnSale && (
                                <span className="text-accent font-bold">
                                  (-{game.discountPercent}%)
                                </span>
                              )}
                              <span>•</span>
                              <span className="text-brand font-bold">{game.cozyScore} Cozy</span>
                              {game.steamDeckStatus === 'Verified' && (
                                <span className="text-text-heading">Deck ✓</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={game.steamStoreUrl || game.storeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-text-muted hover:text-brand hover:bg-surface transition-colors cursor-pointer"
                            title="Open on Steam"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => onRemoveGame(game.id)}
                            className="p-1.5 rounded-lg text-text-faint hover:text-accent hover:bg-surface transition-colors cursor-pointer"
                            title="Remove from shelf"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bookmarked Articles */}
              {bookmarkedArticles.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-brand">
                    <span className="flex items-center gap-1.5">
                      <Newspaper className="w-3.5 h-3.5" />
                      Saved Articles ({bookmarkedArticles.length})
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {bookmarkedArticles.map((article) => (
                      <div
                        key={article.id}
                        className="bg-base p-3 rounded-2xl border border-border flex items-center justify-between gap-3 group hover:border-brand transition-colors"
                      >
                        <div
                          onClick={() => {
                            onSelectArticle(article);
                            onClose();
                          }}
                          className="min-w-0 cursor-pointer flex-1"
                        >
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-surface-brand text-text-heading border border-brand/30">
                            {article.source}
                          </span>
                          <h4 className="font-serif-natural font-normal text-xs text-text-heading group-hover:text-brand line-clamp-1 mt-1">
                            {article.title}
                          </h4>
                          <span className="text-[10px] text-text-muted">
                            {article.readTimeMinutes} min read
                          </span>
                        </div>

                        <button
                          onClick={() => onRemoveArticle(article.id)}
                          className="p-1.5 rounded-lg text-text-faint hover:text-accent hover:bg-surface transition-colors cursor-pointer"
                          title="Remove bookmark"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Action */}
        {onOpenProfileWishlist && (
          <div className="p-4 bg-surface border-t border-border">
            <button
              onClick={() => {
                onClose();
                onOpenProfileWishlist();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Open Wishlist Preferences & Alerts</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
