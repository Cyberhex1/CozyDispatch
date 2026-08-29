import React, { useState, useRef, useEffect } from 'react';
import { GameCategory, SoundscapeTrack, UserProfile, NotificationAlert } from '../types';
import { NotificationsPopover } from './NotificationsPopover';
import { AVATAR_OPTIONS, DEFAULT_USER_PROFILE } from '../data/userState';
import { 
  Coffee, 
  Sparkles, 
  Gamepad2, 
  Tv, 
  Newspaper, 
  ChevronDown, 
  Search, 
  Bookmark, 
  Volume2, 
  VolumeX, 
  HeartHandshake, 
  Compass, 
  Flame, 
  Star, 
  Gem, 
  Layers, 
  Menu, 
  X,
  Play,
  Square,
  Percent,
  Bell,
  User,
  Heart,
  Sun,
  Moon
} from 'lucide-react';

interface NavbarProps {
  currentView: 'home' | 'browser' | 'categories' | 'catalogs' | 'news' | 'deals';
  selectedCategory: GameCategory | 'all';
  onNavigate: (view: 'home' | 'browser' | 'categories' | 'catalogs' | 'news' | 'deals', category?: GameCategory) => void;
  onOpenSearch: () => void;
  onOpenMoodMatcher: () => void;
  onOpenWishlist: () => void;
  onOpenQuiz: () => void;
  onOpenProfile: () => void;
  wishlistCount: number;
  userProfile: UserProfile;
  notifications: NotificationAlert[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onClearNotifications: () => void;
  onSelectGameById?: (gameId: string) => void;
  isPlayingAudio: boolean;
  activeSoundtrack: SoundscapeTrack;
  onToggleAudio: () => void;
  onChangeSoundtrack: (track: SoundscapeTrack) => void;
  audioVolume: number;
  onVolumeChange: (vol: number) => void;
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
  onOpenQuiz,
  onOpenProfile,
  wishlistCount,
  userProfile,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onClearNotifications,
  onSelectGameById,
  isPlayingAudio,
  activeSoundtrack,
  onToggleAudio,
  onChangeSoundtrack,
  audioVolume,
  onVolumeChange
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
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
  const audioMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const safeProfile = userProfile || DEFAULT_USER_PROFILE;
  const unreadNotifCount = (notifications || []).filter((n) => !n.isRead).length;
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
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target as Node)) {
        setIsAudioMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header ref={navRef} className="sticky top-0 z-40 bg-base/95 backdrop-blur-md text-text-main border-b border-border shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-6 xl:gap-8">
            <button
              id="navbar-brand-btn"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-3 text-left group cursor-pointer shrink-0"
            >
              <div className="w-10 h-10 rounded-2xl bg-brand flex items-center justify-center text-white font-bold text-xl shadow-xs group-hover:scale-105 transition-transform">
                🌱
              </div>
              <div>
                <div className="font-serif-natural text-lg sm:text-xl font-normal text-text-heading tracking-tight leading-none group-hover:text-brand transition-colors">
                  Cozy & Indie Dispatch
                </div>
                <div className="text-[10px] text-brand font-bold uppercase tracking-wider mt-0.5">
                  PC & Steam Deck Gaming
                </div>
              </div>
            </button>

            {/* Desktop Navigation Dropdowns */}
            <nav className="hidden lg:flex items-center gap-1">
              {/* Direct Navigation Links */}
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

              {/* Categories Mega Menu */}
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
                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-white text-text-muted border border-border">
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
                    ? 'bg-inverse text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface'
                }`}
              >
                <Compass className="w-4 h-4 text-brand" />
                <span>Showcases & Catalogs</span>
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
            </nav>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Discovery Quiz Button */}
            <button
              id="navbar-quiz-btn"
              onClick={onOpenQuiz}
              className="px-3 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Discovery Quiz</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-xl bg-surface hover:bg-border text-text-muted hover:text-text-main transition-all flex items-center border border-border cursor-pointer"
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-accent" /> : <Moon className="w-4 h-4 text-brand" />}
            </button>

            {/* Search Button */}
            <button
              id="navbar-search-btn"
              onClick={onOpenSearch}
              className="p-2.5 rounded-xl bg-surface hover:bg-border text-text-muted hover:text-text-main transition-all flex items-center gap-2 border border-border cursor-pointer"
              title="Search PC games & articles"
            >
              <Search className="w-4 h-4 text-brand" />
              <span className="text-xs font-semibold hidden xl:inline">Search</span>
            </button>

            {/* Ambient Soundscapes Controls */}
            <div ref={audioMenuRef} className="relative hidden md:block">
              <button
                id="navbar-soundscapes-btn"
                onClick={() => setIsAudioMenuOpen(!isAudioMenuOpen)}
                className={`p-2.5 rounded-xl transition-all border flex items-center gap-1.5 cursor-pointer ${
                  isPlayingAudio
                    ? 'bg-brand text-white border-brand shadow-xs'
                    : 'bg-surface text-text-muted border-border hover:text-text-main hover:bg-border'
                }`}
                title="Procedural Lo-fi Ambience"
              >
                {isPlayingAudio ? (
                  <Volume2 className="w-4 h-4 text-white animate-pulse" />
                ) : (
                  <VolumeX className="w-4 h-4 text-text-muted" />
                )}
              </button>

              {/* Audio Controls Popover */}
              {isAudioMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-base border border-border rounded-2xl shadow-xl p-4 z-50 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-brand" />
                      <span className="text-xs font-bold uppercase tracking-wider text-text-heading">
                        Procedural Ambience
                      </span>
                    </div>
                    <button
                      onClick={onToggleAudio}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        isPlayingAudio
                          ? 'bg-accent/20 text-text-heading border border-[#E6A07D]/40'
                          : 'bg-brand text-white'
                      }`}
                    >
                      {isPlayingAudio ? 'Mute' : 'Play'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'rain', label: '🌧️ Gentle Rain' },
                      { id: 'campfire', label: '🪵 Campfire' },
                      { id: 'forest', label: '🌲 Forest Breeze' },
                      { id: 'cafe', label: '☕ Lo-Fi Cafe' }
                    ].map((track) => (
                      <button
                        key={track.id}
                        onClick={() => onChangeSoundtrack(track.id as SoundscapeTrack)}
                        className={`p-2 rounded-xl text-left text-xs font-semibold transition-all cursor-pointer ${
                          activeSoundtrack === track.id && isPlayingAudio
                            ? 'bg-surface-brand text-text-heading border border-brand/40'
                            : 'bg-surface hover:bg-border text-text-muted'
                        }`}
                      >
                        {track.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1 pt-1 border-t border-border">
                    <div className="flex items-center justify-between text-[10px] text-text-muted font-bold uppercase">
                      <span>Ambience Volume</span>
                      <span>{Math.round(audioVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={audioVolume}
                      onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-[#E6E2D3] rounded-lg appearance-none cursor-pointer accent-[#8BA888]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notifications Popover Toggle */}
            <div ref={notifRef} className="relative">
              <button
                id="navbar-notifications-btn"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2.5 rounded-xl bg-surface hover:bg-border text-text-muted hover:text-text-main transition-all flex items-center border border-border cursor-pointer relative"
                title="Notifications & Price Alerts"
              >
                <Bell className="w-4 h-4 text-brand" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-accent text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              <NotificationsPopover
                isOpen={isNotificationsOpen}
                onClose={() => setIsNotificationsOpen(false)}
                notifications={notifications}
                onMarkAsRead={onMarkNotificationRead}
                onMarkAllAsRead={onMarkAllNotificationsRead}
                onClearAll={onClearNotifications}
                onSelectGameById={onSelectGameById}
              />
            </div>

            {/* Wishlist Shelf Drawer Button */}
            <button
              id="navbar-wishlist-btn"
              onClick={onOpenWishlist}
              className="p-2.5 rounded-xl bg-surface hover:bg-border text-text-muted hover:text-text-main transition-all flex items-center gap-1.5 border border-border cursor-pointer relative"
              title="My Cozy PC Wishlist & Shelf"
            >
              <Heart className="w-4 h-4 text-accent" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-brand text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* User Profile Button */}
            <button
              id="navbar-profile-btn"
              onClick={onOpenProfile}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-surface-brand hover:bg-brand text-text-heading hover:text-white border border-brand/40 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              title="User Profile & Settings"
            >
              <span className="text-base">{avatarObj.emoji}</span>
              <span className="text-xs font-bold hidden md:inline truncate max-w-[100px]">
                {safeProfile?.username || 'Cozy Gamer'}
              </span>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2.5 rounded-xl bg-surface text-text-muted hover:text-text-main border border-border lg:hidden cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Collapsible Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-base p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Quick Direct Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onNavigate('categories');
                setIsMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-brand text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Categories</span>
            </button>

            <button
              onClick={() => {
                onNavigate('catalogs');
                setIsMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-inverse text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Showcases & Catalogs</span>
            </button>

            <button
              onClick={() => {
                onNavigate('deals');
                setIsMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-accent text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Deals & Sales</span>
            </button>

            <button
              onClick={() => {
                onOpenQuiz();
                setIsMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-brand text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Discovery Quiz</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-text-heading">
              Select PC Category
            </div>
            {CATEGORIES.map((cat) => (
              <div key={cat.id} className="bg-surface p-3 rounded-2xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-text-main">
                    <cat.icon className="w-4 h-4 text-brand" />
                    <span>{cat.name}</span>
                  </div>
                  {cat.badge && (
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-white text-text-muted border border-border">
                      {cat.badge}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      onNavigate('browser', cat.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className="p-2 rounded-xl bg-white border border-border text-xs font-bold text-text-main hover:text-brand text-center cursor-pointer"
                  >
                    🎮 Game Browser
                  </button>
                  <button
                    onClick={() => {
                      onNavigate('news', cat.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className="p-2 rounded-xl bg-white border border-border text-xs font-bold text-text-main hover:text-brand text-center cursor-pointer"
                  >
                    📰 News & Updates
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between">
            <button
              onClick={() => {
                onNavigate('home');
                setIsMobileMenuOpen(false);
              }}
              className="text-xs font-bold text-brand"
            >
              Weekly Top 5 Spotlight
            </button>

            <button
              onClick={() => {
                onOpenProfile();
                setIsMobileMenuOpen(false);
              }}
              className="text-xs font-bold text-text-heading"
            >
              Profile & Wishlist ({wishlistCount})
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
