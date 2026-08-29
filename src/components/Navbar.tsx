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
  Heart
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
  const [openDropdown, setOpenDropdown] = useState<GameCategory | null>(null);
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navRef = useRef<HTMLDivElement>(null);
  const audioMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const safeProfile = userProfile || DEFAULT_USER_PROFILE;
  const unreadNotifCount = (notifications || []).filter((n) => !n.isRead).length;
  const avatarObj = AVATAR_OPTIONS.find((a) => a.id === safeProfile?.avatarIcon) || AVATAR_OPTIONS[0];

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
    <header ref={navRef} className="sticky top-0 z-40 bg-[#FDFBF7]/95 backdrop-blur-md text-[#4A4A40] border-b border-[#E6E2D3] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-6 xl:gap-8">
            <button
              id="navbar-brand-btn"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-3 text-left group cursor-pointer shrink-0"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#8BA888] flex items-center justify-center text-white font-bold text-xl shadow-xs group-hover:scale-105 transition-transform">
                🌱
              </div>
              <div>
                <div className="font-serif-natural text-lg sm:text-xl font-normal text-[#5A5A40] tracking-tight leading-none group-hover:text-[#8BA888] transition-colors">
                  Cozy & Indie Dispatch
                </div>
                <div className="text-[10px] text-[#8BA888] font-bold uppercase tracking-wider mt-0.5">
                  PC & Steam Deck Gaming
                </div>
              </div>
            </button>

            {/* Desktop Navigation Dropdowns */}
            <nav className="hidden lg:flex items-center gap-1">
              {CATEGORIES.map((category) => {
                const Icon = category.icon;
                const isOpen = openDropdown === category.id;
                const isSelected = selectedCategory === category.id && currentView !== 'home' && currentView !== 'deals';

                return (
                  <div key={category.id} className="relative">
                    <button
                      id={`nav-category-${category.id}-btn`}
                      onClick={() => setOpenDropdown(isOpen ? null : category.id)}
                      className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#EBF0EA] text-[#5A5A40] border border-[#8BA888]/40'
                          : 'text-[#707060] hover:text-[#4A4A40] hover:bg-[#F5F5F0]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-[#8BA888]' : 'text-[#707060]'}`} />
                      <span>{category.name}</span>
                      {category.badge && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full bg-[#F5F5F0] text-[#707060] border border-[#E6E2D3]">
                          {category.badge}
                        </span>
                      )}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#8BA888]' : 'text-[#A0A090]'}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isOpen && (
                      <div className="absolute top-full left-0 mt-2 w-72 bg-[#FDFBF7] border border-[#E6E2D3] rounded-2xl shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-3 py-2 border-b border-[#E6E2D3] mb-2">
                          <div className="flex items-center gap-2 font-bold text-xs text-[#5A5A40] uppercase tracking-wider">
                            <Icon className="w-3.5 h-3.5 text-[#8BA888]" />
                            <span>{category.name} PC Section</span>
                          </div>
                          <p className="text-[11px] text-[#707060] mt-1 leading-snug">
                            {category.description}
                          </p>
                        </div>

                        {/* Dropdown Links */}
                        <div className="space-y-1">
                          <button
                            id={`dropdown-${category.id}-browser-btn`}
                            onClick={() => {
                              onNavigate('browser', category.id);
                              setOpenDropdown(null);
                            }}
                            className="w-full text-left p-2.5 rounded-xl hover:bg-[#F5F5F0] transition-colors flex items-center justify-between group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-[#EBF0EA] text-[#5A5A40] flex items-center justify-center group-hover:bg-[#8BA888] group-hover:text-white transition-colors">
                                <Gamepad2 className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-[#4A4A40] group-hover:text-[#8BA888]">
                                  {category.name} Game Browser
                                </div>
                                <div className="text-[10px] text-[#707060]">
                                  Filter new, popular, hidden gems
                                </div>
                              </div>
                            </div>
                            <span className="text-[#A0A090] text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                          </button>

                          <button
                            id={`dropdown-${category.id}-news-btn`}
                            onClick={() => {
                              onNavigate('news', category.id);
                              setOpenDropdown(null);
                            }}
                            className="w-full text-left p-2.5 rounded-xl hover:bg-[#F5F5F0] transition-colors flex items-center justify-between group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-[#F5F5F0] text-[#707060] flex items-center justify-center group-hover:bg-[#8BA888] group-hover:text-white transition-colors">
                                <Newspaper className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-[#4A4A40] group-hover:text-[#8BA888]">
                                  {category.name} News & Updates
                                </div>
                                <div className="text-[10px] text-[#707060]">
                                  IGN, Eurogamer & Steam patch notes
                                </div>
                              </div>
                            </div>
                            <span className="text-[#A0A090] text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Direct Navigation Links */}
              <button
                id="nav-browser-btn"
                onClick={() => onNavigate('browser', 'all')}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentView === 'browser'
                    ? 'bg-[#8BA888] text-white shadow-xs'
                    : 'text-[#707060] hover:text-[#4A4A40] hover:bg-[#F5F5F0]'
                }`}
              >
                <Gamepad2 className="w-4 h-4 text-[#8BA888]" />
                <span>All Games</span>
              </button>

              <button
                id="nav-categories-btn"
                onClick={() => onNavigate('categories')}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentView === 'categories'
                    ? 'bg-[#8BA888] text-white shadow-xs'
                    : 'text-[#707060] hover:text-[#4A4A40] hover:bg-[#F5F5F0]'
                }`}
              >
                <Layers className="w-4 h-4 text-[#8BA888]" />
                <span>Categories</span>
              </button>

              <button
                id="nav-catalogs-btn"
                onClick={() => onNavigate('catalogs')}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentView === 'catalogs'
                    ? 'bg-[#2C2C24] text-white shadow-xs'
                    : 'text-[#707060] hover:text-[#4A4A40] hover:bg-[#F5F5F0]'
                }`}
              >
                <Compass className="w-4 h-4 text-[#8BA888]" />
                <span>Showcases & Catalogs</span>
                <span className="bg-[#8BA888] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                  Wholesome & Fellow
                </span>
              </button>

              <button
                id="nav-deals-btn"
                onClick={() => onNavigate('deals')}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentView === 'deals'
                    ? 'bg-[#E6A07D] text-white shadow-xs'
                    : 'text-[#707060] hover:text-[#E6A07D] hover:bg-[#F5F5F0]'
                }`}
              >
                <Percent className="w-4 h-4 text-[#E6A07D]" />
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
              className="px-3 py-2 rounded-xl bg-[#8BA888] hover:bg-[#7A9977] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Discovery Quiz</span>
            </button>

            {/* Search Button */}
            <button
              id="navbar-search-btn"
              onClick={onOpenSearch}
              className="p-2.5 rounded-xl bg-[#F5F5F0] hover:bg-[#E6E2D3] text-[#707060] hover:text-[#4A4A40] transition-all flex items-center gap-2 border border-[#E6E2D3] cursor-pointer"
              title="Search PC games & articles"
            >
              <Search className="w-4 h-4 text-[#8BA888]" />
              <span className="text-xs font-semibold hidden xl:inline">Search</span>
            </button>

            {/* Ambient Soundscapes Controls */}
            <div ref={audioMenuRef} className="relative hidden md:block">
              <button
                id="navbar-soundscapes-btn"
                onClick={() => setIsAudioMenuOpen(!isAudioMenuOpen)}
                className={`p-2.5 rounded-xl transition-all border flex items-center gap-1.5 cursor-pointer ${
                  isPlayingAudio
                    ? 'bg-[#8BA888] text-white border-[#8BA888] shadow-xs'
                    : 'bg-[#F5F5F0] text-[#707060] border-[#E6E2D3] hover:text-[#4A4A40] hover:bg-[#E6E2D3]'
                }`}
                title="Procedural Lo-fi Ambience"
              >
                {isPlayingAudio ? (
                  <Volume2 className="w-4 h-4 text-white animate-pulse" />
                ) : (
                  <VolumeX className="w-4 h-4 text-[#707060]" />
                )}
              </button>

              {/* Audio Controls Popover */}
              {isAudioMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#FDFBF7] border border-[#E6E2D3] rounded-2xl shadow-xl p-4 z-50 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-[#E6E2D3] pb-2">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-[#8BA888]" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[#5A5A40]">
                        Procedural Ambience
                      </span>
                    </div>
                    <button
                      onClick={onToggleAudio}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        isPlayingAudio
                          ? 'bg-[#E6A07D]/20 text-[#5A5A40] border border-[#E6A07D]/40'
                          : 'bg-[#8BA888] text-white'
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
                            ? 'bg-[#EBF0EA] text-[#5A5A40] border border-[#8BA888]/40'
                            : 'bg-[#F5F5F0] hover:bg-[#E6E2D3] text-[#707060]'
                        }`}
                      >
                        {track.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1 pt-1 border-t border-[#E6E2D3]">
                    <div className="flex items-center justify-between text-[10px] text-[#707060] font-bold uppercase">
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
                className="p-2.5 rounded-xl bg-[#F5F5F0] hover:bg-[#E6E2D3] text-[#707060] hover:text-[#4A4A40] transition-all flex items-center border border-[#E6E2D3] cursor-pointer relative"
                title="Notifications & Price Alerts"
              >
                <Bell className="w-4 h-4 text-[#8BA888]" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#E6A07D] text-white text-[9px] font-black flex items-center justify-center shadow-xs">
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
              className="p-2.5 rounded-xl bg-[#F5F5F0] hover:bg-[#E6E2D3] text-[#707060] hover:text-[#4A4A40] transition-all flex items-center gap-1.5 border border-[#E6E2D3] cursor-pointer relative"
              title="My Cozy PC Wishlist & Shelf"
            >
              <Heart className="w-4 h-4 text-[#E6A07D]" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#8BA888] text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* User Profile Button */}
            <button
              id="navbar-profile-btn"
              onClick={onOpenProfile}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-[#EBF0EA] hover:bg-[#8BA888] text-[#5A5A40] hover:text-white border border-[#8BA888]/40 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
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
              className="p-2.5 rounded-xl bg-[#F5F5F0] text-[#707060] hover:text-[#4A4A40] border border-[#E6E2D3] lg:hidden cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Collapsible Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E6E2D3] bg-[#FDFBF7] p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Quick Direct Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onNavigate('categories');
                setIsMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-[#8BA888] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Categories</span>
            </button>

            <button
              onClick={() => {
                onNavigate('catalogs');
                setIsMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-[#2C2C24] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Showcases & Catalogs</span>
            </button>

            <button
              onClick={() => {
                onNavigate('deals');
                setIsMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-[#E6A07D] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Deals & Sales</span>
            </button>

            <button
              onClick={() => {
                onOpenQuiz();
                setIsMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-[#8BA888] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Discovery Quiz</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#5A5A40]">
              Select PC Category
            </div>
            {CATEGORIES.map((cat) => (
              <div key={cat.id} className="bg-[#F5F5F0] p-3 rounded-2xl border border-[#E6E2D3] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-[#4A4A40]">
                    <cat.icon className="w-4 h-4 text-[#8BA888]" />
                    <span>{cat.name}</span>
                  </div>
                  {cat.badge && (
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-white text-[#707060] border border-[#E6E2D3]">
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
                    className="p-2 rounded-xl bg-white border border-[#E6E2D3] text-xs font-bold text-[#4A4A40] hover:text-[#8BA888] text-center cursor-pointer"
                  >
                    🎮 Game Browser
                  </button>
                  <button
                    onClick={() => {
                      onNavigate('news', cat.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className="p-2 rounded-xl bg-white border border-[#E6E2D3] text-xs font-bold text-[#4A4A40] hover:text-[#8BA888] text-center cursor-pointer"
                  >
                    📰 News & Updates
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#E6E2D3] flex items-center justify-between">
            <button
              onClick={() => {
                onNavigate('home');
                setIsMobileMenuOpen(false);
              }}
              className="text-xs font-bold text-[#8BA888]"
            >
              Weekly Top 5 Spotlight
            </button>

            <button
              onClick={() => {
                onOpenProfile();
                setIsMobileMenuOpen(false);
              }}
              className="text-xs font-bold text-[#5A5A40]"
            >
              Profile & Wishlist ({wishlistCount})
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
