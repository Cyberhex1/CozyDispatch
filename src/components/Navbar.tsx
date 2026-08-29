import React, { useState, useRef, useEffect } from 'react';
import { GameCategory, UserProfile } from '../types';
import { AVATAR_OPTIONS, DEFAULT_USER_PROFILE } from '../data/userState';
import { 
  Coffee, 
  Sparkles, 
  Gamepad2, 
  Tv, 
  Newspaper, 
  ChevronDown, 
  Search, 
  Compass, 
  Layers, 
  Menu, 
  X,
  Percent,
  User,
  Heart,
  Sun,
  Moon,
  Home,
  Check
} from 'lucide-react';

interface NavbarProps {
  currentView: 'home' | 'browser' | 'categories' | 'catalogs' | 'news' | 'deals';
  selectedCategory: GameCategory | 'all';
  onNavigate: (view: 'home' | 'browser' | 'categories' | 'catalogs' | 'news' | 'deals', category?: GameCategory) => void;
  onOpenSearch: () => void;
  onOpenMoodMatcher: () => void;
  onOpenWishlist: () => void;
  onOpenQuiz?: () => void;
  onOpenProfile: () => void;
  wishlistCount: number;
  userProfile: UserProfile;
  notifications?: any[];
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onClearNotifications?: () => void;
  onSelectGameById?: (gameId: string) => void;
  isPlayingAudio?: boolean;
  activeSoundtrack?: any;
  onToggleAudio?: () => void;
  onChangeSoundtrack?: (track: any) => void;
  audioVolume?: number;
  onVolumeChange?: (vol: number) => void;
}

interface NavCategoryConfig {
  id: GameCategory;
  name: string;
  icon: typeof Coffee;
  description: string;
  badge?: string;
  popularTag: string;
}

const CATEGORIES: NavCategoryConfig[] = [
  {
    id: 'cozy',
    name: 'Cozy',
    icon: Coffee,
    description: 'Farming, cottagecore, wholesome town life & gentle crafting on PC',
    badge: 'Trending',
    popularTag: 'Farming Sim'
  },
  {
    id: 'indie',
    name: 'Indie',
    icon: Sparkles,
    description: 'Inventive art, roguelikes, poignant stories & original PC mechanics',
    badge: 'Hot',
    popularTag: 'Roguelike'
  },
  {
    id: 'simulation',
    name: 'Simulation',
    icon: Layers,
    description: 'Tactile builders, idle desktop companions & organic sandboxes',
    popularTag: 'Gridless Builder'
  },
  {
    id: 'steam-deck',
    name: 'Steam Deck',
    icon: Tv,
    description: 'Handheld PC gems, 60 FPS verified titles & low battery draw',
    badge: 'Verified',
    popularTag: 'OLED Ready'
  }
];

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  selectedCategory,
  onNavigate,
  onOpenSearch,
  onOpenMoodMatcher,
  onOpenWishlist,
  onOpenProfile,
  wishlistCount,
  userProfile
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem('cozy_theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });
  
  const navRef = useRef<HTMLDivElement>(null);
  const safeProfile = userProfile || DEFAULT_USER_PROFILE;
  const avatarObj = AVATAR_OPTIONS.find((a) => a.id === safeProfile?.avatarIcon) || AVATAR_OPTIONS[0];

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('cozy_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('cozy_theme', 'light');
    }
  }, [isDarkMode]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header ref={navRef} className="sticky top-0 z-40 bg-base/95 backdrop-blur-md text-text-main border-b border-border shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 lg:h-20">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2 sm:gap-6 xl:gap-8 min-w-0">
            <button
              id="navbar-brand-btn"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 sm:gap-3 text-left group cursor-pointer shrink-0 min-h-[44px] touch-manipulation"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0 p-1">
                <img src="/favicon.svg" alt="Cute Blue Teddy Bear" className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
              </div>
              <div className="min-w-0">
                <div className="font-serif-natural text-sm sm:text-lg lg:text-xl font-normal text-text-heading tracking-tight leading-none group-hover:text-brand transition-colors truncate">
                  Cozy & Indie Dispatch
                </div>
                <div className="text-[8px] sm:text-[10px] text-brand font-bold uppercase tracking-wider mt-0.5 truncate hidden xs:block">
                  PC & Steam Deck Gaming
                </div>
              </div>
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1">
              <button
                id="nav-browser-btn"
                onClick={() => onNavigate('browser', 'all')}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentView === 'browser'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface'
                }`}
              >
                <Gamepad2 className="w-4 h-4 text-brand" />
                <span>All Games</span>
              </button>

              {/* Categories Dropdown */}
              <div className="relative">
                <button
                  id="nav-categories-btn"
                  onClick={() => setOpenDropdown(openDropdown === 'categories' ? null : 'categories')}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentView === 'categories' || openDropdown === 'categories'
                      ? 'bg-surface-brand text-text-heading border border-brand/40'
                      : 'text-text-muted hover:text-text-main hover:bg-surface'
                  }`}
                >
                  <Layers className={`w-4 h-4 ${currentView === 'categories' || openDropdown === 'categories' ? 'text-brand' : 'text-text-muted'}`} />
                  <span>Categories</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === 'categories' ? 'rotate-180 text-brand' : 'text-text-faint'}`} />
                </button>

                {openDropdown === 'categories' && (
                  <div className="absolute top-full left-0 mt-2 w-80 bg-base border border-border rounded-2xl shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 border-b border-border mb-2 flex items-center justify-between">
                      <div className="text-xs font-bold text-text-heading uppercase tracking-wider">
                        Browse by Genre
                      </div>
                      <Layers className="w-3.5 h-3.5 text-brand" />
                    </div>
                    
                    <div className="grid grid-cols-1 gap-1">
                      {CATEGORIES.map((category) => {
                        const Icon = category.icon;
                        return (
                          <button
                            key={category.id}
                            id={`dropdown-${category.id}-browser-btn`}
                            onClick={() => {
                              onNavigate('browser', category.id);
                              setOpenDropdown(null);
                            }}
                            className="w-full text-left p-2.5 rounded-xl hover:bg-surface transition-colors flex items-center justify-between group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-surface-brand text-text-heading flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-colors">
                                <Icon className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-bold text-text-main group-hover:text-brand">
                                    {category.name}
                                  </div>
                                  {category.badge && (
                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-base text-text-muted border border-border">
                                      {category.badge}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-text-muted leading-snug mt-0.5 line-clamp-1">
                                  {category.description}
                                </div>
                              </div>
                            </div>
                            <span className="text-text-faint text-sm group-hover:translate-x-0.5 transition-transform">→</span>
                          </button>
                        );
                      })}
                    </div>
                    
                    <div className="mt-2 pt-2 border-t border-border">
                       <button 
                         onClick={() => {
                           onNavigate('categories');
                           setOpenDropdown(null);
                         }}
                         className="w-full text-center p-2 rounded-lg bg-surface text-xs font-bold text-text-muted hover:text-text-main hover:bg-border transition-colors cursor-pointer"
                       >
                         View All Category Overviews
                       </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                id="nav-catalogs-btn"
                onClick={() => onNavigate('catalogs')}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentView === 'catalogs'
                    ? 'bg-inverse text-text-on-inverse shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface'
                }`}
              >
                <Compass className="w-4 h-4 text-brand" />
                <span>Showcases</span>
              </button>

              <button
                id="nav-deals-btn"
                onClick={() => onNavigate('deals')}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentView === 'deals'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-muted hover:text-accent hover:bg-surface'
                }`}
              >
                <Percent className="w-4 h-4 text-accent" />
                <span>Deals</span>
              </button>

              <button
                id="nav-news-btn"
                onClick={() => onNavigate('news')}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentView === 'news'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface'
                }`}
              >
                <Newspaper className="w-4 h-4 text-brand" />
                <span>News & Patches</span>
              </button>
            </nav>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 sm:p-2.5 rounded-xl bg-surface hover:bg-border text-text-muted hover:text-text-main transition-all flex items-center border border-border cursor-pointer min-w-[38px] min-h-[38px] justify-center touch-manipulation"
              title="Toggle Dark / Light Theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-accent" /> : <Moon className="w-4 h-4 text-brand" />}
            </button>

            {/* Search Button */}
            <button
              id="navbar-search-btn"
              onClick={onOpenSearch}
              className="p-2 sm:p-2.5 rounded-xl bg-surface hover:bg-border text-text-muted hover:text-text-main transition-all flex items-center gap-1.5 border border-border cursor-pointer min-w-[38px] min-h-[38px] justify-center touch-manipulation"
              title="Search cozy games, articles & tags"
            >
              <Search className="w-4 h-4 text-brand" />
              <span className="text-xs font-semibold hidden xl:inline">Search</span>
            </button>

            {/* Wishlist Shelf Drawer Button */}
            <button
              id="navbar-wishlist-btn"
              onClick={onOpenWishlist}
              className="p-2 sm:p-2.5 rounded-xl bg-surface hover:bg-border text-text-muted hover:text-text-main transition-all flex items-center gap-1.5 border border-border cursor-pointer relative min-w-[38px] min-h-[38px] justify-center touch-manipulation"
              title="My Saved Games & Wishlist"
            >
              <Heart className="w-4 h-4 text-accent" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-brand text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* User Profile Button */}
            <button
              id="navbar-profile-btn"
              onClick={onOpenProfile}
              className="p-1 sm:px-3 sm:py-1.5 rounded-xl bg-surface-brand hover:bg-brand text-text-heading hover:text-white border border-brand/40 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shadow-xs min-h-[38px] touch-manipulation"
              title="User Account & Cloud Sync"
            >
              <span className="text-base">{avatarObj.emoji}</span>
              <span className="text-xs font-bold hidden md:inline truncate max-w-[110px]">
                {safeProfile?.username || 'Cozy Gamer'}
              </span>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 sm:p-2.5 rounded-xl bg-surface text-text-muted hover:text-text-main border border-border lg:hidden cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center touch-manipulation"
              title="Menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Collapsible Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-base p-4 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
          
          {/* Quick Primary View Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onNavigate('home');
                setIsMobileMenuOpen(false);
              }}
              className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer min-h-[44px] touch-manipulation ${
                currentView === 'home' ? 'bg-brand text-white' : 'bg-surface border border-border text-text-main'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Home Spotlight</span>
            </button>

            <button
              onClick={() => {
                onNavigate('browser', 'all');
                setIsMobileMenuOpen(false);
              }}
              className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer min-h-[44px] touch-manipulation ${
                currentView === 'browser' ? 'bg-brand text-white' : 'bg-surface border border-border text-text-main'
              }`}
            >
              <Gamepad2 className="w-4 h-4 text-brand" />
              <span>All Games</span>
            </button>

            <button
              onClick={() => {
                onNavigate('categories');
                setIsMobileMenuOpen(false);
              }}
              className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer min-h-[44px] touch-manipulation ${
                currentView === 'categories' ? 'bg-brand text-white' : 'bg-surface border border-border text-text-main'
              }`}
            >
              <Layers className="w-4 h-4 text-brand" />
              <span>Categories</span>
            </button>

            <button
              onClick={() => {
                onNavigate('catalogs');
                setIsMobileMenuOpen(false);
              }}
              className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer min-h-[44px] touch-manipulation ${
                currentView === 'catalogs' ? 'bg-inverse text-text-on-inverse' : 'bg-surface border border-border text-text-main'
              }`}
            >
              <Compass className="w-4 h-4 text-brand" />
              <span>Showcases</span>
            </button>

            <button
              onClick={() => {
                onNavigate('deals');
                setIsMobileMenuOpen(false);
              }}
              className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer min-h-[44px] touch-manipulation ${
                currentView === 'deals' ? 'bg-accent text-white' : 'bg-surface border border-border text-text-main'
              }`}
            >
              <Percent className="w-4 h-4 text-accent" />
              <span>Deals & Sales</span>
            </button>

            <button
              onClick={() => {
                onNavigate('news');
                setIsMobileMenuOpen(false);
              }}
              className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer min-h-[44px] touch-manipulation ${
                currentView === 'news' ? 'bg-brand text-white' : 'bg-surface border border-border text-text-main'
              }`}
            >
              <Newspaper className="w-4 h-4 text-brand" />
              <span>News & Patches</span>
            </button>

            <button
              onClick={() => {
                onOpenMoodMatcher();
                setIsMobileMenuOpen(false);
              }}
              className="col-span-2 p-3 rounded-xl bg-surface border border-border text-text-heading text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer min-h-[44px] touch-manipulation"
            >
              <span>☕ Mood Matcher & Quiz</span>
            </button>
          </div>

          {/* Sub-Genre Quick Jump */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-text-heading">
              Browse Sub-Genres
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    onNavigate('browser', cat.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className="p-3 rounded-xl bg-surface border border-border text-xs font-bold text-text-main hover:text-brand flex items-center gap-2 cursor-pointer min-h-[44px] touch-manipulation"
                >
                  <cat.icon className="w-4 h-4 text-brand shrink-0" />
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Account & Shelf Shortcuts */}
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <button
              onClick={() => {
                onOpenWishlist();
                setIsMobileMenuOpen(false);
              }}
              className="text-xs font-bold text-accent flex items-center gap-1.5 min-h-[44px] px-2 touch-manipulation"
            >
              <Heart className="w-4 h-4 fill-accent" />
              <span>My Wishlist ({wishlistCount})</span>
            </button>

            <button
              onClick={() => {
                onOpenProfile();
                setIsMobileMenuOpen(false);
              }}
              className="text-xs font-bold text-text-heading flex items-center gap-1.5 min-h-[44px] px-2 touch-manipulation"
            >
              <span>{avatarObj.emoji} {safeProfile?.username || 'Profile & Sync'}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
