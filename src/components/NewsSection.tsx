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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E6E2D3] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase font-bold text-[#8BA888] tracking-wider mb-1">
            <Newspaper className="w-4 h-4" />
            <span>Daily Indie & Cozy Gaming Dispatch</span>
          </div>
          <h2 className="font-serif-natural text-2xl sm:text-3xl font-normal text-[#5A5A40] tracking-tight">
            News, Releases & Patch Notes Hub
          </h2>
          <p className="text-[#707060] text-sm mt-1">
            Aggregated coverage from IGN, GameSpot, Eurogamer, and developer dispatches with 30-second cozy takeaways.
          </p>
        </div>

        {/* AI Morning Dispatch Button */}
        <button
          id="news-generate-digest-btn"
          onClick={onGenerateAIDigest}
          disabled={isGeneratingDigest}
          className="self-start md:self-center px-4 py-2.5 rounded-xl bg-[#8BA888] hover:bg-[#7A9977] text-white font-bold text-xs sm:text-sm shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 text-white ${isGeneratingDigest ? 'animate-spin' : ''}`} />
          <span>{isGeneratingDigest ? 'Synthesizing Daily AI Briefing...' : 'Generate Fresh AI Briefing'}</span>
        </button>
      </div>

      {/* Daily Digest Morning Card */}
      <div className="bg-white text-[#4A4A40] rounded-3xl p-6 sm:p-8 border border-[#E6E2D3] shadow-xs relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6E2D3] pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#EBF0EA] text-[#5A5A40] border border-[#8BA888]/40">
                Today's Curated Briefing
              </span>
              <span className="text-xs text-[#707060] font-medium">
                {dailyDigest.date}
              </span>
            </div>
            <span className="text-xs text-[#8BA888] italic hidden sm:inline font-medium">
              ☕ Powered by Cozy Dispatch & Gemini
            </span>
          </div>

          <div>
            <h3 className="font-serif-natural text-xl sm:text-2xl font-normal text-[#5A5A40] tracking-tight">
              {dailyDigest.headline}
            </h3>
            <p className="text-sm text-[#707060] mt-1 leading-relaxed">
              {dailyDigest.greeting}
            </p>
          </div>

          {/* 3 Key Morning Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {dailyDigest.curatedPicks.map((pick, i) => (
              <div
                key={i}
                className="bg-[#FDFBF7] border border-[#E6E2D3] rounded-2xl p-4 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#5A5A40]">
                    {pick.gameTitle}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EBF0EA] text-[#5A5A40] border border-[#8BA888]/30">
                    {pick.vibeTag}
                  </span>
                </div>
                <p className="text-xs text-[#707060] leading-relaxed">
                  {pick.highlight}
                </p>
              </div>
            ))}
          </div>

          {/* Community Vibe Note */}
          <div className="pt-2 flex items-center justify-between text-xs text-[#707060]">
            <span>
              <strong className="text-[#5A5A40]">Community Pulse: </strong> {dailyDigest.communityVibeCheck}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tabs: Top Headlines | Patch Notes | Upcoming Release Radar */}
      <div className="flex items-center justify-between border-b border-[#E6E2D3] pb-2">
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
          <button
            id="tab-headlines-btn"
            onClick={() => setActiveTab('headlines')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'headlines'
                ? 'bg-[#8BA888] text-white shadow-xs'
                : 'bg-white text-[#707060] hover:bg-[#F5F5F0] border border-[#E6E2D3]'
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
                ? 'bg-[#8BA888] text-white shadow-xs'
                : 'bg-white text-[#707060] hover:bg-[#F5F5F0] border border-[#E6E2D3]'
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
                ? 'bg-[#8BA888] text-white shadow-xs'
                : 'bg-white text-[#707060] hover:bg-[#F5F5F0] border border-[#E6E2D3]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Upcoming Releases ({filteredUpcoming.length})</span>
          </button>
        </div>
      </div>

      {/* Outlet & Category Sub-Bar */}
      {activeTab === 'headlines' && (
        <div className="bg-white p-3 rounded-xl border border-[#E6E2D3] shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Source Outlet Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="font-bold text-[#707060] uppercase tracking-wider mr-1">
              Outlet:
            </span>
            {sources.map((src) => (
              <button
                key={src}
                onClick={() => setSelectedSource(src)}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedSource === src
                    ? 'bg-[#5A5A40] text-white'
                    : 'bg-[#F5F5F0] hover:bg-[#E6E2D3] text-[#707060]'
                }`}
              >
                {src === 'all' ? 'All Outlets' : src}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1">
            <span className="font-bold text-[#707060] uppercase tracking-wider mr-1">
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
                    ? 'bg-[#8BA888] text-white'
                    : 'bg-[#F5F5F0] hover:bg-[#E6E2D3] text-[#707060]'
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
                className="group bg-white rounded-2xl border border-[#E6E2D3] overflow-hidden shadow-xs hover:shadow-md hover:border-[#8BA888] transition-all duration-300 flex flex-col cursor-pointer"
              >
                {/* Thumbnail & Source Badge */}
                <div className="relative aspect-[16/9] bg-[#F5F5F0] overflow-hidden">
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
                    <div className="absolute top-3 right-3 bg-[#E6A07D] text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      Hot
                    </div>
                  )}

                  {/* Reading Time */}
                  <div className="absolute bottom-2.5 right-2.5 bg-[#5A5A40]/80 backdrop-blur-xs text-[#FDFBF7] text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#FDFBF7]" />
                    <span>{article.readTimeMinutes} min read</span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#707060] mb-1.5 font-medium">
                      <span>{article.publishedAt}</span>
                      <span>•</span>
                      <span>By {article.author}</span>
                    </div>

                    <h3 className="font-serif-natural text-base font-normal text-[#4A4A40] group-hover:text-[#8BA888] transition-colors leading-snug line-clamp-2">
                      {article.title}
                    </h3>

                    <p className="text-xs text-[#707060] line-clamp-2 mt-2 leading-relaxed">
                      {article.summary}
                    </p>
                  </div>

                  {/* 30-second Key Takeaways Preview */}
                  <div className="p-3 bg-[#FDFBF7] rounded-xl border border-[#E6E2D3] text-xs space-y-1.5">
                    <div className="font-bold text-[#5A5A40] text-[11px] uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#8BA888]" />
                      <span>30-Second Takeaway</span>
                    </div>
                    <ul className="space-y-1 text-[#707060] text-[11px]">
                      {article.takeaways.slice(0, 2).map((t, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-[#8BA888] font-bold shrink-0">•</span>
                          <span className="line-clamp-1">{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Footer & Actions */}
                  <div className="pt-2 border-t border-[#F5F5F0] flex items-center justify-between text-xs">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookmarkArticle(article.id);
                      }}
                      className={`flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                        saved ? 'text-[#E6A07D]' : 'text-[#707060] hover:text-[#4A4A40]'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-[#E6A07D]' : ''}`} />
                      <span>{saved ? 'Saved' : 'Save'}</span>
                    </button>

                    <div className="flex items-center gap-1 text-[#8BA888] font-bold group-hover:translate-x-0.5 transition-transform">
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
          <div className="bg-[#EBF0EA] border border-[#8BA888]/40 rounded-2xl p-4 text-xs text-[#5A5A40] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#8BA888] shrink-0" />
              <span>
                <strong className="text-[#5A5A40]">Recent Game Updates: </strong> Tracking major quality-of-life updates, balance adjustments, and Steam Deck fixes for community favorites.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredPatches.map((patch) => (
              <div
                key={patch.id}
                onClick={() => onSelectPatch(patch)}
                className="bg-white rounded-2xl border border-[#E6E2D3] p-5 shadow-xs hover:shadow-md hover:border-[#8BA888] transition-all cursor-pointer flex flex-col justify-between space-y-4"
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
                        <h3 className="font-serif-natural font-normal text-base text-[#4A4A40]">
                          {patch.gameTitle}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#F5F5F0] text-[#5A5A40]">
                            {patch.version}
                          </span>
                          <span className="text-[11px] text-[#707060]">
                            {patch.releaseDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    {patch.isMajorUpdate && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#EBF0EA] text-[#5A5A40] border border-[#8BA888]/40">
                        Major Patch
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#707060] mt-3 leading-relaxed">
                    {patch.summary}
                  </p>

                  {/* Highlights list */}
                  <div className="mt-3 space-y-2">
                    {patch.highlights.map((h, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-[#FDFBF7] border border-[#E6E2D3] text-xs"
                      >
                        <div className="flex items-center justify-between font-bold text-[#5A5A40]">
                          <span>{h.title}</span>
                          {h.badge && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#EBF0EA] text-[#5A5A40]">
                              {h.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#707060] mt-0.5">
                          {h.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Steam Deck Notes */}
                {patch.deckImprovements && (
                  <div className="p-2.5 rounded-xl bg-[#EBF0EA] border border-[#8BA888]/40 text-xs text-[#5A5A40] flex items-start gap-2">
                    <span className="font-bold text-[#8BA888]">Steam Deck:</span>
                    <span>{patch.deckImprovements}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-[#F5F5F0] flex items-center justify-between text-xs">
                  <span className="text-[#707060] font-medium">
                    {patch.detailedNotes.length} detailed changelog items
                  </span>
                  <span className="text-[#8BA888] font-bold flex items-center gap-1">
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
          <div className="bg-white text-[#4A4A40] rounded-2xl p-5 border border-[#E6E2D3] shadow-xs flex items-center justify-between">
            <div>
              <h3 className="font-serif-natural text-lg font-normal text-[#5A5A40]">
                Cozy & Indie Release Radar
              </h3>
              <p className="text-xs text-[#707060] mt-0.5">
                Countdown calendar of the most anticipated relaxing titles in active development.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUpcoming.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectUpcoming(item)}
                className="bg-white rounded-2xl border border-[#E6E2D3] overflow-hidden shadow-xs hover:shadow-md hover:border-[#8BA888] transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="relative aspect-[16/10] bg-[#F5F5F0]">
                  <img
                    src={item.coverImage}
                    alt={item.gameTitle}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 bg-[#5A5A40]/90 backdrop-blur-xs text-[#FDFBF7] text-xs font-bold px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-[#E6A07D]" />
                    <span>Hype: {item.hypeScore}/100</span>
                  </div>

                  <div className="absolute bottom-3 left-3 bg-[#8BA888] text-white text-xs font-bold px-3 py-1 rounded-lg shadow-xs">
                    {item.releaseDate}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-serif-natural font-normal text-base text-[#4A4A40]">
                      {item.gameTitle}
                    </h3>
                    <p className="text-xs text-[#707060] mt-0.5">
                      by {item.developer}
                    </p>

                    <p className="text-xs text-[#707060] line-clamp-3 mt-2 leading-relaxed">
                      {item.cozyVibeNotes}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#F5F5F0] space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-[#F5F5F0] text-[#707060]">
                          #{t}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#707060] pt-1">
                      <span>Platforms: {item.platforms.join(', ')}</span>
                      <span className="text-[#8BA888] font-bold">Track Title →</span>
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
