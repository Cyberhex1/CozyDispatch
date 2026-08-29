import React, { useState, useEffect } from 'react';
import { Game } from '../types';
import { formatRating } from '../utils/format';
import { 
  Sparkles, 
  Tv, 
  Flame, 
  Heart, 
  ExternalLink, 
  Info, 
  ChevronRight, 
  ChevronLeft,
  Star,
  Tag,
  ShieldCheck,
  Check,
  Calendar,
  ShoppingBag
} from 'lucide-react';

interface HeroFeaturedSectionProps {
  featuredGames: Game[];
  onSelectGame: (game: Game) => void;
  onToggleWishlist: (gameId: string) => void;
  isWishlisted: (gameId: string) => boolean;
}

export const HeroFeaturedSection: React.FC<HeroFeaturedSectionProps> = ({
  featuredGames,
  onSelectGame,
  onToggleWishlist,
  isWishlisted
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-rotate every 9 seconds
  useEffect(() => {
    if (featuredGames.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % featuredGames.length);
    }, 9000);
    return () => clearInterval(interval);
  }, [featuredGames.length]);

  if (!featuredGames || featuredGames.length === 0) return null;

  const activeGame = featuredGames[activeIndex] || featuredGames[0];
  const isSaved = isWishlisted(activeGame.id);

  return (
    <section className="relative overflow-hidden bg-base text-text-main rounded-3xl border border-border shadow-xs my-4 sm:my-6 transition-colors">
      {/* Background Ambient Glow & Image */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src={activeGame.bannerImage || activeGame.coverImage}
          alt={activeGame.title}
          className="w-full h-full object-cover object-center opacity-10 filter blur-xs scale-105 transition-all duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/90 to-base/80" />
      </div>

      <div className="relative z-10 p-4 sm:p-7 lg:p-9">
        {/* Section Header with Spotlight Badge & Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-surface-brand text-text-heading border border-brand/40 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4 text-brand" />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-brand block leading-tight">
                Weekly Spotlight
              </span>
              <h2 className="font-serif-natural text-lg sm:text-2xl font-normal text-text-heading tracking-tight leading-tight">
                Top 5 Most Talked-About Indie & Cozy Releases
              </h2>
            </div>
          </div>

          {/* Quick Pagination indicator */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <span className="text-xs text-text-muted font-medium mr-1">
              {activeIndex + 1} of {featuredGames.length}
            </span>
            <button
              id="hero-prev-btn"
              onClick={() => setActiveIndex((prev) => (prev - 1 + featuredGames.length) % featuredGames.length)}
              className="p-2 sm:p-2.5 rounded-full bg-surface hover:bg-border text-text-muted hover:text-text-main transition-colors cursor-pointer border border-border min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation"
              title="Previous featured title"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              id="hero-next-btn"
              onClick={() => setActiveIndex((prev) => (prev + 1) % featuredGames.length)}
              className="p-2 sm:p-2.5 rounded-full bg-surface hover:bg-border text-text-muted hover:text-text-main transition-colors cursor-pointer border border-border min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation"
              title="Next featured title"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center">
          {/* Left Column: Game Cover Image & Overlay Badges */}
          <div className="lg:col-span-5 relative group">
            <div className="relative rounded-2xl overflow-hidden shadow-md border border-border aspect-[16/10] bg-surface">
              <img
                src={activeGame.coverImage}
                alt={activeGame.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              
              {/* Cozy Score Pill */}
              <div className="absolute top-2.5 left-2.5 bg-inverse/90 backdrop-blur-xs text-text-on-inverse text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1.5 z-10">
                <Star className="w-3.5 h-3.5 fill-[#E6A07D] text-accent" />
                <span>Cozy: {activeGame.cozyScore} / 10</span>
              </div>

              {/* Steam Deck Badge */}
              <div className="absolute top-2.5 right-2.5 bg-surface-brand/95 backdrop-blur-xs border border-brand/50 text-text-heading text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1.5 z-10">
                <Tv className="w-3.5 h-3.5 text-brand" />
                <span>Deck: {activeGame.steamDeckStatus}</span>
              </div>

              {/* Price Tag & Demo */}
              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 z-10">
                <span className="bg-inverse text-text-on-inverse text-xs font-bold px-2.5 py-1 rounded-lg shadow-xs">
                  {activeGame.price}
                </span>
                {activeGame.demoAvailable && (
                  <span className="bg-brand text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded-lg shadow-xs backdrop-blur-xs">
                    Demo
                  </span>
                )}
              </div>

              {/* Bottom Right: Release Date */}
              <div className="absolute bottom-2.5 right-2.5 bg-black/85 backdrop-blur-xs text-white text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-1.5 border border-white/20 z-10">
                <Calendar className="w-3.5 h-3.5 text-brand" />
                <span>{activeGame.releaseDate}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Title, Details, Vibe Tags & Actions */}
          <div className="lg:col-span-7 space-y-3 sm:space-y-4">
            {/* Trending highlight quote */}
            {activeGame.featuredReason && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-brand border border-brand/40 text-text-heading text-xs font-medium max-w-full">
                <Sparkles className="w-3.5 h-3.5 text-brand shrink-0" />
                <span className="truncate"><strong>Why it's buzzing:</strong> {activeGame.featuredReason}</span>
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h3 className="font-serif-natural text-xl sm:text-3xl lg:text-4xl font-normal text-text-heading tracking-tight leading-tight">
                  {activeGame.title}
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface text-text-muted border border-border">
                  {activeGame.developer}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-text-muted mt-1.5">
                <span className="text-brand font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {formatRating(activeGame.ratingScore, ` ${activeGame.reviewSentiment}`)}
                </span>
                <span>•</span>
                <span>{activeGame.totalReviews} Steam Reviews</span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">Platforms: {activeGame.platforms.join(', ')}</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-text-muted line-clamp-3 leading-relaxed">
              {activeGame.shortDescription}
            </p>

            {/* Cozy Vibe Points */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {activeGame.vibes.map((vibe) => (
                <span
                  key={vibe}
                  className="text-xs px-2.5 py-1 rounded-lg bg-surface text-text-heading border border-border flex items-center gap-1 font-medium"
                >
                  <Tag className="w-3 h-3 text-brand" />
                  {vibe}
                </span>
              ))}
            </div>

            {/* Steam Deck Notes Highlight */}
            <div className="p-3 rounded-xl bg-surface border border-border text-xs text-text-heading flex items-start gap-2.5">
              <Tv className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <div>
                <strong className="text-text-heading font-bold">Steam Deck Experience: </strong>
                <span className="text-text-muted">{activeGame.steamDeckNotes}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 pt-1">
              <button
                id={`featured-inspect-${activeGame.id}-btn`}
                onClick={() => onSelectGame(activeGame)}
                className="w-full sm:w-auto justify-center px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center gap-2 cursor-pointer min-h-[44px] touch-manipulation"
              >
                <Info className="w-4 h-4" />
                <span>Read Full Dispatch & Specs</span>
              </button>

              <button
                id={`featured-wishlist-${activeGame.id}-btn`}
                onClick={() => onToggleWishlist(activeGame.id)}
                className={`w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border flex items-center gap-2 cursor-pointer min-h-[44px] touch-manipulation ${
                  isSaved
                    ? 'bg-accent/20 text-text-heading border-[#E6A07D]/50'
                    : 'bg-surface hover:bg-border text-text-heading border-border'
                }`}
              >
                {isSaved ? (
                  <>
                    <Check className="w-4 h-4 text-brand" />
                    <span>On Cozy Shelf</span>
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4 text-accent" />
                    <span>Save to Shelf</span>
                  </>
                )}
              </button>

              <a
                href={activeGame.steamStoreUrl || activeGame.storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl bg-[#171a21] hover:bg-[#2a475e] text-white text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer min-h-[44px] touch-manipulation"
              >
                <ShoppingBag className="w-4 h-4 text-[#66c0f4]" />
                <span>Steam Store</span>
                <ExternalLink className="w-3.5 h-3.5 text-white/70" />
              </a>
            </div>
          </div>
        </div>

        {/* Thumbnail Selector for the 5 titles */}
        <div className="mt-5 sm:mt-7 pt-4 sm:pt-5 border-t border-border flex lg:grid lg:grid-cols-5 gap-2 sm:gap-3 overflow-x-auto no-scrollbar pb-1">
          {featuredGames.map((game, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={game.id}
                id={`featured-thumb-${idx}-btn`}
                onClick={() => setActiveIndex(idx)}
                className={`shrink-0 w-48 sm:w-56 lg:w-auto text-left p-2.5 rounded-xl transition-all border cursor-pointer min-h-[44px] touch-manipulation ${
                  isSelected
                    ? 'bg-surface-brand border-brand shadow-xs ring-1 ring-brand/30'
                    : 'bg-surface border-border hover:bg-border/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={game.coverImage}
                    alt={game.title}
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-brand flex items-center gap-1">
                      <span>#{idx + 1}</span>
                      <span className="truncate">{game.category}</span>
                    </div>
                    <div className={`text-xs font-bold truncate ${isSelected ? 'text-text-heading' : 'text-text-main'}`}>
                      {game.title}
                    </div>
                    <div className="text-[10px] text-text-muted truncate">
                      {game.price} • {formatRating(game.ratingScore, ' Pos')}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
