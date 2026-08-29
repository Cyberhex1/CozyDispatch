import React, { useState, useMemo } from 'react';
import { Game } from '../types';
import { formatRating } from '../utils/format';
import { 
  Percent, 
  Tv, 
  Star, 
  Heart, 
  Clock, 
  ExternalLink, 
  Sparkles, 
  TrendingDown, 
  ArrowUpDown,
  Calendar
} from 'lucide-react';

interface DealsAndSalesSectionProps {
  games: Game[];
  onSelectGame: (game: Game) => void;
  onToggleWishlist: (gameId: string) => void;
  isWishlisted: (gameId: string) => boolean;
  onOpenQuiz: () => void;
}

export const DealsAndSalesSection: React.FC<DealsAndSalesSectionProps> = ({
  games,
  onSelectGame,
  onToggleWishlist,
  isWishlisted,
  onOpenQuiz
}) => {
  const [platformFilter, setPlatformFilter] = useState<'all' | 'steam' | 'epic'>('all');
  const [discountFilter, setDiscountFilter] = useState<'all' | '50plus' | '30plus' | 'under10' | 'under5'>('all');
  const [deckOnly, setDeckOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'discount' | 'price_low' | 'rating' | 'cozy' | 'expiring'>('discount');

  // Filter only games with deals or pricing offers
  const discountedGames = useMemo(() => {
    return games.filter((g) => {
      // Must be on sale or have a discount
      if (!g.isOnSale && (!g.discountPercent || g.discountPercent <= 0)) {
        return false;
      }

      // Platform filter
      if (platformFilter === 'steam' && g.storePlatform !== 'Steam' && g.storePlatform !== 'Both') {
        return false;
      }
      if (platformFilter === 'epic' && g.storePlatform !== 'Epic Games' && g.storePlatform !== 'Both') {
        return false;
      }

      // Steam Deck filter
      if (deckOnly && g.steamDeckStatus !== 'Verified') {
        return false;
      }

      // Price / Discount Filter
      const discount = g.discountPercent || 0;
      const currentPriceNum = parseFloat((g.salePrice || g.price).replace('$', '')) || 0;

      if (discountFilter === '50plus' && discount < 50) return false;
      if (discountFilter === '30plus' && discount < 30) return false;
      if (discountFilter === 'under10' && currentPriceNum > 10) return false;
      if (discountFilter === 'under5' && currentPriceNum > 5) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'discount') {
        return (b.discountPercent || 0) - (a.discountPercent || 0);
      }
      if (sortBy === 'price_low') {
        const pA = parseFloat((a.salePrice || a.price).replace('$', '')) || 0;
        const pB = parseFloat((b.salePrice || b.price).replace('$', '')) || 0;
        return pA - pB;
      }
      if (sortBy === 'rating') {
        return b.ratingScore - a.ratingScore;
      }
      if (sortBy === 'cozy') {
        return b.cozyScore - a.cozyScore;
      }
      if (sortBy === 'expiring') {
        return (a.saleDurationDays || 99) - (b.saleDurationDays || 99);
      }
      return 0;
    });
  }, [games, platformFilter, discountFilter, deckOnly, sortBy]);

  // Metrics
  const maxDiscount = useMemo(() => {
    return Math.max(...games.map((g) => g.discountPercent || 0), 0);
  }, [games]);

  const underTenCount = useMemo(() => {
    return games.filter((g) => {
      const p = parseFloat((g.salePrice || g.price).replace('$', '')) || 0;
      return (g.isOnSale || (g.discountPercent && g.discountPercent > 0)) && p <= 10;
    }).length;
  }, [games]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      
      {/* Deals Header Banner */}
      <div className="relative rounded-3xl bg-surface border border-border p-5 sm:p-8 overflow-hidden shadow-xs">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-accent/15 via-brand/10 to-transparent rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs uppercase font-bold text-accent tracking-wider">
              <Percent className="w-4 h-4" />
              <span>Live PC Discounts & Special Deals</span>
            </div>
            <h1 className="font-serif-natural text-2xl sm:text-3xl lg:text-4xl font-normal text-text-heading tracking-tight leading-tight">
              Cozy & Indie PC Deals & Sales
            </h1>
            <p className="text-text-muted text-xs sm:text-sm leading-relaxed">
              Curated discounts across Steam and Epic Games. Save up to {maxDiscount}% on verified relaxing titles, track historical lows, and save to your wishlist.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
            <div className="bg-surface-brand px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl border border-brand/30 text-center min-w-[90px] sm:min-w-[110px]">
              <div className="text-lg sm:text-xl font-bold text-text-heading">
                Up to {maxDiscount}%
              </div>
              <div className="text-[10px] sm:text-[11px] font-medium text-text-muted">Max Discount</div>
            </div>

            <div className="bg-base px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl border border-border text-center min-w-[90px] sm:min-w-[110px]">
              <div className="text-lg sm:text-xl font-bold text-brand">
                {underTenCount} Titles
              </div>
              <div className="text-[10px] sm:text-[11px] font-medium text-text-muted">Under $10 Deals</div>
            </div>

            <button
              onClick={onOpenQuiz}
              className="col-span-2 sm:col-span-1 bg-brand hover:bg-brand-hover text-white px-4 py-2.5 sm:py-3 rounded-2xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px] touch-manipulation"
            >
              <Sparkles className="w-4 h-4" />
              <span>Find Deals for Me</span>
            </button>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Sorting */}
      <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-border shadow-xs space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          {/* Platform Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <span className="text-[11px] sm:text-xs font-bold uppercase text-text-muted mr-1 whitespace-nowrap">Platform:</span>
            <button
              onClick={() => setPlatformFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[38px] touch-manipulation ${
                platformFilter === 'all'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-base text-text-muted hover:text-text-heading border border-border'
              }`}
            >
              All Stores
            </button>
            <button
              onClick={() => setPlatformFilter('steam')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[38px] touch-manipulation ${
                platformFilter === 'steam'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-base text-text-muted hover:text-text-heading border border-border'
              }`}
            >
              <span>Steam</span>
            </button>
            <button
              onClick={() => setPlatformFilter('epic')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[38px] touch-manipulation ${
                platformFilter === 'epic'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-base text-text-muted hover:text-text-heading border border-border'
              }`}
            >
              <span>Epic Store</span>
            </button>
          </div>

          {/* Steam Deck Verified Toggle */}
          <button
            onClick={() => setDeckOnly(!deckOnly)}
            className={`self-start sm:self-auto px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[38px] touch-manipulation ${
              deckOnly
                ? 'bg-surface-brand text-text-heading border border-brand'
                : 'bg-base text-text-muted hover:text-text-heading border border-border'
            }`}
          >
            <Tv className="w-3.5 h-3.5 text-brand" />
            <span>Deck Verified Only</span>
          </button>
        </div>

        {/* Discount range tabs & Sort selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pt-3 border-t border-border">
          {/* Discount range tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <button
              onClick={() => setDiscountFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap min-h-[36px] touch-manipulation ${
                discountFilter === 'all' ? 'bg-border text-text-heading font-bold' : 'text-text-muted hover:text-text-main'
              }`}
            >
              All Discounts
            </button>
            <button
              onClick={() => setDiscountFilter('50plus')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap min-h-[36px] touch-manipulation ${
                discountFilter === '50plus' ? 'bg-border text-text-heading font-bold' : 'text-text-muted hover:text-text-main'
              }`}
            >
              50%+ Off
            </button>
            <button
              onClick={() => setDiscountFilter('30plus')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap min-h-[36px] touch-manipulation ${
                discountFilter === '30plus' ? 'bg-border text-text-heading font-bold' : 'text-text-muted hover:text-text-main'
              }`}
            >
              30%+ Off
            </button>
            <button
              onClick={() => setDiscountFilter('under10')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap min-h-[36px] touch-manipulation ${
                discountFilter === 'under10' ? 'bg-border text-text-heading font-bold' : 'text-text-muted hover:text-text-main'
              }`}
            >
              Under $10
            </button>
            <button
              onClick={() => setDiscountFilter('under5')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap min-h-[36px] touch-manipulation ${
                discountFilter === 'under5' ? 'bg-border text-text-heading font-bold' : 'text-text-muted hover:text-text-main'
              }`}
            >
              Under $5
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs text-text-muted font-bold">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-base text-xs text-text-heading font-bold rounded-xl px-3 py-1.5 border border-border focus:outline-hidden cursor-pointer min-h-[38px]"
            >
              <option value="discount">Highest Discount %</option>
              <option value="price_low">Lowest Price</option>
              <option value="rating">Steam Reviews Score</option>
              <option value="cozy">Cozy Score</option>
              <option value="expiring">Ending Soonest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Deals Grid */}
      {discountedGames.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-3xl border border-border p-8 space-y-3">
          <Percent className="w-12 h-12 text-brand mx-auto opacity-50" />
          <h3 className="font-serif-natural text-xl text-text-heading">No matching PC deals found</h3>
          <p className="text-xs sm:text-sm text-text-muted max-w-md mx-auto">
            Try adjusting your discount filter or platform preferences to discover more PC sales.
          </p>
          <button
            onClick={() => {
              setPlatformFilter('all');
              setDiscountFilter('all');
              setDeckOnly(false);
            }}
            className="mt-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-brand text-white hover:bg-brand-hover transition-colors cursor-pointer min-h-[44px] touch-manipulation"
          >
            Reset Deal Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {discountedGames.map((game) => {
            const isWish = isWishlisted(game.id);
            return (
              <div
                key={game.id}
                className="group relative bg-surface rounded-3xl border border-border hover:border-brand transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md flex flex-col justify-between"
              >
                {/* Cover Image + Badges */}
                <div 
                  className="relative aspect-[16/10] overflow-hidden bg-base cursor-pointer"
                  onClick={() => onSelectGame(game)}
                >
                  <img
                    src={game.bannerImage || game.coverImage}
                    alt={game.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900/70 via-transparent to-transparent" />

                  {/* Discount percentage badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="bg-accent text-white font-bold text-xs px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5" />
                      -{game.discountPercent || 20}%
                    </span>

                    {game.isHistoricalLow && (
                      <span className="bg-inverse text-text-on-inverse font-bold text-[10px] px-2 py-0.5 rounded-full border border-white/20">
                        ★ Historical Low
                      </span>
                    )}
                  </div>

                  {/* Wishlist toggle button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWishlist(game.id);
                    }}
                    className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-transform active:scale-95 cursor-pointer shadow-xs min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation z-10 ${
                      isWish
                        ? 'bg-accent text-white'
                        : 'bg-black/60 hover:bg-black/80 text-white'
                    }`}
                    title={isWish ? 'Saved to Wishlist' : 'Add to Wishlist & Enable Sale Alerts'}
                  >
                    <Heart className={`w-4 h-4 ${isWish ? 'fill-current' : ''}`} />
                  </button>

                  {/* Platform & Release Date */}
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white text-xs">
                    <span className="bg-stone-900/80 px-2 py-0.5 rounded-md text-[11px] font-medium backdrop-blur-xs">
                      {game.storePlatform === 'Both' ? 'Steam & Epic' : game.storePlatform || 'Steam'}
                    </span>

                    <span className="bg-black/80 text-white font-bold px-2 py-0.5 rounded-md text-[10px] flex items-center gap-1 border border-white/20">
                      <Calendar className="w-3 h-3 text-brand" />
                      <span>{game.releaseDate}</span>
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 
                        onClick={() => onSelectGame(game)}
                        className="font-serif-natural text-base sm:text-lg font-normal text-text-heading hover:text-brand cursor-pointer transition-colors line-clamp-1"
                      >
                        {game.title}
                      </h3>
                      <div className="flex items-center gap-1 text-brand text-xs font-bold shrink-0">
                        <Star className="w-3.5 h-3.5 fill-[#8BA888]" />
                        <span>{game.cozyScore}</span>
                      </div>
                    </div>

                    <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                      {game.shortDescription}
                    </p>

                    {/* Sale duration countdown */}
                    {game.saleEndsAt && (
                      <div className="flex items-center gap-1.5 text-[11px] text-text-muted bg-base px-2.5 py-1 rounded-xl border border-border">
                        <Clock className="w-3 h-3 text-brand" />
                        <span>Sale ends {game.saleEndsAt} ({game.saleDurationDays || 3}d left)</span>
                      </div>
                    )}
                  </div>

                  {/* Price & Action Row */}
                  <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base sm:text-lg font-bold text-text-heading">
                          {game.salePrice || game.price}
                        </span>
                        {game.originalPrice && game.originalPrice !== game.price && (
                          <span className="text-xs text-text-faint line-through">
                            {game.originalPrice}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-brand font-bold">
                        {formatRating(game.ratingScore, ' Pos')}
                      </div>
                    </div>

                    <a
                      href={game.steamStoreUrl || game.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer min-h-[38px] touch-manipulation"
                      title="Open on Store"
                    >
                      <span>Store</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
