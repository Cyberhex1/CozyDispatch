import React, { useState, useMemo, useEffect } from 'react';
import { Game, GameCategory, BrowserFilterType, SteamDeckStatus } from '../types';
import { formatRating } from '../utils/format';
import { 
  Gamepad2, 
  Search, 
  SlidersHorizontal, 
  Tv, 
  Star, 
  Heart, 
  Flame, 
  Sparkles, 
  Gem, 
  Clock, 
  Grid, 
  List, 
  ExternalLink,
  ShieldCheck,
  Check,
  RotateCcw,
  Tag,
  Calendar,
  ShoppingBag
} from 'lucide-react';

interface GameBrowserProps {
  games: Game[];
  selectedCategory: GameCategory | 'all';
  onCategoryChange: (category: GameCategory | 'all') => void;
  onSelectGame: (game: Game) => void;
  onToggleWishlist: (gameId: string) => void;
  isWishlisted: (gameId: string) => boolean;
}

export const GameBrowser: React.FC<GameBrowserProps> = ({
  games,
  selectedCategory,
  onCategoryChange,
  onSelectGame,
  onToggleWishlist,
  isWishlisted
}) => {
  // Filter Tabs
  const [filterType, setFilterType] = useState<BrowserFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deckOnly, setDeckOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [minCozyScore, setMinCozyScore] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'rating' | 'cozy' | 'reviews' | 'newest' | 'price'>('rating');

  // Pagination: render a page of results at a time so the 1,000+ game catalog
  // stays responsive. "Show More" reveals the next page.
  const PAGE_SIZE = 48;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset pagination whenever the active filters change.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [games, selectedCategory, filterType, deckOnly, minCozyScore, selectedTag, searchQuery, sortBy]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => g.tags.forEach((t) => set.add(t)));
    return Array.from(set).slice(0, 15);
  }, [games]);

  // Filtered & Sorted list
  const filteredGames = useMemo(() => {
    return games
      .filter((game) => {
        // Category Filter
        if (selectedCategory !== 'all' && game.category !== selectedCategory) {
          if (selectedCategory === 'steam-deck' && game.steamDeckStatus !== 'Verified') {
            return false;
          }
          if (selectedCategory !== 'steam-deck') {
            return false;
          }
        }

        // Required Browser Filter Types: Newly Released, Popular, Highly Rated, Hidden Gems
        if (filterType === 'newly_released' && !game.isNewlyReleased) return false;
        if (filterType === 'popular' && !game.isPopular) return false;
        if (filterType === 'highly_rated' && !game.isHighlyRated) return false;
        if (filterType === 'hidden_gems' && !game.isHiddenGem) return false;

        // Steam Deck Verified toggle
        if (deckOnly && game.steamDeckStatus !== 'Verified') return false;

        // Min Cozy score
        if (game.cozyScore < minCozyScore) return false;

        // Tag filter
        if (selectedTag && !game.tags.includes(selectedTag)) return false;

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = game.title.toLowerCase().includes(q);
          const matchDev = game.developer.toLowerCase().includes(q);
          const matchTag = game.tags.some((t) => t.toLowerCase().includes(q));
          const matchVibe = game.vibes.some((v) => v.toLowerCase().includes(q));
          if (!matchTitle && !matchDev && !matchTag && !matchVibe) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') return b.ratingScore - a.ratingScore;
        if (sortBy === 'cozy') return b.cozyScore - a.cozyScore;
        if (sortBy === 'newest') return (b.isNewlyReleased ? 1 : 0) - (a.isNewlyReleased ? 1 : 0);
        if (sortBy === 'reviews') {
          const countA = parseInt(a.totalReviews.replace(/,/g, ''), 10) || 0;
          const countB = parseInt(b.totalReviews.replace(/,/g, ''), 10) || 0;
          return countB - countA;
        }
        if (sortBy === 'price') {
          const pA = parseFloat(a.price.replace('$', '')) || 0;
          const pB = parseFloat(b.price.replace('$', '')) || 0;
          return pA - pB;
        }
        return 0;
      });
  }, [games, selectedCategory, filterType, deckOnly, minCozyScore, selectedTag, searchQuery, sortBy]);

  const resetFilters = () => {
    setFilterType('all');
    setSearchQuery('');
    setDeckOnly(false);
    setSelectedTag(null);
    setMinCozyScore(0);
    onCategoryChange('all');
  };

  return (
    <div className="space-y-6">
      {/* Section Title & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase font-bold text-brand tracking-wider mb-1">
            <Gamepad2 className="w-4 h-4" />
            <span>Curated Relaxing & Indie Games Directory</span>
          </div>
          <h2 className="font-serif-natural text-2xl sm:text-3xl font-normal text-text-heading tracking-tight">
            Steam Game Browser & Sub-Genre Discovery
          </h2>
          <p className="text-text-muted text-sm mt-1">
            Explore indie horror, cozy cooking, job simulators, driving sims, RPGs, and roguelikes with official Steam links and release dates.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <div className="bg-surface p-1 rounded-xl flex items-center gap-1 text-text-muted border border-border">
            <button
              id="browser-view-grid-btn"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-base text-text-heading shadow-xs' : 'hover:text-text-main'
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              id="browser-view-list-btn"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-base text-text-heading shadow-xs' : 'hover:text-text-main'
              }`}
              title="Compact List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'all', label: 'All Curated Titles', icon: Gamepad2, badge: games.length },
          { id: 'newly_released', label: 'Newly Released', icon: Sparkles, badge: games.filter(g => g.isNewlyReleased).length },
          { id: 'popular', label: 'Popular & Trending', icon: Flame, badge: games.filter(g => g.isPopular).length },
          { id: 'highly_rated', label: 'Highly Rated (95%+)', icon: Star, badge: games.filter(g => g.isHighlyRated).length },
          { id: 'hidden_gems', label: 'Hidden Gems', icon: Gem, badge: games.filter(g => g.isHiddenGem).length }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = filterType === tab.id;
          return (
            <button
              key={tab.id}
              id={`filter-tab-${tab.id}-btn`}
              onClick={() => setFilterType(tab.id as BrowserFilterType)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                isActive
                  ? 'bg-brand text-white shadow-xs scale-[1.02]'
                  : 'bg-base hover:bg-surface text-text-muted border border-border'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-inverse' : 'text-brand'}`} />
              <span>{tab.label}</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                isActive ? 'bg-[#7A9977] text-white' : 'bg-surface text-text-muted'
              }`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-genre Categories & Search */}
      <div className="bg-base p-4 rounded-2xl border border-border shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Expanded Sub-Genre Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider mr-1 whitespace-nowrap">
              Sub-Genre:
            </span>
            {[
              { id: 'all', label: 'All Sub-Genres' },
              { id: 'cozy', label: 'Cozy & Wholesome' },
              { id: 'horror', label: 'Indie Horror' },
              { id: 'cooking', label: 'Cozy Cooking' },
              { id: 'job-sim', label: 'Job Simulators' },
              { id: 'driving-sim', label: 'Driving Simulators' },
              { id: 'rpg', label: 'RPG & Adventures' },
              { id: 'roguelike', label: 'Roguelikes' },
              { id: 'simulation', label: 'Simulators' },
              { id: 'indie', label: 'Indie Art' },
              { id: 'steam-deck', label: 'Steam Deck Focus' }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-inverse text-white font-bold'
                    : 'bg-surface hover:bg-border text-text-muted'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, developer, tag, horror, cooking, etc..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm bg-base border border-border focus:outline-hidden focus:border-brand focus:ring-2 focus:ring-[#8BA888]/20 text-text-main"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-faint hover:text-text-main font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Sub-Filters: Deck Verified Toggle, Cozy Scale, Sort By */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#F5F5F0] text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Steam Deck Verified Toggle */}
            <button
              id="deck-verified-toggle-btn"
              onClick={() => setDeckOnly(!deckOnly)}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                deckOnly
                  ? 'bg-surface-brand text-text-heading border-brand'
                  : 'bg-base text-text-muted border-border hover:bg-surface'
              }`}
            >
              <Tv className={`w-3.5 h-3.5 ${deckOnly ? 'text-brand' : 'text-text-faint'}`} />
              <span>Steam Deck Verified Only</span>
              {deckOnly && <Check className="w-3 h-3 text-brand" />}
            </button>

            {/* Cozy Scale Selector */}
            <div className="flex items-center gap-1.5 bg-base px-3 py-1.5 rounded-lg border border-border">
              <Star className="w-3.5 h-3.5 text-accent fill-[#E6A07D]" />
              <span className="font-semibold text-text-muted">Min Cozy Score:</span>
              <select
                value={minCozyScore}
                onChange={(e) => setMinCozyScore(Number(e.target.value))}
                className="bg-transparent font-bold text-text-main focus:outline-hidden cursor-pointer"
              >
                <option value={0}>Any</option>
                <option value={8}>8.0+ (Very Cozy)</option>
                <option value={9}>9.0+ (Maximum Chill)</option>
                <option value={9.5}>9.5+ (Pure Zen)</option>
              </select>
            </div>

            {/* Active Tag Filter */}
            {selectedTag && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-brand text-text-heading font-bold border border-brand/40">
                <span>Tag: #{selectedTag}</span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className="hover:text-text-main font-bold ml-1 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          {/* Sort By Dropdown & Reset */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-base border border-border px-2.5 py-1.5 rounded-lg font-semibold text-text-main focus:outline-hidden cursor-pointer"
              >
                <option value="rating">Top Review Score (%)</option>
                <option value="cozy">Highest Cozy Scale</option>
                <option value="reviews">Most Steam Reviews</option>
                <option value="newest">Newly Released</option>
                <option value="price">Price: Low to High</option>
              </select>
            </div>

            {(filterType !== 'all' || deckOnly || minCozyScore > 0 || selectedTag || searchQuery || selectedCategory !== 'all') && (
              <button
                onClick={resetFilters}
                className="text-brand hover:text-text-heading font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Tag Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <span className="text-[11px] font-semibold text-text-muted whitespace-nowrap">
            Popular Tags:
          </span>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedTag === tag
                  ? 'bg-brand text-white font-bold'
                  : 'bg-surface hover:bg-border text-text-muted'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-text-muted px-1 font-medium">
        <span>
          Showing <strong>{Math.min(visibleCount, filteredGames.length)}</strong>
          {filteredGames.length > visibleCount ? ` of ${filteredGames.length}` : ''} title{filteredGames.length === 1 ? '' : 's'}
        </span>
        {selectedCategory !== 'all' && (
          <span className="capitalize font-semibold text-brand">
            Sub-genre: {selectedCategory}
          </span>
        )}
      </div>

      {/* Empty State */}
      {filteredGames.length === 0 && (
        <div className="bg-base rounded-2xl p-12 text-center border border-border shadow-xs max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-full bg-surface-brand text-brand flex items-center justify-center mx-auto mb-4">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-serif-natural text-lg font-normal text-text-heading">
            No games matched your exact filters
          </h3>
          <p className="text-text-muted text-sm mt-1.5 mb-5">
            Try resetting your sub-genre selection or clearing your search query.
          </p>
          <button
            onClick={resetFilters}
            className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-sm transition-colors cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredGames.slice(0, visibleCount).map((game) => {
            const isSaved = isWishlisted(game.id);
            return (
              <div
                key={game.id}
                className="group bg-base rounded-2xl border border-border overflow-hidden shadow-xs hover:shadow-md hover:border-brand transition-all duration-300 flex flex-col"
              >
                {/* Cover Image & Overlay Badges */}
                <div className="relative aspect-[16/10] bg-surface overflow-hidden">
                  <img
                    src={game.coverImage}
                    alt={game.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />

                  {/* Top Left: Cozy Scale Pill */}
                  <div className="absolute top-2.5 left-2.5 bg-inverse/90 backdrop-blur-xs text-inverse text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1 z-10">
                    <Star className="w-3 h-3 fill-[#E6A07D] text-accent" />
                    <span>{game.cozyScore} / 10</span>
                  </div>

                  {/* Top Right: Wishlist Heart Button */}
                  <button
                    id={`game-card-wishlist-${game.id}-btn`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWishlist(game.id);
                    }}
                    className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-xs shadow-xs transition-all cursor-pointer z-10 ${
                      isSaved
                        ? 'bg-accent text-white'
                        : 'bg-black/60 hover:bg-black/80 text-white'
                    }`}
                    title={isSaved ? 'Remove from Cozy Shelf' : 'Save to Cozy Shelf'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-white' : ''}`} />
                  </button>

                  {/* Bottom Left: Status / Category Tag */}
                  <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1">
                    {game.isNewlyReleased ? (
                      <span className="bg-brand text-white font-bold text-[10px] uppercase px-2 py-0.5 rounded-md shadow-xs">
                        New Release
                      </span>
                    ) : game.steamDeckStatus === 'Verified' ? (
                      <span className="bg-surface-brand text-text-heading font-bold text-[10px] px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1 border border-brand/40">
                        <Tv className="w-3 h-3 text-brand" />
                        Deck Verified
                      </span>
                    ) : null}
                  </div>

                  {/* Bottom Right: Release Date (USER REQUIREMENT) */}
                  <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-xs text-inverse text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1 border border-white/20 z-10">
                    <Calendar className="w-3 h-3 text-brand" />
                    <span>{game.releaseDate}</span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        onClick={() => onSelectGame(game)}
                        className="font-display text-base font-bold text-text-main group-hover:text-brand transition-colors line-clamp-1 cursor-pointer"
                      >
                        {game.title}
                      </h3>
                      <span className="font-bold text-text-heading text-sm whitespace-nowrap">
                        {game.price}
                      </span>
                    </div>

                    <p className="text-xs text-text-muted mt-0.5">
                      by {game.developer}
                    </p>

                    <p className="text-xs text-text-muted line-clamp-2 mt-2 leading-relaxed">
                      {game.shortDescription}
                    </p>
                  </div>

                  {/* Review Score & Tag list */}
                  <div className="pt-2 border-t border-[#F5F5F0] space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-brand font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-brand" />
                        {formatRating(game.ratingScore, ' Positive')} ({game.totalReviews})
                      </span>
                      <span className="text-text-muted font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-text-faint" />
                        {game.releaseDate}
                      </span>
                    </div>

                    {/* Vibe Tags */}
                    <div className="flex flex-wrap gap-1">
                      {game.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-text-muted font-medium"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    {/* Action buttons with direct Steam Store Link */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        id={`game-card-details-${game.id}-btn`}
                        onClick={() => onSelectGame(game)}
                        className="flex-1 py-2 rounded-xl bg-inverse hover:bg-[#4A4A40] text-white font-bold text-xs transition-colors text-center cursor-pointer shadow-xs"
                      >
                        View Details
                      </button>

                      <a
                        href={game.steamStoreUrl || game.storeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-2 rounded-xl bg-[#171a21] hover:bg-[#2a475e] text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                        title="View on Steam Store"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-[#66c0f4]" />
                        <span>Steam</span>
                        <ExternalLink className="w-3 h-3 text-white/70" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredGames.slice(0, visibleCount).map((game) => {
            const isSaved = isWishlisted(game.id);
            return (
              <div
                key={game.id}
                onClick={() => onSelectGame(game)}
                className="group bg-base p-4 rounded-2xl border border-border shadow-xs hover:shadow-md hover:border-brand transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={game.coverImage}
                      alt={game.title}
                      className="w-20 h-20 rounded-xl object-cover"
                    />
                    <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      {game.releaseDate}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-bold text-base text-text-main group-hover:text-brand transition-colors">
                        {game.title}
                      </h3>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-surface-brand text-text-heading">
                        {game.price}
                      </span>
                      {game.steamDeckStatus === 'Verified' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-brand text-text-heading flex items-center gap-1 border border-brand/40">
                          <Tv className="w-3 h-3 text-brand" />
                          Deck Verified
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-text-muted line-clamp-1 mt-1">
                      {game.shortDescription}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted mt-2">
                      <span className="text-brand font-bold flex items-center gap-1">
                        <Star className="w-3 h-3 fill-[#E6A07D] text-accent" />
                        Cozy Score: {game.cozyScore}/10
                      </span>
                      <span>•</span>
                      <span className="text-brand font-semibold">
                        {formatRating(game.ratingScore, ' Positive')}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-text-faint" />
                        Released {game.releaseDate}
                      </span>
                      <span>•</span>
                      <span>{game.developer}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWishlist(game.id);
                    }}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      isSaved
                        ? 'bg-accent/20 border-[#E6A07D]/50 text-text-heading'
                        : 'bg-surface border-border hover:bg-border text-text-muted'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isSaved ? 'fill-[#E6A07D] text-accent' : ''}`} />
                  </button>

                  <a
                    href={game.steamStoreUrl || game.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-2 rounded-xl bg-[#171a21] hover:bg-[#2a475e] text-white font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-[#66c0f4]" />
                    <span>Steam</span>
                  </a>

                  <button
                    onClick={() => onSelectGame(game)}
                    className="px-4 py-2 rounded-xl bg-inverse hover:bg-[#4A4A40] text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    Specs
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More Pagination */}
      {filteredGames.length > visibleCount && (
        <div className="flex justify-center pt-6">
          <button
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="px-8 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-sm transition-colors shadow-xs cursor-pointer"
          >
            Show More Games ({filteredGames.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
};

