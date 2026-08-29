import React, { useState, useMemo, useEffect } from 'react';
import { Game, GameCategory, BrowserFilterType } from '../types';
import { formatRating, parseReleaseTimestamp, isGameNewlyReleased } from '../utils/format';
import { matchesGameCategory } from '../utils/categoryMatcher';
import { 
  Gamepad2, 
  Search, 
  Tv, 
  Star, 
  Heart, 
  Flame, 
  Sparkles, 
  Gem, 
  Grid, 
  List, 
  ShieldCheck, 
  Check, 
  RotateCcw, 
  RefreshCw, 
  Calendar
} from 'lucide-react';

interface GameBrowserProps {
  games: Game[];
  selectedCategory: GameCategory | 'all';
  onCategoryChange: (category: GameCategory | 'all') => void;
  onSelectGame: (game: Game) => void;
  onToggleWishlist: (gameId: string) => void;
  isWishlisted: (gameId: string) => boolean;
  initialFilterType?: BrowserFilterType;
  initialSortBy?: 'rating' | 'cozy' | 'reviews' | 'newest' | 'updated' | 'price';
  initialSearchQuery?: string;
  onFilterChange?: (filter: BrowserFilterType) => void;
  onSortChange?: (sort: 'rating' | 'cozy' | 'reviews' | 'newest' | 'updated' | 'price') => void;
  onSearchChange?: (q: string) => void;
}

// Slugs of renowned games that receive active post-launch content patches & updates
const MAJOR_UPDATED_SLUGS = new Set([
  'stardew-valley',
  'fields-of-mistria',
  'balatro',
  'cult-of-the-lamb',
  'dave-the-diver',
  'vampire-survivors',
  'slime-rancher-2',
  'roots-of-pacha',
  'palworld',
  'terraria',
  'coral-island',
  'tiny-glade',
  'dorfromantik',
  'sun-haven',
  'my-time-at-sandrock',
  'moonstone-island',
  'core-keeper',
  'potion-craft-alchemist-simulator',
  'dredge',
  'spiritfarer-farewell-edition',
  'against-the-storm',
  'manor-lords',
  'no-mans-sky',
  'hades',
  'hollow-knight'
]);

function isGameNewlyUpdated(game: Game): boolean {
  if (game.isNewlyUpdated) return true;
  if (game.lastUpdatedAt || game.updateSummary) return true;
  const slug = game.slug || game.id;
  return MAJOR_UPDATED_SLUGS.has(slug) || Array.from(MAJOR_UPDATED_SLUGS).some((s) => slug.includes(s));
}

export const GameBrowser: React.FC<GameBrowserProps> = ({
  games,
  selectedCategory,
  onCategoryChange,
  onSelectGame,
  onToggleWishlist,
  isWishlisted,
  initialFilterType = 'all',
  initialSortBy = 'rating',
  initialSearchQuery = '',
  onFilterChange,
  onSortChange,
  onSearchChange
}) => {
  // Filter Tabs
  const [filterType, setFilterType] = useState<BrowserFilterType>(initialFilterType);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [deckOnly, setDeckOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [minCozyScore, setMinCozyScore] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'rating' | 'cozy' | 'reviews' | 'newest' | 'updated' | 'price'>(initialSortBy);

  const PAGE_SIZE = 48;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Sync external changes
  useEffect(() => {
    if (initialFilterType && initialFilterType !== filterType) {
      setFilterType(initialFilterType);
    }
  }, [initialFilterType]);

  useEffect(() => {
    if (initialSortBy && initialSortBy !== sortBy) {
      setSortBy(initialSortBy);
    }
  }, [initialSortBy]);

  useEffect(() => {
    if (initialSearchQuery !== undefined && initialSearchQuery !== searchQuery) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [games, selectedCategory, filterType, deckOnly, minCozyScore, selectedTag, searchQuery, sortBy]);

  // Extract top unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => g.tags.forEach((t) => set.add(t)));
    return Array.from(set).slice(0, 16);
  }, [games]);

  // Pre-calculate badge counts for tabs
  const newlyReleasedCount = useMemo(() => games.filter((g) => isGameNewlyReleased(g)).length, [games]);
  const newlyUpdatedCount = useMemo(() => games.filter(isGameNewlyUpdated).length, [games]);
  const popularCount = useMemo(() => games.filter((g) => g.isPopular).length, [games]);
  const highlyRatedCount = useMemo(() => games.filter((g) => g.isHighlyRated || g.ratingScore >= 90).length, [games]);
  const hiddenGemsCount = useMemo(() => games.filter((g) => g.isHiddenGem).length, [games]);

  // Filtered & Sorted list
  const filteredGames = useMemo(() => {
    const now = Date.now();

    return games
      .filter((game) => {
        // 1. Unified Category Filter
        if (selectedCategory !== 'all' && !matchesGameCategory(game, selectedCategory)) {
          return false;
        }

        // 2. Browser Filter Types
        if (filterType === 'newly_released' && !isGameNewlyReleased(game, 180, now)) return false;
        if (filterType === 'newly_updated' && !isGameNewlyUpdated(game)) return false;
        if (filterType === 'popular' && !game.isPopular) return false;
        if (filterType === 'highly_rated' && !game.isHighlyRated && game.ratingScore < 90) return false;
        if (filterType === 'hidden_gems' && !game.isHiddenGem) return false;
        if (filterType === 'deals' && !game.isOnSale && (!game.discountPercent || game.discountPercent <= 0)) return false;

        // 3. Steam Deck Verified toggle
        if (deckOnly && game.steamDeckStatus !== 'Verified') return false;

        // 4. Min Cozy score
        if (game.cozyScore < minCozyScore) return false;

        // 5. Tag filter
        if (selectedTag && !game.tags.map((t) => t.toLowerCase()).includes(selectedTag.toLowerCase())) {
          return false;
        }

        // 6. Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = game.title.toLowerCase().includes(q);
          const matchDev = game.developer.toLowerCase().includes(q);
          const matchPub = (game.publisher || '').toLowerCase().includes(q);
          const matchTag = game.tags.some((t) => t.toLowerCase().includes(q));
          const matchVibe = game.vibes.some((v) => v.toLowerCase().includes(q));
          if (!matchTitle && !matchDev && !matchPub && !matchTag && !matchVibe) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') {
          if (b.ratingScore !== a.ratingScore) {
            return b.ratingScore - a.ratingScore;
          }
          const revA = parseInt((a.totalReviews || '0').replace(/,/g, ''), 10) || 0;
          const revB = parseInt((b.totalReviews || '0').replace(/,/g, ''), 10) || 0;
          return revB - revA;
        }

        if (sortBy === 'cozy') {
          if (b.cozyScore !== a.cozyScore) {
            return b.cozyScore - a.cozyScore;
          }
          return b.ratingScore - a.ratingScore;
        }

        if (sortBy === 'newest') {
          const tsA = parseReleaseTimestamp(a.releaseDate, a.releaseStatus, now);
          const tsB = parseReleaseTimestamp(b.releaseDate, b.releaseStatus, now);
          
          const isAUpcoming = a.releaseStatus === 'upcoming' || tsA > now || tsA <= 0;
          const isBUpcoming = b.releaseStatus === 'upcoming' || tsB > now || tsB <= 0;

          // Released games always appear before unreleased/upcoming in 'newest'
          if (!isAUpcoming && isBUpcoming) return -1;
          if (isAUpcoming && !isBUpcoming) return 1;

          // For released games: latest date first (descending)
          if (!isAUpcoming && !isBUpcoming) {
            return tsB - tsA;
          }

          // For upcoming games: soonest expected date first
          return tsA - tsB;
        }

        if (sortBy === 'updated') {
          const aUp = isGameNewlyUpdated(a) ? 1 : 0;
          const bUp = isGameNewlyUpdated(b) ? 1 : 0;
          if (bUp !== aUp) return bUp - aUp;
          return b.ratingScore - a.ratingScore;
        }

        if (sortBy === 'reviews') {
          const countA = parseInt((a.totalReviews || '0').replace(/,/g, ''), 10) || 0;
          const countB = parseInt((b.totalReviews || '0').replace(/,/g, ''), 10) || 0;
          return countB - countA;
        }

        if (sortBy === 'price') {
          const pA = parseFloat((a.salePrice || a.price || '$0').replace(/[^0-9.]/g, '')) || 0;
          const pB = parseFloat((b.salePrice || b.price || '$0').replace(/[^0-9.]/g, '')) || 0;
          return pA - pB;
        }

        return 0;
      });
  }, [games, selectedCategory, filterType, deckOnly, minCozyScore, selectedTag, searchQuery, sortBy]);

  const handleFilterSelect = (type: BrowserFilterType) => {
    setFilterType(type);
    onFilterChange?.(type);
  };

  const handleSortSelect = (sort: 'rating' | 'cozy' | 'reviews' | 'newest' | 'updated' | 'price') => {
    setSortBy(sort);
    onSortChange?.(sort);
  };

  const handleSearchUpdate = (val: string) => {
    setSearchQuery(val);
    onSearchChange?.(val);
  };

  const resetFilters = () => {
    setFilterType('all');
    setSearchQuery('');
    setDeckOnly(false);
    setSelectedTag(null);
    setMinCozyScore(0);
    onCategoryChange('all');
    onFilterChange?.('all');
    onSearchChange?.('');
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      
      {/* Section Title & Header */}
      <div className="bg-surface rounded-3xl p-5 sm:p-8 border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase font-bold text-brand tracking-wider">
            <Gamepad2 className="w-4 h-4" />
            <span>Curated Cozy & Indie Catalog</span>
          </div>
          <h2 className="font-serif-natural text-2xl sm:text-3xl font-normal text-text-heading tracking-tight leading-tight">
            Steam Game Directory & Sub-Genre Discovery
          </h2>
          <p className="text-xs sm:text-sm text-text-muted max-w-2xl leading-relaxed">
            Browse verified titles with live Steam links, review sentiments, Steam Deck compatibility badges, and cozy scores.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          <div className="bg-base p-1 rounded-xl flex items-center gap-1 text-text-muted border border-border shadow-xs">
            <button
              id="browser-view-grid-btn"
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation ${
                viewMode === 'grid' ? 'bg-surface text-text-heading shadow-xs font-bold' : 'hover:text-text-main'
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              id="browser-view-list-btn"
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation ${
                viewMode === 'list' ? 'bg-surface text-text-heading shadow-xs font-bold' : 'hover:text-text-main'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all', label: 'All Titles', icon: Gamepad2, badge: games.length },
          { id: 'newly_released', label: 'Newly Released', icon: Calendar, badge: newlyReleasedCount },
          { id: 'newly_updated', label: 'Newly Updated', icon: RefreshCw, badge: newlyUpdatedCount },
          { id: 'popular', label: 'Popular & Trending', icon: Flame, badge: popularCount },
          { id: 'highly_rated', label: 'Highly Rated (90%+)', icon: Star, badge: highlyRatedCount },
          { id: 'hidden_gems', label: 'Hidden Gems', icon: Gem, badge: hiddenGemsCount }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = filterType === tab.id;
          return (
            <button
              key={tab.id}
              id={`filter-tab-${tab.id}-btn`}
              onClick={() => handleFilterSelect(tab.id as BrowserFilterType)}
              className={`shrink-0 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs min-h-[44px] touch-manipulation whitespace-nowrap ${
                isActive
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-surface hover:bg-border text-text-muted border border-border'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`text-[10px] sm:text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                isActive ? 'bg-brand-hover text-white' : 'bg-base text-text-muted border border-border'
              }`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Control Bar: Sub-Genres, Search & Modifiers */}
      <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-border shadow-xs space-y-4">
        
        {/* Top Controls: Search & Sub-genres */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Sub-genre scrollable pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider mr-1 whitespace-nowrap">
              Genre:
            </span>
            {[
              { id: 'all', label: 'All' },
              { id: 'cozy', label: '☕ Cozy' },
              { id: 'farming', label: '🌾 Farming' },
              { id: 'indie', label: '✨ Indie' },
              { id: 'simulation', label: '🏰 Sim & Build' },
              { id: 'cooking', label: '🍳 Cooking' },
              { id: 'rpg', label: '🗡️ RPG' },
              { id: 'roguelike', label: '🎲 Roguelike' },
              { id: 'puzzle', label: '🧩 Puzzle' },
              { id: 'horror', label: '🕯️ Cozy Horror' },
              { id: 'job-sim', label: '💼 Job Sim' },
              { id: 'driving-sim', label: '🚗 Driving' },
              { id: 'steam-deck', label: '🎮 Steam Deck' }
            ].map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange(cat.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[38px] touch-manipulation ${
                    isSelected
                      ? 'bg-brand text-white shadow-xs'
                      : 'bg-base border border-border text-text-muted hover:text-text-main'
                  }`}
                >
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:max-w-xs shrink-0">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchUpdate(e.target.value)}
              placeholder="Search by title, tag, or dev..."
              className="w-full pl-9 pr-4 py-2 bg-base border border-border rounded-xl text-xs text-text-heading placeholder-text-muted focus:outline-hidden focus:border-brand min-h-[40px]"
            />
          </div>
        </div>

        {/* Secondary Modifiers: Deck Only, Min Cozy Score, Sort */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Deck Verified Toggle */}
            <button
              id="deck-verified-toggle-btn"
              onClick={() => setDeckOnly(!deckOnly)}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer min-h-[38px] touch-manipulation ${
                deckOnly
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-base hover:bg-border text-text-muted border border-border'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Deck Verified</span>
              {deckOnly && <Check className="w-3.5 h-3.5" />}
            </button>

            {/* Cozy Scale Selector */}
            <div className="flex items-center gap-1.5 text-text-muted bg-base border border-border px-2.5 py-1 rounded-xl min-h-[38px]">
              <span className="font-semibold text-[11px]">Min Cozy:</span>
              <select
                value={minCozyScore}
                onChange={(e) => setMinCozyScore(Number(e.target.value))}
                className="bg-transparent font-bold text-text-heading focus:outline-hidden cursor-pointer text-xs"
              >
                <option value={0}>Any</option>
                <option value={7}>7.0+ (Gentle)</option>
                <option value={8}>8.0+ (Cozy)</option>
                <option value={9}>9.0+ (Chill)</option>
                <option value={9.5}>9.5+ (Pure Zen)</option>
              </select>
            </div>

            {/* Active Tag Filter */}
            {selectedTag && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-surface-brand text-text-heading font-bold border border-brand/40 text-xs min-h-[38px]">
                <span>Tag: #{selectedTag}</span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className="hover:text-text-main font-bold ml-1 cursor-pointer p-1"
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          {/* Sort Selector & Reset */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-base border border-border px-2.5 py-1 rounded-xl min-h-[38px]">
              <span className="text-text-muted font-semibold text-[11px]">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => handleSortSelect(e.target.value as any)}
                className="bg-transparent font-bold text-text-heading focus:outline-hidden cursor-pointer text-xs"
              >
                <option value="rating">Top Review Score (%)</option>
                <option value="newest">Newest Releases</option>
                <option value="cozy">Highest Cozy Scale</option>
                <option value="reviews">Most Steam Reviews</option>
                <option value="updated">Recently Updated</option>
                <option value="price">Price: Low to High</option>
              </select>
            </div>

            {(filterType !== 'all' || deckOnly || minCozyScore > 0 || selectedTag || searchQuery || selectedCategory !== 'all') && (
              <button
                onClick={resetFilters}
                className="text-brand hover:text-text-heading font-bold flex items-center gap-1 cursor-pointer text-xs px-2 py-1 min-h-[38px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Tag Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <span className="text-[11px] font-semibold text-text-muted whitespace-nowrap">
            Tags:
          </span>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer touch-manipulation ${
                selectedTag === tag
                  ? 'bg-brand text-white font-bold'
                  : 'bg-base hover:bg-border border border-border text-text-muted'
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
          Showing <strong>{Math.min(visibleCount, filteredGames.length)}</strong> of <strong>{filteredGames.length}</strong> title{filteredGames.length === 1 ? '' : 's'}
        </span>
        {selectedCategory !== 'all' && (
          <span className="capitalize font-semibold text-brand">
            Category: {selectedCategory}
          </span>
        )}
      </div>

      {/* Empty State */}
      {filteredGames.length === 0 && (
        <div className="bg-surface rounded-3xl p-12 text-center border border-border shadow-xs max-w-lg mx-auto space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-surface-brand text-brand flex items-center justify-center mx-auto mb-2">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-serif-natural text-lg font-normal text-text-heading">
            No games matched your exact filters
          </h3>
          <p className="text-text-muted text-xs leading-relaxed">
            Try resetting your sub-genre selection or clearing your search term.
          </p>
          <button
            onClick={resetFilters}
            className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs transition-colors cursor-pointer min-h-[44px] touch-manipulation"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredGames.slice(0, visibleCount).map((game) => {
            const isSaved = isWishlisted(game.id);
            return (
              <div
                key={game.id}
                className="group bg-surface rounded-2xl border border-border overflow-hidden shadow-xs hover:shadow-md hover:border-brand transition-all duration-200 flex flex-col justify-between"
              >
                {/* Cover Image */}
                <div 
                  onClick={() => onSelectGame(game)}
                  className="relative aspect-[16/10] bg-base overflow-hidden cursor-pointer"
                >
                  <img
                    src={game.coverImage}
                    alt={game.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />

                  {/* Top Left: Cozy Score */}
                  <div className="absolute top-2.5 left-2.5 bg-inverse/90 backdrop-blur-xs text-text-on-inverse text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1 z-10">
                    <Star className="w-3 h-3 fill-[#E6A07D] text-accent" />
                    <span>{game.cozyScore} / 10</span>
                  </div>

                  {/* Top Right: Wishlist Button */}
                  <button
                    id={`game-card-wishlist-${game.id}-btn`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWishlist(game.id);
                    }}
                    className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-xs shadow-xs transition-all cursor-pointer z-10 min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation ${
                      isSaved
                        ? 'bg-accent text-white'
                        : 'bg-black/60 hover:bg-black/80 text-white'
                    }`}
                    title={isSaved ? 'Remove from Cozy Shelf' : 'Save to Cozy Shelf'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-white' : ''}`} />
                  </button>

                  {/* Bottom Left: Tag / Status Badge */}
                  <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1">
                    {isGameNewlyReleased(game) ? (
                      <span className="bg-brand text-white font-bold text-[10px] uppercase px-2 py-0.5 rounded-md shadow-xs">
                        New Release
                      </span>
                    ) : isGameNewlyUpdated(game) ? (
                      <span className="bg-accent text-white font-bold text-[10px] uppercase px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5" />
                        Updated
                      </span>
                    ) : game.steamDeckStatus === 'Verified' ? (
                      <span className="bg-surface-brand text-text-heading font-bold text-[10px] px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1 border border-brand/40">
                        <Tv className="w-3 h-3 text-brand" />
                        Deck Verified
                      </span>
                    ) : null}
                  </div>

                  {/* Bottom Right: Release Date */}
                  <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-xs text-text-on-inverse text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1 border border-white/20 z-10">
                    <Calendar className="w-3 h-3 text-brand" />
                    <span>{game.releaseDate}</span>
                  </div>
                </div>

                {/* Card Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        onClick={() => onSelectGame(game)}
                        className="font-serif-natural text-base font-normal text-text-heading group-hover:text-brand transition-colors line-clamp-1 cursor-pointer"
                      >
                        {game.title}
                      </h3>
                      <span className="font-bold text-text-heading text-xs whitespace-nowrap">
                        {game.price}
                      </span>
                    </div>

                    <p className="text-[11px] text-text-muted mt-0.5 truncate">
                      by {game.developer}
                    </p>

                    <p className="text-xs text-text-muted line-clamp-2 mt-2 leading-relaxed">
                      {game.shortDescription}
                    </p>
                  </div>

                  {/* Footer Meta */}
                  <div className="pt-2.5 border-t border-border space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-brand font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-brand" />
                        {formatRating(game.ratingScore, ' Positive')} ({game.totalReviews})
                      </span>
                      <span className="text-text-muted font-medium capitalize">
                        {game.category}
                      </span>
                    </div>

                    {/* Vibe Pills */}
                    <div className="flex flex-wrap gap-1">
                      {game.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-base text-text-muted border border-border truncate"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredGames.slice(0, visibleCount).map((game) => {
            const isSaved = isWishlisted(game.id);
            return (
              <div
                key={game.id}
                onClick={() => onSelectGame(game)}
                className="group bg-surface rounded-2xl border border-border p-3 sm:p-4 hover:border-brand transition-all cursor-pointer shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <img
                    src={game.coverImage}
                    alt={game.title}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif-natural text-base sm:text-lg font-normal text-text-heading group-hover:text-brand transition-colors truncate">
                        {game.title}
                      </h3>
                      <span className="text-xs font-bold text-brand px-2 py-0.5 bg-surface-brand rounded-md shrink-0">
                        {game.cozyScore}/10
                      </span>
                    </div>

                    <p className="text-xs text-text-muted line-clamp-1 mt-0.5">
                      {game.shortDescription}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] text-text-muted mt-1.5">
                      <span className="font-bold text-text-heading">{game.price}</span>
                      <span>•</span>
                      <span className="text-brand font-bold">{formatRating(game.ratingScore, ' Pos')}</span>
                      <span>•</span>
                      <span>Deck: {game.steamDeckStatus}</span>
                      <span>•</span>
                      <span>{game.releaseDate}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWishlist(game.id);
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 min-h-[44px] touch-manipulation ${
                    isSaved
                      ? 'bg-accent text-white border-accent'
                      : 'bg-base hover:bg-border border-border text-text-muted hover:text-accent'
                  }`}
                  title="Save to shelf"
                >
                  <Heart className={`w-4 h-4 ${isSaved ? 'fill-white' : ''}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination: Load More Button */}
      {filteredGames.length > visibleCount && (
        <div className="text-center pt-4">
          <button
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="px-8 py-3 rounded-2xl bg-brand hover:bg-brand-hover text-white font-bold text-sm shadow-xs transition-all cursor-pointer min-h-[44px] touch-manipulation"
          >
            Show More Games ({filteredGames.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
};
