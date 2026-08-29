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
    <section className="relative overflow-hidden bg-white text-[#4A4A40] rounded-3xl border border-[#E6E2D3] shadow-xs my-6">
      {/* Background Ambient Glow & Image */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src={activeGame.bannerImage || activeGame.coverImage}
          alt={activeGame.title}
          className="w-full h-full object-cover object-center opacity-10 filter blur-xs scale-105 transition-all duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/90 to-[#FDFBF7]/80" />
      </div>

      <div className="relative z-10 p-6 sm:p-8 lg:p-10">
        {/* Section Header with Week Badge */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EBF0EA] text-[#5A5A40] border border-[#8BA888]/40 flex items-center justify-center">
              <Flame className="w-4 h-4 text-[#8BA888]" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-bold text-[#8BA888]">
                Weekly Spotlight
              </span>
              <h2 className="font-serif-natural text-xl sm:text-2xl font-normal text-[#5A5A40] tracking-tight">
                Top 5 Most Talked-About Indie & Cozy Releases
              </h2>
            </div>
          </div>

          {/* Quick Pagination indicator */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#707060] font-medium mr-2">
              Featured {activeIndex + 1} of {featuredGames.length}
            </span>
            <button
              id="hero-prev-btn"
              onClick={() => setActiveIndex((prev) => (prev - 1 + featuredGames.length) % featuredGames.length)}
              className="p-2 rounded-full bg-[#F5F5F0] hover:bg-[#E6E2D3] text-[#707060] hover:text-[#4A4A40] transition-colors cursor-pointer border border-[#E6E2D3]"
              title="Previous featured title"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              id="hero-next-btn"
              onClick={() => setActiveIndex((prev) => (prev + 1) % featuredGames.length)}
              className="p-2 rounded-full bg-[#F5F5F0] hover:bg-[#E6E2D3] text-[#707060] hover:text-[#4A4A40] transition-colors cursor-pointer border border-[#E6E2D3]"
              title="Next featured title"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Game Image & Steam Deck Badge */}
          <div className="lg:col-span-5 relative group">
            <div className="relative rounded-2xl overflow-hidden shadow-md border border-[#E6E2D3] aspect-[16/10] bg-[#F5F5F0]">
              <img
                src={activeGame.coverImage}
                alt={activeGame.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              
              {/* Cozy Score Pill */}
              <div className="absolute top-3 left-3 bg-[#5A5A40]/90 backdrop-blur-xs text-[#FDFBF7] text-xs font-bold px-3 py-1 rounded-full shadow-xs flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 fill-[#E6A07D] text-[#E6A07D]" />
                <span>Cozy Scale: {activeGame.cozyScore} / 10</span>
              </div>

              {/* Steam Deck Badge */}
              <div className="absolute top-3 right-3 bg-[#EBF0EA]/95 backdrop-blur-xs border border-[#8BA888]/50 text-[#5A5A40] text-xs font-bold px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-[#8BA888]" />
                <span>Deck: {activeGame.steamDeckStatus}</span>
              </div>

              {/* Price Tag & Demo */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <span className="bg-[#5A5A40] text-white text-xs font-bold px-3 py-1 rounded-lg shadow-xs">
                  {activeGame.price}
                </span>
                {activeGame.demoAvailable && (
                  <span className="bg-[#8BA888] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xs backdrop-blur-xs">
                    Free Demo Available
                  </span>
                )}
              </div>

              {/* Bottom Right: Release Date (USER REQUIREMENT) */}
              <div className="absolute bottom-3 right-3 bg-black/85 backdrop-blur-xs text-[#FDFBF7] text-xs font-bold px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-1.5 border border-white/20">
                <Calendar className="w-3.5 h-3.5 text-[#8BA888]" />
                <span>{activeGame.releaseDate}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Title, Why Talked About, Description, Vibe Tags & Actions */}
          <div className="lg:col-span-7 space-y-4">
            {/* Why it's trending highlight quote */}
            {activeGame.featuredReason && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EBF0EA] border border-[#8BA888]/40 text-[#5A5A40] text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5 text-[#8BA888] shrink-0" />
                <span><strong>Why it's buzzing:</strong> {activeGame.featuredReason}</span>
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-serif-natural text-2xl sm:text-3xl lg:text-4xl font-normal text-[#5A5A40] tracking-tight">
                  {activeGame.title}
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F5F5F0] text-[#707060] border border-[#E6E2D3]">
                  {activeGame.developer}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-[#707060] mt-2">
                <span className="text-[#8BA888] font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {formatRating(activeGame.ratingScore, ` ${activeGame.reviewSentiment}`)}
                </span>
                <span>•</span>
                <span>{activeGame.totalReviews} Steam Reviews</span>
                <span>•</span>
                <span>Platforms: {activeGame.platforms.join(', ')}</span>
              </div>
            </div>

            <p className="text-sm sm:text-base text-[#707060] line-clamp-3 leading-relaxed">
              {activeGame.shortDescription}
            </p>

            {/* Cozy Vibe Points */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeGame.vibes.map((vibe) => (
                <span
                  key={vibe}
                  className="text-xs px-2.5 py-1 rounded-lg bg-[#F5F5F0] text-[#5A5A40] border border-[#E6E2D3] flex items-center gap-1 font-medium"
                >
                  <Tag className="w-3 h-3 text-[#8BA888]" />
                  {vibe}
                </span>
              ))}
            </div>

            {/* Steam Deck Notes Highlight */}
            <div className="p-3 rounded-xl bg-[#F5F5F0] border border-[#E6E2D3] text-xs text-[#5A5A40] flex items-start gap-2.5">
              <Tv className="w-4 h-4 text-[#8BA888] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#5A5A40] font-bold">Steam Deck Experience: </strong>
                <span className="text-[#707060]">{activeGame.steamDeckNotes}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                id={`featured-inspect-${activeGame.id}-btn`}
                onClick={() => onSelectGame(activeGame)}
                className="px-5 py-2.5 rounded-xl bg-[#8BA888] hover:bg-[#7A9977] text-white font-bold text-sm transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Info className="w-4 h-4" />
                <span>Read Full Dispatch & Specs</span>
              </button>

              <button
                id={`featured-wishlist-${activeGame.id}-btn`}
                onClick={() => onToggleWishlist(activeGame.id)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border flex items-center gap-2 cursor-pointer ${
                  isSaved
                    ? 'bg-[#E6A07D]/20 text-[#5A5A40] border-[#E6A07D]/50'
                    : 'bg-[#F5F5F0] hover:bg-[#E6E2D3] text-[#5A5A40] border-[#E6E2D3]'
                }`}
              >
                {isSaved ? (
                  <>
                    <Check className="w-4 h-4 text-[#8BA888]" />
                    <span>On Cozy Shelf</span>
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4 text-[#E6A07D]" />
                    <span>Save to Shelf</span>
                  </>
                )}
              </button>

              <a
                href={activeGame.steamStoreUrl || activeGame.storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-[#171a21] hover:bg-[#2a475e] text-white text-sm font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-[#66c0f4]" />
                <span>Steam Store</span>
                <ExternalLink className="w-3.5 h-3.5 text-white/70" />
              </a>
            </div>
          </div>
        </div>

        {/* Thumbnail Selector for the 5 titles */}
        <div className="mt-8 pt-6 border-t border-[#E6E2D3] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {featuredGames.map((game, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={game.id}
                id={`featured-thumb-${idx}-btn`}
                onClick={() => setActiveIndex(idx)}
                className={`text-left p-2.5 rounded-xl transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-[#EBF0EA] border-[#8BA888] shadow-xs'
                    : 'bg-[#FDFBF7] border-[#E6E2D3] hover:bg-[#F5F5F0]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={game.coverImage}
                    alt={game.title}
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#8BA888] flex items-center gap-1">
                      <span>#{idx + 1}</span>
                      <span className="truncate">{game.category}</span>
                    </div>
                    <div className={`text-xs font-bold truncate ${isSelected ? 'text-[#5A5A40]' : 'text-[#707060]'}`}>
                      {game.title}
                    </div>
                    <div className="text-[10px] text-[#A0A090] truncate">
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
