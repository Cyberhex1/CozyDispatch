import React, { useState, useMemo } from 'react';
import { 
  NewsArticle, 
  PatchNote, 
  UpcomingRelease, 
  NewsTopicCategory, 
  DailyDigest 
} from '../types';
import { 
  Newspaper, 
  Sparkles, 
  Clock, 
  ExternalLink, 
  Flame, 
  Search,
  X,
  RefreshCw,
  Calendar, 
  Wrench, 
  Bookmark, 
  ChevronRight,
  TrendingUp,
  Tag,
  ArrowRight,
  Layers,
  Check,
  Loader2
} from 'lucide-react';

interface NewsSectionProps {
  articles: NewsArticle[];
  patchNotes: PatchNote[];
  upcomingReleases: UpcomingRelease[];
  dailyDigest: DailyDigest;
  selectedCategory: NewsTopicCategory;
  onCategoryChange: (cat: NewsTopicCategory) => void;
  onSelectArticle: (article: NewsArticle) => void;
  onSelectPatch: (patch: PatchNote) => void;
  onSelectUpcoming: (item: UpcomingRelease) => void;
  onGenerateAIDigest: () => void;
  isGeneratingDigest: boolean;
  onBookmarkArticle: (articleId: string) => void;
  isBookmarked: (articleId: string) => boolean;
  onRefreshFeed?: () => Promise<void>;
  isRefreshingFeed?: boolean;
}

const CATEGORIES: { id: NewsTopicCategory; label: string }[] = [
  { id: 'all', label: 'All Stories' },
  { id: 'cozy', label: '☕ Cozy' },
  { id: 'indie', label: '✨ Indie' },
  { id: 'life-sim', label: '🏡 Life Sim' },
  { id: 'farming', label: '🌾 Farming' },
  { id: 'building', label: '🏰 Building' },
  { id: 'wholesome', label: '💛 Wholesome' },
  { id: 'cozy-horror', label: '🕯️ Cozy Horror' },
  { id: 'animals', label: '🐾 Animals' },
  { id: 'rpg-adventure', label: '🗡️ RPG / Adventure' },
  { id: 'announcements', label: '📢 Announcements' },
  { id: 'trailers', label: '🎬 Trailers' },
  { id: 'developer-news', label: '🛠️ Dev News' },
  { id: 'releases', label: '🚀 Releases' },
  { id: 'steam-deck', label: '🎮 Steam Deck' }
];

export const NewsSection: React.FC<NewsSectionProps> = ({
  articles,
  patchNotes,
  upcomingReleases,
  dailyDigest,
  selectedCategory,
  onCategoryChange,
  onSelectArticle,
  onSelectPatch,
  onSelectUpcoming,
  onGenerateAIDigest,
  isGeneratingDigest,
  onBookmarkArticle,
  isBookmarked,
  onRefreshFeed,
  isRefreshingFeed = false
}) => {
  const [activeTab, setActiveTab] = useState<'headlines' | 'patches' | 'upcoming'>('headlines');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique sources from available articles
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      if (a.source) set.add(a.source);
    });
    return ['all', ...Array.from(set)];
  }, [articles]);

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const catLower = selectedCategory.toLowerCase();
        const matchesCategory = 
          a.category?.toLowerCase() === catLower ||
          a.tags?.some((t) => t.toLowerCase() === catLower);
        if (!matchesCategory) return false;
      }

      // Source filter
      if (selectedSource !== 'all' && a.source !== selectedSource) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.author?.toLowerCase().includes(q) ||
          a.relatedGameTitle?.toLowerCase().includes(q) ||
          a.tags?.some((t) => t.toLowerCase() === q);
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [articles, selectedCategory, selectedSource, searchQuery]);

  // Top featured story candidate
  const featuredArticle = useMemo(() => {
    if (searchQuery.trim() || selectedCategory !== 'all' || selectedSource !== 'all') {
      return null;
    }
    return filteredArticles.find((a) => a.isFeatured) || filteredArticles[0] || null;
  }, [filteredArticles, searchQuery, selectedCategory, selectedSource]);

  // Remaining articles for grid
  const gridArticles = useMemo(() => {
    if (!featuredArticle) return filteredArticles;
    return filteredArticles.filter((a) => a.id !== featuredArticle.id);
  }, [filteredArticles, featuredArticle]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="bg-surface rounded-3xl p-5 sm:p-8 border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
            <Newspaper className="w-4 h-4" />
            <span>Cozy Gaming Newsroom</span>
          </div>
          <h2 className="font-serif-natural text-2xl sm:text-3xl font-normal text-text-heading tracking-tight leading-tight">
            The Daily Cozy & Indie Dispatch
          </h2>
          <p className="text-xs sm:text-sm text-text-muted max-w-2xl leading-relaxed">
            Live aggregated coverage from Eurogamer, Rock Paper Shotgun, Nintendo Life, Siliconera, and official Steam developer patch notes.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onRefreshFeed && (
            <button
              onClick={onRefreshFeed}
              disabled={isRefreshingFeed}
              className="px-4 py-2.5 rounded-xl bg-surface hover:bg-border text-text-heading border border-border text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[44px] touch-manipulation"
              title="Fetch fresh RSS feeds & Steam patch notes"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-brand ${isRefreshingFeed ? 'animate-spin' : ''}`} />
              <span>{isRefreshingFeed ? 'Syncing...' : 'Sync Live Feeds'}</span>
            </button>
          )}

          <button
            onClick={onGenerateAIDigest}
            disabled={isGeneratingDigest}
            className="px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[44px] touch-manipulation"
          >
            {isGeneratingDigest ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Brewing Digest...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>AI Daily Digest</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Section Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('headlines')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap min-h-[44px] touch-manipulation ${
            activeTab === 'headlines'
              ? 'bg-brand text-white shadow-xs'
              : 'text-text-muted hover:text-text-main hover:bg-surface'
          }`}
        >
          <Newspaper className="w-4 h-4" />
          <span>Latest Stories ({articles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('patches')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap min-h-[44px] touch-manipulation ${
            activeTab === 'patches'
              ? 'bg-brand text-white shadow-xs'
              : 'text-text-muted hover:text-text-main hover:bg-surface'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Patch Notes ({patchNotes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap min-h-[44px] touch-manipulation ${
            activeTab === 'upcoming'
              ? 'bg-brand text-white shadow-xs'
              : 'text-text-muted hover:text-text-main hover:bg-surface'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Upcoming Launches ({upcomingReleases.length})</span>
        </button>
      </div>

      {/* TAB 1: Real News Stories */}
      {activeTab === 'headlines' && (
        <div className="space-y-6">
          
          {/* Category Horizontal Filter Pill Bar */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => onCategoryChange(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[38px] touch-manipulation flex items-center gap-1 ${
                      isSelected
                        ? 'bg-brand text-white shadow-xs'
                        : 'bg-surface border border-border text-text-muted hover:bg-border/60 hover:text-text-main'
                    }`}
                  >
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-Filters: Outlet selector & Search input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 sm:p-4 rounded-2xl border border-border text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-text-muted">Outlet:</span>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="bg-base border border-border px-3 py-1.5 rounded-xl font-bold text-text-heading focus:outline-hidden cursor-pointer min-h-[38px]"
                >
                  <option value="all">All Outlets ({availableSources.length - 1} Sources)</option>
                  {availableSources.filter((s) => s !== 'all').map((src) => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1 sm:max-w-xs">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cozy news..."
                  className="w-full pl-8 pr-8 py-1.5 bg-base border border-border rounded-xl text-xs text-text-heading placeholder-text-muted focus:outline-hidden focus:border-brand min-h-[38px]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* TOP FEATURED HERO ARTICLE */}
          {featuredArticle && (
            <div 
              onClick={() => onSelectArticle(featuredArticle)}
              className="group bg-surface rounded-3xl border border-border overflow-hidden shadow-xs hover:shadow-md hover:border-brand transition-all cursor-pointer"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                {/* Image Banner */}
                <div className="lg:col-span-6 relative aspect-[16/10] bg-base overflow-hidden">
                  <img
                    src={featuredArticle.imageUrl}
                    alt={featuredArticle.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="bg-brand text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-300" />
                      Top Featured Story
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-md">
                    {featuredArticle.source}
                  </div>
                </div>

                {/* Content */}
                <div className="lg:col-span-6 p-5 sm:p-8 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span className="font-bold text-brand uppercase">{featuredArticle.category}</span>
                      <span>•</span>
                      <span>{featuredArticle.publishedAt}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {featuredArticle.readTimeMinutes} min read
                      </span>
                    </div>

                    <h3 className="font-serif-natural text-xl sm:text-2xl font-normal text-text-heading group-hover:text-brand transition-colors leading-tight">
                      {featuredArticle.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-text-muted line-clamp-3 leading-relaxed">
                      {featuredArticle.summary}
                    </p>

                    {/* 30-Second Takeaways */}
                    {featuredArticle.takeaways && featuredArticle.takeaways.length > 0 && (
                      <div className="p-3 bg-surface-brand rounded-xl border border-brand/30 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase text-brand flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          30-Second Takeaway
                        </span>
                        <ul className="text-xs text-text-heading space-y-1">
                          {featuredArticle.takeaways.slice(0, 2).map((t, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-brand font-bold">•</span>
                              <span className="line-clamp-2">{t}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs font-bold text-brand flex items-center gap-1 group-hover:underline">
                      <span>Read Full Story & Takeaways</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookmarkArticle(featuredArticle.id);
                      }}
                      className="p-2 rounded-full bg-surface hover:bg-border text-text-muted hover:text-accent transition-colors"
                      title="Bookmark Story"
                    >
                      <Bookmark className={`w-4 h-4 ${isBookmarked(featuredArticle.id) ? 'fill-accent text-accent' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ARTICLES GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {gridArticles.map((article) => {
              const bookmarked = isBookmarked(article.id);
              return (
                <div
                  key={article.id}
                  onClick={() => onSelectArticle(article)}
                  className="group bg-surface rounded-2xl border border-border overflow-hidden shadow-xs hover:shadow-md hover:border-brand transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Cover Thumbnail */}
                    <div className="relative aspect-[16/10] bg-base overflow-hidden">
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute top-2.5 left-2.5 bg-inverse/90 backdrop-blur-xs text-text-on-inverse text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {article.source}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onBookmarkArticle(article.id);
                        }}
                        className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-xs shadow-xs transition-colors z-10 ${
                          bookmarked ? 'bg-accent text-white' : 'bg-black/60 hover:bg-black/80 text-white'
                        }`}
                        title="Bookmark article"
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-white' : ''}`} />
                      </button>
                    </div>

                    {/* Meta & Title */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                        <span className="font-bold text-brand uppercase">{article.category}</span>
                        <span>•</span>
                        <span>{article.publishedAt}</span>
                      </div>

                      <h4 className="font-serif-natural text-base font-normal text-text-heading group-hover:text-brand transition-colors line-clamp-2 leading-snug">
                        {article.title}
                      </h4>

                      <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                        {article.summary}
                      </p>
                    </div>
                  </div>

                  <div className="px-4 pb-4 pt-2 border-t border-border flex items-center justify-between text-[11px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-text-muted" />
                      {article.readTimeMinutes} min read
                    </span>

                    <span className="text-brand font-bold flex items-center gap-0.5 group-hover:underline">
                      <span>Dispatch</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredArticles.length === 0 && (
            <div className="p-12 text-center bg-surface rounded-2xl border border-border space-y-2">
              <Search className="w-8 h-8 text-text-muted mx-auto" />
              <h4 className="font-serif-natural text-base text-text-heading">No matching stories found</h4>
              <p className="text-xs text-text-muted">
                Try selecting "All Stories" or clearing your search term.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Patch Notes */}
      {activeTab === 'patches' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patchNotes.map((patch) => (
              <div
                key={patch.id}
                onClick={() => onSelectPatch(patch)}
                className="group p-5 bg-surface rounded-2xl border border-border hover:border-brand transition-all cursor-pointer shadow-xs space-y-3"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={patch.gameCover}
                    alt={patch.gameTitle}
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase text-brand px-2 py-0.5 bg-surface-brand rounded-md">
                        v{patch.version}
                      </span>
                      <span className="text-xs text-text-muted">{patch.releaseDate}</span>
                    </div>
                    <h4 className="font-serif-natural text-base text-text-heading group-hover:text-brand transition-colors truncate mt-0.5">
                      {patch.gameTitle}
                    </h4>
                  </div>
                </div>

                <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                  {patch.summary}
                </p>

                <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-brand font-bold">
                  <span>View Patch Highlights</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Upcoming Releases */}
      {activeTab === 'upcoming' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingReleases.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectUpcoming(item)}
                className="group bg-surface rounded-2xl border border-border overflow-hidden shadow-xs hover:border-brand transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-[16/10] bg-base overflow-hidden">
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute top-2.5 left-2.5 bg-inverse/90 backdrop-blur-xs text-text-on-inverse text-[10px] font-bold px-2 py-0.5 rounded-md">
                      Hype: {item.hypeScore}/100
                    </div>
                    <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      {item.expectedReleaseWindow}
                    </div>
                  </div>

                  <div className="p-4 space-y-1.5">
                    <span className="text-[10px] font-bold text-brand uppercase">{item.developer}</span>
                    <h4 className="font-serif-natural text-base text-text-heading group-hover:text-brand transition-colors line-clamp-1">
                      {item.title}
                    </h4>
                    <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                      {item.shortDescription}
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-border flex items-center justify-between text-xs text-brand font-bold">
                  <span>View Radar File</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
