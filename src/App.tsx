import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Game, 
  NewsArticle, 
  PatchNote, 
  UpcomingRelease, 
  GameCategory,
  NewsTopicCategory,
  DailyDigest, 
  SoundscapeTrack,
  UserProfile,
  NotificationAlert,
  UserAccountData,
  BrowserFilterType
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
import { fetchCloudUserData, pushCloudUserData, getStoredAuthToken } from './services/accountSync';
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
  Star, 
  Sparkles, 
  Gamepad2, 
  ArrowRight,
  Coffee,
  Percent,
  Compass,
  Heart,
  Layers,
  User,
  Home,
  Tv
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

type AppView = 'home' | 'browser' | 'categories' | 'catalogs' | 'news' | 'deals';

function parseUrlState() {
  if (typeof window === 'undefined') {
    return {
      view: 'home' as AppView,
      category: 'all' as GameCategory | NewsTopicCategory | 'all',
      filter: 'all' as BrowserFilterType,
      sort: 'rating' as 'rating' | 'cozy' | 'reviews' | 'newest' | 'updated' | 'price',
      search: '',
      gameId: null as string | null,
      articleId: null as string | null
    };
  }

  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view') as AppView | null;
  const catParam = params.get('category') as (GameCategory | NewsTopicCategory | 'all') | null;
  const filterParam = params.get('filter') as BrowserFilterType | null;
  const sortParam = params.get('sort') as ('rating' | 'cozy' | 'reviews' | 'newest' | 'updated' | 'price') | null;
  const searchParam = params.get('q') || params.get('search') || '';
  const gameParam = params.get('game');
  const articleParam = params.get('article');

  const validViews: AppView[] = ['home', 'browser', 'categories', 'catalogs', 'news', 'deals'];
  const view: AppView = viewParam && validViews.includes(viewParam) ? viewParam : 'home';
  const category = catParam || 'all';
  const filter: BrowserFilterType = filterParam || 'all';
  const sort = sortParam || 'rating';

  return {
    view,
    category,
    filter,
    sort,
    search: searchParam,
    gameId: gameParam,
    articleId: articleParam
  };
}

export default function App() {
  const initialUrl = useRef(parseUrlState()).current;

  // Navigation State: 'home' | 'browser' | 'categories' | 'catalogs' | 'news' | 'deals'
  const [currentView, setCurrentView] = useState<AppView>(initialUrl.view);
  const [selectedCategory, setSelectedCategory] = useState<GameCategory | NewsTopicCategory | 'all'>(initialUrl.category);
  const [browserFilter, setBrowserFilter] = useState<BrowserFilterType>(initialUrl.filter);
  const [browserSort, setBrowserSort] = useState<'rating' | 'cozy' | 'reviews' | 'newest' | 'updated' | 'price'>(initialUrl.sort);
  const [browserSearch, setBrowserSearch] = useState<string>(initialUrl.search);

  // Active Modals & Drawers
  const [selectedGame, setSelectedGame] = useState<Game | null>(() => {
    if (initialUrl.gameId) {
      return ALL_GAMES.find((g) => g.id === initialUrl.gameId || g.slug === initialUrl.gameId) || null;
    }
    return null;
  });
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(() => {
    if (initialUrl.articleId) {
      return MOCK_NEWS_ARTICLES.find((a) => a.id === initialUrl.articleId) || null;
    }
    return null;
  });
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

  // Live News Articles Feed State
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>(MOCK_NEWS_ARTICLES);
  const [isRefreshingNews, setIsRefreshingNews] = useState(false);

  // Synchronize URL Query Parameters with state changes
  const updateUrlParams = useCallback((replace = false) => {
    const params = new URLSearchParams();

    if (currentView !== 'home') {
      params.set('view', currentView);
    }
    if (selectedCategory !== 'all') {
      params.set('category', selectedCategory);
    }
    if (currentView === 'browser') {
      if (browserFilter !== 'all') {
        params.set('filter', browserFilter);
      }
      if (browserSort !== 'rating') {
        params.set('sort', browserSort);
      }
      if (browserSearch.trim()) {
        params.set('q', browserSearch.trim());
      }
    }
    if (selectedGame) {
      params.set('game', selectedGame.id);
    }
    if (selectedArticle) {
      params.set('article', selectedArticle.id);
    }

    const searchStr = params.toString();
    const newUrl = searchStr ? `${window.location.pathname}?${searchStr}` : window.location.pathname;

    if (replace) {
      window.history.replaceState({ view: currentView, category: selectedCategory }, '', newUrl);
    } else {
      window.history.pushState({ view: currentView, category: selectedCategory }, '', newUrl);
    }
  }, [currentView, selectedCategory, browserFilter, browserSort, browserSearch, selectedGame, selectedArticle]);

  // Initial and subsequent URL synchronization
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      updateUrlParams(true);
      return;
    }
    updateUrlParams(false);
  }, [currentView, selectedCategory, browserFilter, browserSort, browserSearch, selectedGame, selectedArticle, updateUrlParams]);

  // Listen to popstate (Back/Forward browser buttons)
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseUrlState();
      setCurrentView(parsed.view);
      setSelectedCategory(parsed.category);
      setBrowserFilter(parsed.filter);
      setBrowserSort(parsed.sort);
      setBrowserSearch(parsed.search);
      if (parsed.gameId) {
        setSelectedGame(ALL_GAMES.find((g) => g.id === parsed.gameId || g.slug === parsed.gameId) || null);
      } else {
        setSelectedGame(null);
      }
      if (parsed.articleId) {
        setSelectedArticle(newsArticles.find((a) => a.id === parsed.articleId) || null);
      } else {
        setSelectedArticle(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [newsArticles]);

  // Fetch live news on mount
  useEffect(() => {
    fetch('/api/news')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.articles) && data.articles.length > 0) {
          setNewsArticles(data.articles);
        }
      })
      .catch(() => {
        // Falls back seamlessly to bundled snapshot
      });
  }, []);

  const handleRefreshNews = async () => {
    setIsRefreshingNews(true);
    try {
      const res = await fetch('/api/news/refresh', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const fetchRes = await fetch('/api/news');
        const newsData = await fetchRes.json();
        if (newsData.success && Array.isArray(newsData.articles)) {
          setNewsArticles(newsData.articles);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsRefreshingNews(false);
    }
  };

  // Multi-Device Cloud Hydration State
  const [isCloudHydrated, setIsCloudHydrated] = useState(false);

  // Multi-Device Cloud Hydration on App Mount
  useEffect(() => {
    const token = getStoredAuthToken();
    if (token) {
      fetchCloudUserData().then((cloudUser) => {
        if (cloudUser) {
          setUserProfile({ ...cloudUser.profile, isLoggedIn: true, email: cloudUser.email });
          if (Array.isArray(cloudUser.wishlistedGameIds)) {
            setWishlistedGameIds(cloudUser.wishlistedGameIds);
          }
          if (Array.isArray(cloudUser.bookmarkedArticleIds)) {
            setBookmarkedArticleIds(cloudUser.bookmarkedArticleIds);
          }
          if (Array.isArray(cloudUser.notifications) && cloudUser.notifications.length > 0) {
            setNotifications(cloudUser.notifications);
          }
        } else {
          setUserProfile((prev) => ({ ...prev, isLoggedIn: false }));
        }
        setIsCloudHydrated(true);
      }).catch(() => {
        setIsCloudHydrated(true);
      });
    } else {
      setIsCloudHydrated(true);
    }
  }, []);

  // Multi-Device Cloud Sync (Debounced Auto-Save when Logged In and fully Hydrated)
  useEffect(() => {
    if (!isCloudHydrated || !userProfile.isLoggedIn) return;

    const timer = setTimeout(() => {
      pushCloudUserData({
        profile: userProfile,
        wishlistedGameIds,
        bookmarkedArticleIds,
        notifications
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [isCloudHydrated, userProfile, wishlistedGameIds, bookmarkedArticleIds, notifications]);

  // Auth Handlers
  const handleLoginSuccess = (userData: UserAccountData) => {
    setUserProfile({ ...userData.profile, isLoggedIn: true, email: userData.email });
    if (Array.isArray(userData.wishlistedGameIds)) {
      setWishlistedGameIds(userData.wishlistedGameIds);
    }
    if (Array.isArray(userData.bookmarkedArticleIds)) {
      setBookmarkedArticleIds(userData.bookmarkedArticleIds);
    }
    if (Array.isArray(userData.notifications) && userData.notifications.length > 0) {
      setNotifications(userData.notifications);
    }
    setIsCloudHydrated(true);
  };

  const handleLogoutSuccess = () => {
    setUserProfile({ ...DEFAULT_USER_PROFILE, isLoggedIn: false });
  };

  // Local Storage Cache Backup
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

  // Wishlist / Bookmark Toggles with automatic price-drop alert check
  const handleToggleWishlist = (gameId: string) => {
    setWishlistedGameIds((prev) => {
      const isAlready = prev.includes(gameId);
      const targetGame = ALL_GAMES.find((g) => g.id === gameId);
      
      if (!isAlready && targetGame) {
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
  const handleNavigate = (
    view: AppView, 
    category?: GameCategory | NewsTopicCategory | 'all'
  ) => {
    setCurrentView(view);
    if (category) {
      setSelectedCategory(category);
    } else if (view === 'home' || view === 'deals' || view === 'catalogs') {
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

  const handleClearNotifications = () => {
    setNotifications([]);
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
  const savedArticleObjects = newsArticles.filter((a) => bookmarkedArticleIds.includes(a.id));

  return (
    <div className="min-h-screen flex flex-col bg-base text-text-main selection:bg-brand/20 selection:text-text-heading">
      {/* Top Main Navigation Bar */}
      <Navbar
        currentView={currentView}
        selectedCategory={selectedCategory as any}
        onNavigate={handleNavigate}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenMoodMatcher={() => setIsMoodMatcherOpen(true)}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        wishlistCount={wishlistedGameIds.length + bookmarkedArticleIds.length}
        userProfile={userProfile}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-8 sm:space-y-12 pb-28 md:pb-8">
        {/* ===================== VIEW 1: HOME PAGE ===================== */}
        {currentView === 'home' && (
          <div className="space-y-8 sm:space-y-12">
            {/* HERO FEATURED SECTION (5 Most Talked-About Weekly Releases) */}
            <HeroFeaturedSection
              featuredGames={FEATURED_WEEKLY_GAMES}
              onSelectGame={(game) => setSelectedGame(game)}
              onToggleWishlist={handleToggleWishlist}
              isWishlisted={(id) => wishlistedGameIds.includes(id)}
            />

            {/* Quick Interactive Discovery Banner & Discovery Quiz CTA */}
            <section className="bg-gradient-to-r from-surface-brand via-surface to-base p-5 sm:p-8 rounded-3xl border border-border shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 sm:gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand text-white text-xs font-bold shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Personalized PC Recommendations</span>
                </div>
                <h3 className="font-serif-natural text-xl sm:text-2xl lg:text-3xl font-normal text-text-heading">
                  Unsure what cozy PC game to play next?
                </h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  Take our 4-step <strong>Game Discovery Quiz</strong>. Tell us your favorite art styles, preferred stress level, and hardware targets (Desktop vs. Steam Deck) to receive your tailored match.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <button
                  id="home-start-quiz-btn"
                  onClick={() => setIsQuizOpen(true)}
                  className="w-full sm:w-auto justify-center px-6 py-3 rounded-2xl bg-brand hover:bg-brand-hover text-white font-bold text-xs sm:text-sm shadow-md hover:scale-105 transition-all flex items-center gap-2 cursor-pointer min-h-[44px] touch-manipulation"
                >
                  <Compass className="w-4 h-4" />
                  <span>Start Discovery Quiz</span>
                </button>
                <button
                  id="home-view-deals-btn"
                  onClick={() => handleNavigate('deals')}
                  className="w-full sm:w-auto justify-center px-5 py-3 rounded-2xl bg-base hover:bg-surface text-text-heading border border-border font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shadow-xs min-h-[44px] touch-manipulation"
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
                    className="bg-surface p-5 rounded-2xl border border-border shadow-xs hover:shadow-md hover:border-brand transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pillar.color} text-white flex items-center justify-center shadow-xs`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-base text-text-muted border border-border">
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

                    <div className="flex items-center gap-2 pt-4 mt-2 border-t border-border text-xs font-bold">
                      <button
                        onClick={() => handleNavigate('browser', pillar.id as GameCategory)}
                        className="text-brand hover:text-text-heading cursor-pointer flex items-center gap-1 transition-colors min-h-[36px]"
                      >
                        <span>Explore {pillar.title}</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Quick Catalog Preview Bar */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase font-bold text-brand tracking-wider mb-1">
                    <Gamepad2 className="w-4 h-4" />
                    <span>Catalog Discovery</span>
                  </div>
                  <h2 className="font-serif-natural text-2xl sm:text-3xl font-normal text-text-heading tracking-tight">
                    Relaxing Gems & Community Favorites
                  </h2>
                </div>

                <button
                  id="home-view-all-browser-btn"
                  onClick={() => handleNavigate('browser', 'all')}
                  className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-center shadow-xs min-h-[44px] touch-manipulation"
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
                      className="group bg-surface rounded-2xl border border-border overflow-hidden shadow-xs hover:shadow-md hover:border-brand transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="relative aspect-[16/10] bg-base overflow-hidden">
                        <img
                          src={game.coverImage}
                          alt={game.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
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
                          <div className="absolute bottom-2.5 left-2.5 bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">
                            -{game.discountPercent}%
                          </div>
                        )}
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-serif-natural text-base font-normal text-text-main group-hover:text-brand transition-colors line-clamp-1">
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

                        <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                          <span className="text-brand font-bold">
                            {formatRating(game.ratingScore, ' Pos')}
                          </span>
                          <span className="text-text-muted capitalize">
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
            selectedCategory={selectedCategory as GameCategory | 'all'}
            onCategoryChange={(cat) => setSelectedCategory(cat)}
            onSelectGame={(game) => setSelectedGame(game)}
            onToggleWishlist={handleToggleWishlist}
            isWishlisted={(id) => wishlistedGameIds.includes(id)}
            initialFilterType={browserFilter}
            initialSortBy={browserSort}
            initialSearchQuery={browserSearch}
            onFilterChange={(f) => setBrowserFilter(f)}
            onSortChange={(s) => setBrowserSort(s)}
            onSearchChange={(q) => setBrowserSearch(q)}
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
            articles={newsArticles}
            patchNotes={MOCK_PATCH_NOTES}
            upcomingReleases={MOCK_UPCOMING_RELEASES}
            dailyDigest={dailyDigest}
            selectedCategory={selectedCategory as NewsTopicCategory}
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
            onRefreshFeed={handleRefreshNews}
            isRefreshingFeed={isRefreshingNews}
          />
        )}

        {/* ===================== VIEW 6: DEALS & SALES ===================== */}
        {currentView === 'deals' && (
          <DealsAndSalesSection
            games={ALL_GAMES}
            onSelectGame={(game) => setSelectedGame(game)}
            onToggleWishlist={handleToggleWishlist}
            isWishlisted={(id) => wishlistedGameIds.includes(id)}
            onOpenQuiz={() => setIsQuizOpen(true)}
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
        onBookmark={(id) => handleBookmarkArticle(id)}
        isBookmarked={selectedArticle ? bookmarkedArticleIds.includes(selectedArticle.id) : false}
        onSelectGame={(game) => setSelectedGame(game)}
      />

      <PatchNoteDetailModal
        patch={selectedPatch}
        onClose={() => setSelectedPatch(null)}
        onSelectGame={(game) => setSelectedGame(game)}
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
        onLoginSuccess={handleLoginSuccess}
        onLogoutSuccess={handleLogoutSuccess}
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
        onOpenProfileWishlist={() => {
          setIsWishlistOpen(false);
          setIsProfileOpen(true);
        }}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        games={ALL_GAMES}
        articles={newsArticles}
        patchNotes={MOCK_PATCH_NOTES}
        onSelectGame={(game) => setSelectedGame(game)}
        onSelectArticle={(article) => setSelectedArticle(article)}
        onSelectPatch={(patch) => setSelectedPatch(patch)}
      />

      {/* Elegant Footer */}
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
                  <button onClick={() => handleNavigate('home')} className="hover:text-text-heading transition-colors cursor-pointer">
                    Weekly Featured Releases
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('deals')} className="hover:text-text-heading text-accent font-bold transition-colors cursor-pointer">
                    🏷️ Steam Deals & Sales
                  </button>
                </li>
                <li>
                  <button onClick={() => setIsQuizOpen(true)} className="hover:text-text-heading text-brand font-bold transition-colors cursor-pointer">
                    ✨ Game Discovery Quiz
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('browser', 'cozy')} className="hover:text-text-heading transition-colors cursor-pointer">
                    Cozy & Wholesome Games
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('browser', 'farming')} className="hover:text-text-heading transition-colors cursor-pointer">
                    🌾 Farming & Life Sims
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-heading mb-3">
                Categories & Handheld
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button onClick={() => handleNavigate('browser', 'simulation')} className="hover:text-text-heading transition-colors cursor-pointer">
                    Simulation & Tactile Builders
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('browser', 'indie')} className="hover:text-text-heading transition-colors cursor-pointer">
                    Indie Art & Roguelikes
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('browser', 'steam-deck')} className="hover:text-text-heading transition-colors cursor-pointer">
                    Steam Deck Verified Radar
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('browser', 'horror')} className="hover:text-text-heading transition-colors cursor-pointer">
                    🕯️ Cozy Horror & Mystery
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

      {/* Mobile Sticky Bottom Navigation Tab Bar (< md screens) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-base/95 backdrop-blur-xl border-t border-border px-2 py-1.5 md:hidden safe-bottom shadow-lg transition-transform">
        <div className="grid grid-cols-6 items-center justify-around max-w-lg mx-auto">
          {/* Home */}
          <button
            onClick={() => handleNavigate('home')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer ${
              currentView === 'home'
                ? 'text-brand font-bold'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${currentView === 'home' ? 'bg-surface-brand text-brand' : ''}`}>
              <Home className="w-4 h-4" />
            </div>
            <span className="text-[10px] mt-0.5 leading-tight">Home</span>
          </button>

          {/* Games Browser */}
          <button
            onClick={() => handleNavigate('browser', 'all')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer ${
              currentView === 'browser'
                ? 'text-brand font-bold'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${currentView === 'browser' ? 'bg-surface-brand text-brand' : ''}`}>
              <Gamepad2 className="w-4 h-4" />
            </div>
            <span className="text-[10px] mt-0.5 leading-tight">Games</span>
          </button>

          {/* Categories */}
          <button
            onClick={() => handleNavigate('categories')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer ${
              currentView === 'categories'
                ? 'text-brand font-bold'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${currentView === 'categories' ? 'bg-surface-brand text-brand' : ''}`}>
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-[10px] mt-0.5 leading-tight">Genres</span>
          </button>

          {/* Deals */}
          <button
            onClick={() => handleNavigate('deals')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer ${
              currentView === 'deals'
                ? 'text-accent font-bold'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${currentView === 'deals' ? 'bg-accent/15 text-accent' : ''}`}>
              <Percent className="w-4 h-4" />
            </div>
            <span className="text-[10px] mt-0.5 leading-tight">Deals</span>
          </button>

          {/* Wishlist */}
          <button
            onClick={() => setIsWishlistOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-1 rounded-xl text-text-muted hover:text-text-main transition-all cursor-pointer relative"
          >
            <div className="p-1 rounded-lg relative">
              <Heart className="w-4 h-4 text-accent" />
              {(wishlistedGameIds.length + bookmarkedArticleIds.length) > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-brand text-white text-[8px] font-black flex items-center justify-center shadow-xs">
                  {wishlistedGameIds.length + bookmarkedArticleIds.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 leading-tight">Shelf</span>
          </button>

          {/* Profile */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-1 rounded-xl text-text-muted hover:text-text-main transition-all cursor-pointer"
          >
            <div className="p-1 rounded-lg">
              <User className="w-4 h-4 text-brand" />
            </div>
            <span className="text-[10px] mt-0.5 leading-tight">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
