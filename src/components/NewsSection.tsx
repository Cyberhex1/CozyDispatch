import React, { useState, useMemo } from 'react';
import { NewsArticle, PatchNote, UpcomingRelease, GameCategory, NewsSource, DailyDigest } from '../types';
import { 
  Newspaper, 
  Sparkles, 
  Clock, 
  ExternalLink, 
  Flame, 
  Filter, 
  Calendar, 
  Wrench, 
  Share2, 
  Bookmark, 
  Check, 
  ChevronRight,
  TrendingUp,
  Tag,
  ArrowRight
} from 'lucide-react';

interface NewsSectionProps {
  articles: NewsArticle[];
  patchNotes: PatchNote[];
  upcomingReleases: UpcomingRelease[];
  dailyDigest: DailyDigest;
  selectedCategory: GameCategory | 'all';
  onCategoryChange: (cat: GameCategory | 'all') => void;
  onSelectArticle: (article: NewsArticle) => void;
  onSelectPatch: (patch: PatchNote) => void;
  onSelectUpcoming: (item: UpcomingRelease) => void;
  onGenerateAIDigest: () => void;
  isGeneratingDigest: boolean;
  onBookmarkArticle: (articleId: string) => void;
  isBookmarked: (articleId: string) => boolean;
}

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
  isBookmarked
}) => {
  const [activeTab, setActiveTab] = useState<'headlines' | 'patches' | 'upcoming'>('headlines');
  const [selectedSource, setSelectedSource] = useState<NewsSource | 'all'>('all');

  const sources: (NewsSource | 'all')[] = ['all', 'IGN', 'GameSpot', 'Eurogamer', 'PC Gamer', 'Nintendo Life', 'Rock Paper Shotgun'];

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      if (selectedCategory !== 'all' && a.category !== selectedCategory && a.category !== 'general') return false;
      if (selectedSource !== 'all' && a.source !== selectedSource) return false;
      return true;
    });
  }, [articles, selectedCategory, selectedSource]);

  // Filtered patch notes
  const filteredPatches = useMemo(() => {
    return patchNotes.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      return true;
    });
  }, [patchNotes, selectedCategory]);

  // Filtered upcoming
  const filteredUpcoming = useMemo(() => {
    return upcomingReleases.filter((u) => {
      if (selectedCategory !== 'all' && u.category !== selectedCategory) return false;
      return true;
    });
  }, [upcomingReleases, selectedCategory]);

  // Helper for outlet badge colors
  const getSourceBadgeColor = (source: NewsSource) => {
    switch (source) {
      case 'IGN':
        return 'bg-red-600 text-white';
      case 'GameSpot':
        return 'bg-amber-600 text-white';
      case 'Eurogamer':
        return 'bg-blue-600 text-white';
      case 'PC Gamer':
        return 'bg-rose-700 text-white';
      case 'Nintendo Life':
        return 'bg-red-500 text-white';
      case 'Rock Paper Shotgun':
        return 'bg-emerald-700 text-white';
      default:
        return 'bg-stone-800 text-amber-300';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase font-bold text-brand tracking-wider mb-1">
            <Newspaper className="w-4 h-4" />
            <span>Daily Indie & Cozy Gaming Dispatch</span>
          </div>
          <h2 className="font-serif-natural text-2xl sm:text-3xl font-normal text-text-heading tracking-tight">
            News, Releases & Patch Notes Hub
          </h2>
          <p className="text-text-muted text-sm mt-1">
            Aggregated coverage from IGN, GameSpot, Eurogamer, and developer dispatches with 30-second cozy takeaways.
          </p>
        </div>

        {/* AI Morning Dispatch Button */}
        <button
          id="news-generate-digest-btn"
          onClick={onGenerateAIDigest}
          disabled={isGeneratingDigest}
          className="self-start md:self-center px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs sm:text-sm shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 text-white ${isGeneratingDigest ? 'animate-spin' : ''}`} />
          <span>{isGeneratingDigest ? 'Synthesizing Daily AI Briefing...' : 'Generate Fresh AI Briefing'}</span>
        </button>
      </div>

      {/* Daily Digest Morning Card */}
      <div className="bg-base text-text-main rounded-3xl p-6 sm:p-8 border border-border shadow-xs relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-surface-brand text-text-heading border border-brand/40">
                Today's Curated Briefing
              </span>
              <span className="text-xs text-text-muted font-medium">
                {dailyDigest.date}
              </span>
            </div>
            <span className="text-xs text-brand italic hidden sm:inline font-medium">
              ☕ Powered by Cozy Dispatch & Gemini
            </span>
          </div>

          <div>
            <h3 className="font-serif-natural text-xl sm:text-2xl font-normal text-text-heading tracking-tight">
              {dailyDigest.headline}
            </h3>
            <p className="text-sm text-text-muted mt-1 leading-relaxed">
              {dailyDigest.greeting}
            </p>
          </div>

          {/* 3 Key Morning Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {dailyDigest.curatedPicks.map((pick, i) => (
              <div
                key={i}
                className="bg-base border border-border rounded-2xl p-4 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-text-heading">
                    {pick.gameTitle}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-brand text-text-heading border border-brand/30">
                    {pick.vibeTag}
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  {pick.highlight}
                </p>
              </div>
            ))}
          </div>

          {/* Community Vibe Note */}
          <div className="pt-2 flex items-center justify-between text-xs text-text-muted">
            <span>
              <strong className="text-text-heading">Community Pulse: </strong> {dailyDigest.communityVibeCheck}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tabs: Top Headlines | Patch Notes | Upcoming Release Radar */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
          <button
            id="tab-headlines-btn"
            onClick={() => setActiveTab('headlines')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'headlines'
                ? 'bg-brand text-white shadow-xs'
                : 'bg-base text-text-muted hover:bg-surface border border-border'
            }`}
          >
            <Newspaper className="w-4 h-4" />
            <span>Latest News Articles ({filteredArticles.length})</span>
          </button>

          <button
            id="tab-patches-btn"
            onClick={() => setActiveTab('patches')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'patches'
                ? 'bg-brand text-white shadow-xs'
                : 'bg-base text-text-muted hover:bg-surface border border-border'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Patch Notes Hub ({filteredPatches.length})</span>
          </button>

          <button
            id="tab-upcoming-btn"
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'upcoming'
                ? 'bg-brand text-white shadow-xs'
                : 'bg-base text-text-muted hover:bg-surface border border-border'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Upcoming Releases ({filteredUpcoming.length})</span>
          </button>
        </div>
      </div>

      {/* Outlet & Category Sub-Bar */}
      {activeTab === 'headlines' && (
        <div className="bg-base p-3 rounded-xl border border-border shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Source Outlet Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="font-bold text-text-muted uppercase tracking-wider mr-1">
              Outlet:
            </span>
            {sources.map((src) => (
              <button
                key={src}
                onClick={() => setSelectedSource(src)}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedSource === src
                    ? 'bg-inverse text-text-on-inverse'
                    : 'bg-surface hover:bg-border text-text-muted'
                }`}
              >
                {src === 'all' ? 'All Outlets' : src}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1">
            <span className="font-bold text-text-muted uppercase tracking-wider mr-1">
              Category:
            </span>
            {[
              { id: 'all', label: 'All' },
              { id: 'cozy', label: 'Cozy' },
              { id: 'indie', label: 'Indie' },
              { id: 'simulation', label: 'Sim' },
              { id: 'steam-deck', label: 'Steam Deck' }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id as any)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-brand text-white'
                    : 'bg-surface hover:bg-border text-text-muted'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB 1: News Articles */}
      {activeTab === 'headlines' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArticles.map((article) => {
            const saved = isBookmarked(article.id);
            return (
              <article
                key={article.id}
                onClick={() => onSelectArticle(article)}
                className="group bg-surface rounded-2xl border border-border overflow-hidden shadow-xs hover:shadow-md hover:border-brand transition-all duration-300 flex flex-col cursor-pointer"
              >
                {/* Thumbnail & Source Badge */}
                <div className="relative aspect-[16/9] bg-base overflow-hidden">
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />

                  {/* Outlet Badge */}
                  <div className={`absolute top-3 left-3 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-xs ${getSourceBadgeColor(article.source)}`}>
                    {article.source}
                  </div>

                  {/* Hot Badge */}
                  {article.isHot && (
                    <div className="absolute top-3 right-3 bg-accent text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      Hot
                    </div>
                  )}

                  {/* Reading Time */}
                  <div className="absolute bottom-2.5 right-2.5 bg-inverse/80 backdrop-blur-xs text-text-on-inverse text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                    <Clock className="w-3 h-3 text-text-on-inverse" />
                    <span>{article.readTimeMinutes} min read</span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-text-muted mb-1.5 font-medium">
                      <span>{article.publishedAt}</span>
                      <span>•</span>
                      <span>By {article.author}</span>
                    </div>

                    <h3 className="font-serif-natural text-base font-normal text-text-main group-hover:text-brand transition-colors leading-snug line-clamp-2">
                      {article.title}
                    </h3>

                    <p className="text-xs text-text-muted line-clamp-2 mt-2 leading-relaxed">
                      {article.summary}
                    </p>
                  </div>

                  {/* 30-second Key Takeaways Preview */}
                  <div className="p-3 bg-base rounded-xl border border-border text-xs space-y-1.5">
                    <div className="font-bold text-text-heading text-[11px] uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-brand" />
                      <span>30-Second Takeaway</span>
                    </div>
                    <ul className="space-y-1 text-text-muted text-[11px]">
                      {article.takeaways.slice(0, 2).map((t, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-brand font-bold shrink-0">•</span>
                          <span className="line-clamp-1">{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Footer & Actions */}
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookmarkArticle(article.id);
                      }}
                      className={`flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                        saved ? 'text-accent' : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-[#E6A07D]' : ''}`} />
                      <span>{saved ? 'Saved' : 'Save'}</span>
                    </button>

                    <div className="flex items-center gap-1 text-brand font-bold group-hover:translate-x-0.5 transition-transform">
                      <span>Read Full Dispatch</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* TAB 2: Patch Notes Hub */}
      {activeTab === 'patches' && (
        <div className="space-y-4">
          <div className="bg-surface-brand border border-brand/40 rounded-2xl p-4 text-xs text-text-heading flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-brand shrink-0" />
              <span>
                <strong className="text-text-heading">Recent Game Updates: </strong> Tracking major quality-of-life updates, balance adjustments, and Steam Deck fixes for community favorites.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredPatches.map((patch) => (
              <div
                key={patch.id}
                onClick={() => onSelectPatch(patch)}
                className="bg-base rounded-2xl border border-border p-5 shadow-xs hover:shadow-md hover:border-brand transition-all cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={patch.gameCover}
                        alt={patch.gameTitle}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                      <div>
                        <h3 className="font-serif-natural font-normal text-base text-text-main">
                          {patch.gameTitle}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface text-text-heading">
                            {patch.version}
                          </span>
                          <span className="text-[11px] text-text-muted">
                            {patch.releaseDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    {patch.isMajorUpdate && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-surface-brand text-text-heading border border-brand/40">
                        Major Patch
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-text-muted mt-3 leading-relaxed">
                    {patch.summary}
                  </p>

                  {/* Highlights list */}
                  <div className="mt-3 space-y-2">
                    {patch.highlights.map((h, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-base border border-border text-xs"
                      >
                        <div className="flex items-center justify-between font-bold text-text-heading">
                          <span>{h.title}</span>
                          {h.badge && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-brand text-text-heading">
                              {h.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          {h.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Steam Deck Notes */}
                {patch.deckImprovements && (
                  <div className="p-2.5 rounded-xl bg-surface-brand border border-brand/40 text-xs text-text-heading flex items-start gap-2">
                    <span className="font-bold text-brand">Steam Deck:</span>
                    <span>{patch.deckImprovements}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-text-muted font-medium">
                    {patch.detailedNotes.length} detailed changelog items
                  </span>
                  <span className="text-brand font-bold flex items-center gap-1">
                    <span>Read Full Changelog</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Upcoming Release Radar */}
      {activeTab === 'upcoming' && (
        <div className="space-y-4">
          <div className="bg-base text-text-main rounded-2xl p-5 border border-border shadow-xs flex items-center justify-between">
            <div>
              <h3 className="font-serif-natural text-lg font-normal text-text-heading">
                Cozy & Indie Release Radar
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Countdown calendar of the most anticipated relaxing titles in active development.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUpcoming.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectUpcoming(item)}
                className="bg-base rounded-2xl border border-border overflow-hidden shadow-xs hover:shadow-md hover:border-brand transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="relative aspect-[16/10] bg-base">
                  <img
                    src={item.coverImage}
                    alt={item.gameTitle}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 bg-inverse/90 backdrop-blur-xs text-text-on-inverse text-xs font-bold px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-accent" />
                    <span>Hype: {item.hypeScore}/100</span>
                  </div>

                  <div className="absolute bottom-3 left-3 bg-brand text-white text-xs font-bold px-3 py-1 rounded-lg shadow-xs">
                    {item.releaseDate}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-serif-natural font-normal text-base text-text-main">
                      {item.gameTitle}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      by {item.developer}
                    </p>

                    <p className="text-xs text-text-muted line-clamp-3 mt-2 leading-relaxed">
                      {item.cozyVibeNotes}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-surface text-text-muted">
                          #{t}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs text-text-muted pt-1">
                      <span>Platforms: {item.platforms.join(', ')}</span>
                      <span className="text-brand font-bold">Track Title →</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
