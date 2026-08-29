import React, { useState } from 'react';
import { UserProfile, Game, WishlistItem, NotificationAlert } from '../types';
import { AVATAR_OPTIONS, DEFAULT_USER_PROFILE } from '../data/userState';
import { 
  User, 
  Heart, 
  Settings, 
  Bell, 
  Tv, 
  Tag, 
  Sparkles, 
  Check, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  X, 
  ShieldCheck, 
  LogOut, 
  LogIn,
  Sliders,
  DollarSign,
  TrendingDown
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile?: UserProfile;
  profile?: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  wishlistGames?: Game[];
  wishlistItems?: WishlistItem[];
  onRemoveWishlist?: (gameId: string) => void;
  onUpdateWishlistItem?: (gameId: string, updates: Partial<WishlistItem>) => void;
  onRemoveWishlistItem?: (gameId: string) => void;
  allGames?: Game[];
  onSelectGame: (game: Game) => void;
  notifications?: NotificationAlert[];
  onMarkNotificationRead?: (id: string) => void;
  onClearNotifications?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  profile,
  onUpdateProfile,
  wishlistGames = [],
  wishlistItems = [],
  onRemoveWishlist,
  onUpdateWishlistItem,
  onRemoveWishlistItem,
  allGames = [],
  onSelectGame
}) => {
  const currentProfile: UserProfile = userProfile || profile || DEFAULT_USER_PROFILE;
  const preferences = currentProfile.preferences || DEFAULT_USER_PROFILE.preferences;

  const [activeTab, setActiveTab] = useState<'profile' | 'wishlist' | 'preferences' | 'auth'>('profile');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedName, setEditedName] = useState(currentProfile.username || 'Cozy Gamer');
  const [editedTag, setEditedTag] = useState(currentProfile.gamerTag || 'Cozy#1000');
  const [editedBio, setEditedBio] = useState(currentProfile.bio || '');
  const [editedVibe, setEditedVibe] = useState(currentProfile.favoriteVibe || '');
  const [selectedAvatar, setSelectedAvatar] = useState(currentProfile.avatarIcon || 'sprout');

  // Auth simulation state
  const [authMode, setAuthMode] = useState<'logged_in' | 'login' | 'signup'>('logged_in');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');

  if (!isOpen) return null;

  const currentAvatarObj = AVATAR_OPTIONS.find((a) => a.id === selectedAvatar) || AVATAR_OPTIONS[0];

  const handleSaveProfileDetails = () => {
    onUpdateProfile({
      ...currentProfile,
      username: editedName,
      gamerTag: editedTag,
      bio: editedBio,
      favoriteVibe: editedVibe,
      avatarIcon: selectedAvatar
    });
    setIsEditingBio(false);
  };

  const handleTogglePreference = (key: keyof UserProfile['preferences']) => {
    onUpdateProfile({
      ...currentProfile,
      preferences: {
        ...preferences,
        [key]: !preferences[key]
      }
    });
  };

  const handleStorePreferenceChange = (store: 'all' | 'steam' | 'epic') => {
    onUpdateProfile({
      ...currentProfile,
      preferences: {
        ...preferences,
        preferredStore: store
      }
    });
  };

  const handleMinCozyScoreChange = (score: number) => {
    onUpdateProfile({
      ...currentProfile,
      preferences: {
        ...preferences,
        minCozyScore: score
      }
    });
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginEmail) {
      const generatedName = loginEmail.split('@')[0] || 'CozyPlayer';
      onUpdateProfile({
        ...currentProfile,
        username: generatedName,
        gamerTag: `${generatedName}#${Math.floor(1000 + Math.random() * 9000)}`
      });
      setAuthSuccessMsg(`Logged in successfully as ${generatedName}!`);
      setTimeout(() => {
        setAuthMode('logged_in');
        setAuthSuccessMsg('');
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-base rounded-3xl border border-border w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-border bg-surface/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl ${currentAvatarObj.bg} text-white flex items-center justify-center text-lg shadow-xs`}>
              {currentAvatarObj.emoji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif-natural text-lg font-normal text-text-heading">
                  {currentProfile.username}
                </h2>
                <span className="text-[11px] font-mono bg-[#E6E2D3] text-text-heading px-2 py-0.5 rounded-md">
                  {currentProfile.gamerTag}
                </span>
              </div>
              <p className="text-[11px] text-text-muted">
                Member since {currentProfile.memberSince || '2025'} • {wishlistItems.length || wishlistGames.length} Saved PC Games
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text-heading hover:bg-border/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-border bg-base flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'profile'
                ? 'border-brand text-text-heading'
                : 'border-transparent text-text-muted hover:text-text-heading'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Persona</span>
          </button>

          <button
            onClick={() => setActiveTab('wishlist')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'wishlist'
                ? 'border-brand text-text-heading'
                : 'border-transparent text-text-muted hover:text-text-heading'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Wishlist & Alerts ({wishlistItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'preferences'
                ? 'border-brand text-text-heading'
                : 'border-transparent text-text-muted hover:text-text-heading'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>PC & Store Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('auth')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'auth'
                ? 'border-brand text-text-heading'
                : 'border-transparent text-text-muted hover:text-text-heading'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Account Sync</span>
          </button>
        </div>

        {/* Modal Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: Profile */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Avatar Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-text-muted tracking-wider">
                  Choose Cozy Avatar Emoji
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                  {AVATAR_OPTIONS.map((av) => (
                    <button
                      key={av.id}
                      onClick={() => {
                        setSelectedAvatar(av.id);
                        onUpdateProfile({ ...currentProfile, avatarIcon: av.id });
                      }}
                      className={`p-2.5 rounded-2xl flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                        selectedAvatar === av.id
                          ? 'border-brand bg-surface-brand ring-2 ring-[#8BA888]/30 scale-105'
                          : 'border-border bg-surface hover:border-brand/50'
                      }`}
                    >
                      <span className="text-2xl">{av.emoji}</span>
                      <span className="text-[10px] font-medium text-text-heading truncate max-w-full">
                        {av.label.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bio & Details Form */}
              <div className="bg-base p-5 rounded-2xl border border-border space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-heading">Display Name</label>
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-text-heading focus:outline-hidden focus:border-brand"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-heading">Cozy Gamer Tag</label>
                    <input
                      type="text"
                      value={editedTag}
                      onChange={(e) => setEditedTag(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-text-heading focus:outline-hidden focus:border-brand"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-heading">Favorite Vibe & Aesthetic</label>
                  <input
                    type="text"
                    value={editedVibe}
                    onChange={(e) => setEditedVibe(e.target.value)}
                    placeholder="e.g. Pastel Watercolor, 90s Anime, Zero Stress"
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-text-heading focus:outline-hidden focus:border-brand"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-heading">About You / Bio</label>
                  <textarea
                    rows={3}
                    value={editedBio}
                    onChange={(e) => setEditedBio(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl p-3 text-sm text-text-heading focus:outline-hidden focus:border-brand"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveProfileDetails}
                    className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Profile Changes</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Wishlist Management */}
          {activeTab === 'wishlist' && (() => {
            const effectiveGames: Game[] = wishlistGames.length > 0
              ? wishlistGames
              : (wishlistItems || []).map((item) => (allGames || []).find((g) => g.id === item.gameId)).filter(Boolean) as Game[];

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-text-heading">
                      Personal PC Wishlist & Notifications
                    </h3>
                    <p className="text-xs text-text-muted">
                      Configure release alerts, price drop notices, and personal notes for your saved titles.
                    </p>
                  </div>
                </div>

                {effectiveGames.length === 0 ? (
                  <div className="text-center py-12 bg-surface rounded-2xl border border-border p-6 space-y-2">
                    <Heart className="w-8 h-8 text-brand mx-auto opacity-50" />
                    <p className="text-sm font-medium text-text-heading">Your wishlist is currently empty</p>
                    <p className="text-xs text-text-muted">
                      Browse games in the Browser or Deals tab and click the heart icon to start building your collection!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {effectiveGames.map((game) => {
                      const item = (wishlistItems || []).find((i) => i.gameId === game.id);

                      return (
                        <div
                          key={game.id}
                          className="bg-base p-4 rounded-2xl border border-border hover:border-brand transition-all space-y-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div 
                              className="flex items-center gap-3 cursor-pointer"
                              onClick={() => {
                                onClose();
                                onSelectGame(game);
                              }}
                            >
                              <img
                                src={game.coverImage}
                                alt={game.title}
                                className="w-14 h-16 rounded-xl object-cover shadow-xs"
                              />
                              <div>
                                <h4 className="font-serif-natural text-base font-normal text-text-heading hover:text-brand transition-colors">
                                  {game.title}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                  <span className="font-bold text-text-heading">{game.salePrice || game.price}</span>
                                  {game.isOnSale && (
                                    <span className="text-accent font-bold text-[11px]">
                                      (-{game.discountPercent}%)
                                    </span>
                                  )}
                                  <span>•</span>
                                  <span>{game.steamDeckStatus === 'Verified' ? 'Deck Verified' : 'PC'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <a
                                href={game.steamStoreUrl || game.storeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl bg-surface hover:bg-border text-text-heading text-xs transition-colors cursor-pointer"
                                title="Open on Steam Store"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>

                              <button
                                onClick={() => {
                                  if (onRemoveWishlist) onRemoveWishlist(game.id);
                                  if (onRemoveWishlistItem) onRemoveWishlistItem(game.id);
                                }}
                                className="p-2 rounded-xl bg-surface hover:bg-rose-100 text-text-muted hover:text-rose-600 transition-colors cursor-pointer"
                                title="Remove from wishlist"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Notification and priority toggles if wishlistItem exists */}
                          {item && (
                            <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
                              <div className="flex flex-wrap items-center gap-3">
                                <label className="flex items-center gap-1.5 text-text-heading cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={item.notifyOnSale}
                                    onChange={(e) => onUpdateWishlistItem && onUpdateWishlistItem(item.gameId, { notifyOnSale: e.target.checked })}
                                    className="rounded text-brand focus:ring-0"
                                  />
                                  <span>Sale Price Drop Alert</span>
                                </label>

                                <label className="flex items-center gap-1.5 text-text-heading cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={item.notifyOnRelease}
                                    onChange={(e) => onUpdateWishlistItem && onUpdateWishlistItem(item.gameId, { notifyOnRelease: e.target.checked })}
                                    className="rounded text-brand focus:ring-0"
                                  />
                                  <span>Release & 1.0 Alert</span>
                                </label>
                              </div>

                              {/* Priority Selector */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-text-muted">Priority:</span>
                                <select
                                  value={item.priority || 'medium'}
                                  onChange={(e) => onUpdateWishlistItem && onUpdateWishlistItem(item.gameId, { priority: e.target.value as any })}
                                  className="bg-surface text-[11px] text-text-heading font-bold rounded-lg px-2 py-1 border border-border cursor-pointer"
                                >
                                  <option value="high">High Priority</option>
                                  <option value="medium">Medium</option>
                                  <option value="low">Low</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 3: Preferences & PC Settings */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              {/* PC Store Preference */}
              <div className="bg-base p-5 rounded-2xl border border-border space-y-3">
                <h4 className="text-xs font-bold uppercase text-text-heading tracking-wider">
                  PC Store Platform Default
                </h4>
                <p className="text-xs text-text-muted">
                  Which PC gaming store do you prefer viewing links and pricing from?
                </p>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <button
                    onClick={() => handleStorePreferenceChange('steam')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      preferences.preferredStore === 'steam'
                        ? 'bg-surface-brand border-brand text-text-heading'
                        : 'bg-surface border-border text-text-muted'
                    }`}
                  >
                    Steam (Default)
                  </button>

                  <button
                    onClick={() => handleStorePreferenceChange('epic')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      preferences.preferredStore === 'epic'
                        ? 'bg-surface-brand border-brand text-text-heading'
                        : 'bg-surface border-border text-text-muted'
                    }`}
                  >
                    Epic Games Store
                  </button>

                  <button
                    onClick={() => handleStorePreferenceChange('all')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      preferences.preferredStore === 'all'
                        ? 'bg-surface-brand border-brand text-text-heading'
                        : 'bg-surface border-border text-text-muted'
                    }`}
                  >
                    All PC Stores
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="bg-base p-5 rounded-2xl border border-border space-y-4">
                <h4 className="text-xs font-bold uppercase text-text-heading tracking-wider">
                  Automated Notification Preferences
                </h4>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-surface cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-text-heading">Wishlist Sale Price Drops</div>
                      <div className="text-[11px] text-text-muted">Get notified whenever a saved PC game goes on discount</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.notifyOnPriceDrops}
                      onChange={() => handleTogglePreference('notifyOnPriceDrops')}
                      className="rounded text-brand focus:ring-0 w-4 h-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-surface cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-text-heading">New Game Release & 1.0 Launches</div>
                      <div className="text-[11px] text-text-muted">Alerts when upcoming cozy games leave Early Access or launch</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.notifyOnReleases}
                      onChange={() => handleTogglePreference('notifyOnReleases')}
                      className="rounded text-brand focus:ring-0 w-4 h-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-surface cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-text-heading">Major Content Patches & Roadmaps</div>
                      <div className="text-[11px] text-text-muted">Updates when games receive new crops, romance tiers, or Deck tweaks</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.notifyOnPatches}
                      onChange={() => handleTogglePreference('notifyOnPatches')}
                      className="rounded text-brand focus:ring-0 w-4 h-4"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Account & Auth */}
          {activeTab === 'auth' && (
            <div className="space-y-6">
              <div className="bg-surface-brand p-5 rounded-2xl border border-brand/30 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-brand">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Cloud Wishlist & PC Sync</span>
                </div>
                <h4 className="font-serif-natural text-lg text-text-heading">
                  Your profile and wishlist are securely stored locally
                </h4>
                <p className="text-xs text-text-muted leading-relaxed">
                  Log in or create a free account to sync your Steam Deck preferences, price drop notifications, and discovery quiz results across all your devices.
                </p>
              </div>

              {authSuccessMsg && (
                <div className="p-3 bg-brand text-white rounded-xl text-xs font-bold text-center">
                  {authSuccessMsg}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="bg-base p-5 rounded-2xl border border-border space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      authMode === 'login' || authMode === 'logged_in' ? 'bg-[#5A5A40] text-white' : 'text-text-muted'
                    }`}
                  >
                    Log In
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('signup')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      authMode === 'signup' ? 'bg-[#5A5A40] text-white' : 'text-text-muted'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-heading">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="you@cozygames.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-text-heading focus:outline-hidden focus:border-brand"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-heading">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-text-heading focus:outline-hidden focus:border-brand"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-text-muted">
                    Currently active as <strong className="text-text-heading">{currentProfile.username}</strong>
                  </span>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{authMode === 'signup' ? 'Register Account' : 'Sign In'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
