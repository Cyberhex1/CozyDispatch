import { useState, useEffect } from 'react';
import { 
  Game, 
  NewsArticle, 
  PatchNote, 
  UpcomingRelease, 
  GameCategory, 
  DailyDigest, 
  SoundscapeTrack,
  UserProfile,
  NotificationAlert
} from './types';
import { 
  MOCK_GAMES, 
  FEATURED_WEEKLY_GAMES, 
  MOCK_NEWS_ARTICLES, 
  MOCK_PATCH_NOTES, 
  MOCK_UPCOMING_RELEASES, 
  INITIAL_DAILY_DIGEST 
} from './data/mockData';
import { STEAM_CATALOG_GAMES } from './data/steamCatalog';
import { formatRating } from './utils/format';
import { DEFAULT_USER_PROFILE, DEFAULT_NOTIFICATIONS } from './data/userState';
import { Navbar } from './components/Navbar';
import { HeroFeaturedSection } from './components/HeroFeaturedSection';
import { GameBrowser } from './components/GameBrowser';
import { CategoriesSection } from './components/CategoriesSection';
import { CatalogShowcasesSection } from './components/CatalogShowcasesSection';
import { NewsSection } from './components/NewsSection';
import { DealsAndSalesSection } from './components/DealsAndSalesSection';
import { GameDetailModal } from './components/GameDetailModal';
import { ArticleDetailModal } from './components/ArticleDetailModal';
import { PatchNoteDetailModal } from './components/PatchNoteDetailModal';
import { CozyMoodMatcherModal } from './components/CozyMoodMatcherModal';
import { GameDiscoveryQuizModal } from './components/GameDiscoveryQuizModal';
import { UserProfileModal } from './components/UserProfileModal';
import { WishlistDrawer } from './components/WishlistDrawer';
import { FooterNewsletter } from './components/FooterNewsletter';
import { SearchModal } from './components/SearchModal';
import { audioSynth } from './utils/audioSynth';
import { 
  Tv, 
  Star, 
  Sparkles, 
  Gamepad2, 
  Newspaper, 
  ArrowRight,
  Coffee,
  Percent,
  Compass,
  Check
} from 'lucide-react';

/**
 * All games shown across the site: the hand-curated weekly picks first,
 * then the dynamic Steam catalog. Curated entries win on duplicate ids so
 * hand-written fields (cozyScore, steamDeckNotes, featured copy, ...) are
 * never overwritten by generated data.
 */
const ALL_GAMES: Game[] = (() => {
  const merged = [...MOCK_GAMES, ...STEAM_CATALOG_GAMES];
  const seen = new Set<string>();
  const unique: Game[] = [];
  for (const game of merged) {
    if (seen.has(game.id)) continue;
    seen.add(game.id);
    unique.push(game);
  }
  return unique;
})();

export default function App() {
  // Navigation State: 'home' | 'browser' | 'categories' | 'catalogs' | 'news' | 'deals'
  const [currentView, setCurrentView] = useState<'home' | 'browser' | 'categories' | 'catalogs' | 'news' | 'deals'>('home');
  const [selectedCategory, setSelectedCategory] = useState<GameCategory | 'all'>('all');

  // Active Modals & Drawers
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [selectedPatch, setSelectedPatch] = useState<PatchNote | null>(null);
  const [isMoodMatcherOpen, setIsMoodMatcherOpen] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // User Profile State (Local Persistence)
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('cozy_user_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.username) {
          return { ...DEFAULT_USER_PROFILE, ...parsed };
        }
      }
    } catch {
      return DEFAULT_USER_PROFILE;
    }
    return DEFAULT_USER_PROFILE;
  });

  // Notifications State (Local Persistence)
  const [notifications, setNotifications] = useState<NotificationAlert[]>(() => {
    try {
      const saved = localStorage.getItem('cozy_notifications');
      return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATIONS;
    } catch {
      return DEFAULT_NOTIFICATIONS;
    }
  });

  // Wishlist & Bookmarks State (with localStorage backup)
  const [wishlistedGameIds, setWishlistedGameIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cozy_wishlist');
      return saved ? JSON.parse(saved) : ['fields-of-mistria', 'tiny-glade', 'balatro'];
    } catch {
      return ['fields-of-mistria', 'tiny-glade', 'balatro'];
    }
  });

  const [bookmarkedArticleIds, setBookmarkedArticleIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cozy_bookmarks');
      return saved ? JSON.parse(saved) : ['ign-fields-of-mistria-roadmap'];
    } catch {
      return ['ign-fields-of-mistria-roadmap'];
    }
  });

  // Daily Digest State
  const [dailyDigest, setDailyDigest] = useState<DailyDigest>(INITIAL_DAILY_DIGEST);
  const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);

  // Audio Ambience Synth State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeSoundtrack, setActiveSoundtrack] = useState<SoundscapeTrack>('rain');
  const [audioVolume, setAudioVolume] = useState(0.4);

  // Persist State
  useEffect(() => {
    try {
      localStorage.setItem('cozy_user_profile', JSON.stringify(userProfile));
    } catch {}
  }, [userProfile]);

  useEffect(() => {
    try {
      localStorage.setItem('cozy_notifications', JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem('cozy_wishlist', JSON.stringify(wishlistedGameIds));
    } catch {}
  }, [wishlistedGameIds]);

  useEffect(() => {
    try {
      localStorage.setItem('cozy_bookmarks', JSON.stringify(bookmarkedArticleIds));
    } catch {}
  }, [bookmarkedArticleIds]);

  // Keyboard shortcut for universal search (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Audio volume change listener
  const handleVolumeChange = (vol: number) => {
    setAudioVolume(vol);
    audioSynth.setVolume(vol);
  };

  const handleToggleAudio = () => {
    if (isPlayingAudio) {
      audioSynth.stop();
      setIsPlayingAudio(false);
    } else {
      audioSynth.start(activeSoundtrack, audioVolume);
      setIsPlayingAudio(true);
    }
  };

  const handleChangeSoundtrack = (track: SoundscapeTrack) => {
    setActiveSoundtrack(track);
    if (isPlayingAudio) {
      audioSynth.start(track, audioVolume);
    }
  };

  // Wishlist / Bookmark Toggles with automatic price-drop alert check
  const handleToggleWishlist = (gameId: string) => {
    setWishlistedGameIds((prev) => {
      const isAlready = prev.includes(gameId);
      const targetGame = ALL_GAMES.find((g) => g.id === gameId);
      
      if (!isAlready && targetGame) {
        // Create an alert confirmation
        const newNotif: NotificationAlert = {
          id: `notif-add-${Date.now()}`,
          title: `Added "${targetGame.title}" to Wishlist`,
          message: `You'll receive notifications whenever ${targetGame.title} receives PC patch updates or goes on sale on Steam.`,
          date: 'Just now',
          type: 'wishlist',
          gameId: targetGame.id,
          gameTitle: targetGame.title,
          isRead: false
        };
        setNotifications((n) => [newNotif, ...n]);
      }

      return isAlready ? prev.filter((id) => id !== gameId) : [...prev, gameId];
    });
  };

  const handleBookmarkArticle = (articleId: string) => {
    setBookmarkedArticleIds((prev) =>
      prev.includes(articleId) ? prev.filter((id) => id !== articleId) : [...prev, articleId]
    );
  };

  const handleClearAllWishlist = () => {
    setWishlistedGameIds([]);
    setBookmarkedArticleIds([]);
  };

  // Navigation handler
  const handleNavigate = (view: 'home' | 'browser' | 'categories' | 'catalogs' | 'news' | 'deals', category?: GameCategory) => {
    setCurrentView(view);
    if (category) {
      setSelectedCategory(category);
    } else if (view === 'home' || view === 'deals' || view === 'categories' || view === 'catalogs') {
      setSelectedCategory('all');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Notification management
  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  const handleSelectGameById = (gameId: string) => {
    const found = ALL_GAMES.find((g) => g.id === gameId);
    if (found) {
      setSelectedGame(found);
    }
  };

  // Daily AI Briefing generation
  const handleGenerateAIDigest = async () => {
    setIsGeneratingDigest(true);
    try {
      const response = await fetch('/api/gemini/daily-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory })
      });
      const data = await response.json();
      if (data.success && data.digest) {
        setDailyDigest(data.digest);
      }
    } catch {
      // Maintain current state if server offline
    } finally {
      setIsGeneratingDigest(false);
    }
  };

  // Get wishlisted Game and Article objects for the drawer
  const savedGameObjects = ALL_GAMES.filter((g) => wishlistedGameIds.includes(g.id));
  const savedArticleObjects = MOCK_NEWS_ARTICLES.filter((a) => bookmarkedArticleIds.includes(a.id));

  return (
    <div className="min-h-screen flex flex-col bg-base text-text-main selection:bg-brand/20 selection:text-text-heading">
      {/* Top Main Navigation Bar */}
      <Navbar
        currentView={currentView}
        selectedCategory={selectedCategory}
        onNavigate={handleNavigate}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenMoodMatcher={() => setIsMoodMatcherOpen(true)}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        onOpenQuiz={() => setIsQuizOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        wishlistCount={wishlistedGameIds.length + bookmarkedArticleIds.length}
        userProfile={userProfile}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onClearNotifications={handleClearNotifications}
        onSelectGameById={handleSelectGameById}
        isPlayingAudio={isPlayingAudio}
        activeSoundtrack={activeSoundtrack}
        onToggleAudio={handleToggleAudio}
        onChangeSoundtrack={handleChangeSoundtrack}
        audioVolume={audioVolume}
        onVolumeChange={handleVolumeChange}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* ===================== VIEW 1: HOME PAGE ===================== */}
        {currentView === 'home' && (
          <div className="space-y-12">
            {/* HERO FEATURED SECTION (5 Most Talked-About Weekly Releases) */}
            <HeroFeaturedSection
              featuredGames={FEATURED_WEEKLY_GAMES}
              onSelectGame={(game) => setSelectedGame(game)}
              onToggleWishlist={handleToggleWishlist}
              isWishlisted={(id) => wishlistedGameIds.includes(id)}
            />

            {/* Quick Interactive Discovery Banner & Discovery Quiz CTA */}
            <section className="bg-gradient-to-r from-[#EBF0EA] via-[#F5F5F0] to-[#FDFBF7] p-6 sm:p-8 rounded-3xl border border-border shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand text-white text-xs font-bold shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Personalized PC Recommendations</span>
                </div>
                <h3 className="font-serif-natural text-2xl sm:text-3xl font-normal text-text-heading">
                  Unsure what cozy PC game to play next?
                </h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  Take our 4-step <strong>Game Discovery Quiz</strong>. Tell us your favorite art styles, preferred stress level, and hardware targets (Desktop vs. Steam Deck) to receive your tailored match.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  id="home-start-quiz-btn"
                  onClick={() => setIsQuizOpen(true)}
                  className="px-6 py-3.5 rounded-2xl bg-brand hover:bg-brand-hover text-white font-bold text-sm shadow-md hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Compass className="w-4 h-4" />
                  <span>Start Discovery Quiz</span>
                </button>
                <button
                  id="home-view-deals-btn"
                  onClick={() => handleNavigate('deals')}
                  className="px-5 py-3.5 rounded-2xl bg-base hover:bg-surface text-text-heading border border-border font-bold text-sm transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Percent className="w-4 h-4 text-accent" />
                  <span>Browse Deals & Sales</span>
                </button>
              </div>
            </section>

            {/* 4 Core Pillars Discovery Banner */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  id: 'cozy',
                  title: 'Cozy & Wholesome',
                  desc: 'Farming sims, town life, cottagecore, zero stress on PC',
                  icon: Coffee,
                  color: 'from-[#8BA888] to-[#7A9977]',
                  badge: 'Cottagecore'
                },
                {
                  id: 'indie',
                  title: 'Indie Artistry',
                  desc: 'Auteur mechanics, roguelikes, visual gems',
                  icon: Sparkles,
                  color: 'from-[#5A5A40] to-[#4A4A40]',
                  badge: 'Original IP'
                },
                {
                  id: 'simulation',
                  title: 'Simulation & Sandbox',
                  desc: 'Management, tactile builders, chill loops',
                  icon: Gamepad2,
                  color: 'from-[#E6A07D] to-[#D98A65]',
                  badge: 'Creative'
                },
                {
                  id: 'steam-deck',
                  title: 'Steam Deck Focus',
                  desc: 'Verified on handheld, great battery life & 60 FPS',
                  icon: Tv,
                  color: 'from-[#707060] to-[#5A5A40]',
                  badge: 'Handheld Ready'
                }
              ].map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={pillar.id}
                    className="bg-base p-5 rounded-2xl border border-border shadow-xs hover:shadow-md hover:border-brand transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pillar.color} text-white flex items-center justify-center shadow-xs`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface text-text-muted border border-border">
                          {pillar.badge}
                        </span>
                      </div>

                      <h3 className="font-serif-natural text-lg font-normal text-text-heading group-hover:text-brand transition-colors">
                        {pillar.title}
                      </h3>
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">
                        {pillar.desc}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-4 mt-2 border-t border-[#F5F5F0] text-xs font-bold">
                      <button
                        onClick={() => handleNavigate('browser', pillar.id as GameCategory)}
                        className="text-brand hover:text-text-heading cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <span>Games</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[#D6D2C4]">•</span>
                      <button
                        onClick={() => handleNavigate('news', pillar.id as GameCategory)}
                        className="text-text-muted hover:text-text-main cursor-pointer transition-colors"
                      >
                        News
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Daily Morning Dispatch & Trending News Highlights */}
            <section className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase font-bold text-brand tracking-wider">
                    <Newspaper className="w-4 h-4" />
                    <span>Aggregated Outlets & Reports</span>
                  </div>
                  <h2 className="font-serif-natural text-2xl sm:text-3xl font-normal text-text-heading tracking-tight">
                    Today's Top Headlines & Coverage
                  </h2>
                </div>

                <button
                  id="home-view-all-news-btn"
                  onClick={() => handleNavigate('news')}
                  className="px-4 py-2 rounded-xl bg-inverse hover:bg-[#4A4A40] text-text-on-inverse font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-center shadow-xs"
                >
                  <span>View All News & Patch Notes</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* 3 Featured News Articles Preview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {MOCK_NEWS_ARTICLES.slice(0, 3).map((article) => (
                  <article
                    key={article.id}
                    onClick={() => setSelectedArticle(article)}
                    className="group bg-base rounded-2xl border border-border overflow-hidden shadow-xs hover:shadow-md hover:border-brand transition-all duration-300 flex flex-col cursor-pointer"
                  >
                    <div className="relative aspect-[16/9] bg-surface overflow-hidden">
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 left-3 bg-inverse/90 backdrop-blur-xs text-text-on-inverse text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded shadow-xs">
                        {article.source}
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <div className="text-[11px] text-text-muted mb-1">
                          {article.publishedAt} • {article.readTimeMinutes} min read
                        </div>
                        <h3 className="font-display text-sm font-bold text-text-main group-hover:text-brand transition-colors leading-snug line-clamp-2">
                          {article.title}
                        </h3>
                        <p className="text-xs text-text-muted line-clamp-2 mt-1.5 leading-relaxed">
                          {article.summary}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#F5F5F0] flex items-center justify-between text-xs text-brand font-bold">
                        <span>Read Takeaway</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* Hidden Gems & Highly Rated Spotlight Preview */}
            <section className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase font-bold text-accent tracking-wider">
                    <Star className="w-4 h-4 fill-[#E6A07D] text-accent" />
                    <span>Hand-Picked PC Gems</span>
                  </div>
                  <h2 className="font-serif-natural text-2xl sm:text-3xl font-normal text-text-heading tracking-tight">
                    Relaxing Gems & Community Favorites
                  </h2>
                </div>

                <button
                  id="home-view-all-browser-btn"
                  onClick={() => handleNavigate('browser')}
                  className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-center shadow-xs"
                >
                  <span>Explore Full Game Browser ({ALL_GAMES.length} Titles)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* 4 Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {ALL_GAMES.slice(0, 4).map((game) => {
                  return (
                    <div
                      key={game.id}
                      onClick={() => setSelectedGame(game)}
                      className="group bg-base rounded-2xl border border-border overflow-hidden shadow-xs hover:shadow-md hover:border-brand transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="relative aspect-[16/10] bg-surface overflow-hidden">
                        <img
                          src={game.coverImage}
                          alt={game.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-2.5 left-2.5 bg-inverse/90 backdrop-blur-xs text-text-on-inverse text-[10px] font-bold px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                          <Star className="w-3 h-3 fill-[#E6A07D] text-accent" />
                          <span>{game.cozyScore}/10</span>
                        </div>
                        {game.steamDeckStatus === 'Verified' && (
                          <div className="absolute top-2.5 right-2.5 bg-surface-brand text-text-heading text-[10px] font-bold px-2 py-0.5 rounded shadow-xs border border-brand/40">
                            Deck ✓
                          </div>
                        )}
                        {game.isOnSale && (
                          <div className="absolute bottom-2.5 left-2.5 bg-accent text-white text-[10px] font-black px-2 py-0.5 rounded shadow-xs">
                            -{game.discountPercent}% OFF
                          </div>
                        )}
                      </div>

                      <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <h3 className="font-display text-sm font-bold text-text-main group-hover:text-brand transition-colors line-clamp-1">
                              {game.title}
                            </h3>
                            <span className="text-xs font-bold text-text-heading whitespace-nowrap">
                              {game.salePrice || game.price}
                            </span>
                          </div>
                          <p className="text-xs text-text-muted line-clamp-2 mt-1">
                            {game.shortDescription}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-[#F5F5F0] flex items-center justify-between text-xs">
                          <span className="text-brand font-bold">
                            {formatRating(game.ratingScore, ' Pos')}
                          </span>
                          <span className="text-text-faint capitalize">
                            {game.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* ===================== VIEW 2: GAME BROWSER ===================== */}
        {currentView === 'browser' && (
          <GameBrowser
            games={ALL_GAMES}
            selectedCategory={selectedCategory}
            onCategoryChange={(cat) => setSelectedCategory(cat)}
            onSelectGame={(game) => setSelectedGame(game)}
            onToggleWishlist={handleToggleWishlist}
            isWishlisted={(id) => wishlistedGameIds.includes(id)}
          />
        )}

        {/* ===================== VIEW 3: CATEGORIES SECTION ===================== */}
        {currentView === 'categories' && (
          <CategoriesSection
            games={ALL_GAMES}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setCurrentView('browser');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectGame={(game) => setSelectedGame(game)}
          />
        )}

        {/* ===================== VIEW 4: SHOWCASES & CATALOGS ===================== */}
        {currentView === 'catalogs' && (
          <CatalogShowcasesSection
            games={ALL_GAMES}
            onSelectGame={(game) => setSelectedGame(game)}
            onToggleWishlist={handleToggleWishlist}
            isWishlisted={(id) => wishlistedGameIds.includes(id)}
          />
        )}

        {/* ===================== VIEW 5: NEWS & PATCH HUB ===================== */}
        {currentView === 'news' && (
          <NewsSection
            articles={MOCK_NEWS_ARTICLES}
            patchNotes={MOCK_PATCH_NOTES}
            upcomingReleases={MOCK_UPCOMING_RELEASES}
            dailyDigest={dailyDigest}
            selectedCategory={selectedCategory}
            onCategoryChange={(cat) => setSelectedCategory(cat)}
            onSelectArticle={(article) => setSelectedArticle(article)}
            onSelectPatch={(patch) => setSelectedPatch(patch)}
            onSelectUpcoming={(item) => {
              const matchedGame = ALL_GAMES.find((g) => g.title.toLowerCase().includes(item.gameTitle.toLowerCase()));
              if (matchedGame) setSelectedGame(matchedGame);
            }}
            onGenerateAIDigest={handleGenerateAIDigest}
            isGeneratingDigest={isGeneratingDigest}
            onBookmarkArticle={handleBookmarkArticle}
            isBookmarked={(id) => bookmarkedArticleIds.includes(id)}
          />
        )}

        {/* ===================== VIEW 4: DEALS & SALES ===================== */}
        {currentView === 'deals' && (
          <DealsAndSalesSection
            games={ALL_GAMES}
            onSelectGame={(game) => setSelectedGame(game)}
            onToggleWishlist={handleToggleWishlist}
            isWishlisted={(id) => wishlistedGameIds.includes(id)}
          />
        )}
      </main>

      {/* Modals and Drawers */}
      <GameDetailModal
        game={selectedGame}
        onClose={() => setSelectedGame(null)}
        onToggleWishlist={handleToggleWishlist}
        isWishlisted={selectedGame ? wishlistedGameIds.includes(selectedGame.id) : false}
      />

      <ArticleDetailModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
        onBookmark={handleBookmarkArticle}
        isBookmarked={selectedArticle ? bookmarkedArticleIds.includes(selectedArticle.id) : false}
      />

      <PatchNoteDetailModal
        patch={selectedPatch}
        onClose={() => setSelectedPatch(null)}
      />

      <CozyMoodMatcherModal
        isOpen={isMoodMatcherOpen}
        onClose={() => setIsMoodMatcherOpen(false)}
        allGames={ALL_GAMES}
        onSelectGame={(game) => setSelectedGame(game)}
      />

      <GameDiscoveryQuizModal
        isOpen={isQuizOpen}
        onClose={() => setIsQuizOpen(false)}
        allGames={ALL_GAMES}
        onSelectGame={(game) => setSelectedGame(game)}
        onToggleWishlist={handleToggleWishlist}
        isWishlisted={(id) => wishlistedGameIds.includes(id)}
      />

      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userProfile={userProfile}
        profile={userProfile}
        onUpdateProfile={(updated) => setUserProfile(updated)}
        wishlistGames={savedGameObjects}
        onRemoveWishlist={handleToggleWishlist}
        onSelectGame={(game) => setSelectedGame(game)}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onClearNotifications={handleClearNotifications}
      />

      <WishlistDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        savedGames={savedGameObjects}
        bookmarkedArticles={savedArticleObjects}
        onRemoveGame={handleToggleWishlist}
        onRemoveArticle={handleBookmarkArticle}
        onSelectGame={(game) => setSelectedGame(game)}
        onSelectArticle={(article) => setSelectedArticle(article)}
        onClearAll={handleClearAllWishlist}
        onOpenProfile={() => {
          setIsWishlistOpen(false);
          setIsProfileOpen(true);
        }}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        games={ALL_GAMES}
        articles={MOCK_NEWS_ARTICLES}
        patchNotes={MOCK_PATCH_NOTES}
        onSelectGame={(game) => setSelectedGame(game)}
        onSelectArticle={(article) => setSelectedArticle(article)}
        onSelectPatch={(patch) => setSelectedPatch(patch)}
      />

      {/* Elegant Footer in Natural Tones */}
      <footer className="mt-16 bg-surface text-text-muted border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center text-white font-bold shadow-xs">
                  🌱
                </div>
                <span className="font-serif-natural text-lg font-normal text-text-heading">
                  Cozy & Indie Dispatch
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                A daily sanctuary for wholesome, relaxing, and handcrafted indie PC games. Daily news summaries, Steam discounts, Steam Deck optimization notes, and community patch updates.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-heading mb-3">
                Core PC Sections
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button onClick={() => handleNavigate('home')} className="hover:text-text-heading transition-colors">
                    Weekly Featured Releases
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('deals')} className="hover:text-text-heading text-accent font-bold transition-colors">
                    🏷️ Steam Deals & Sales
                  </button>
                </li>
                <li>
                  <button onClick={() => setIsQuizOpen(true)} className="hover:text-text-heading text-brand font-bold transition-colors">
                    ✨ Game Discovery Quiz
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('browser', 'cozy')} className="hover:text-text-heading transition-colors">
                    Cozy & Wholesome Games
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('browser', 'indie')} className="hover:text-text-heading transition-colors">
                    Indie Art & Roguelikes
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('browser', 'steam-deck')} className="hover:text-text-heading transition-colors">
                    Steam Deck Verified Radar
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-heading mb-3">
                News & Dispatches
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button onClick={() => handleNavigate('news')} className="hover:text-text-heading transition-colors">
                    Latest IGN, GameSpot & Eurogamer Coverage
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('news')} className="hover:text-text-heading transition-colors">
                    Stardew Valley & Balatro PC Patch Notes
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('news')} className="hover:text-text-heading transition-colors">
                    Upcoming PC Release Calendar
                  </button>
                </li>
                <li>
                  <button onClick={() => setIsProfileOpen(true)} className="hover:text-text-heading transition-colors text-text-heading font-bold">
                    👤 User Profile & Price Alerts
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <FooterNewsletter />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
