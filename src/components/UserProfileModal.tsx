import React, { useState, useEffect } from 'react';
import { UserProfile, Game, WishlistItem, NotificationAlert, UserAccountData } from '../types';
import { AVATAR_OPTIONS, DEFAULT_USER_PROFILE } from '../data/userState';
import { loginAccount, signupAccount, logoutAccount } from '../services/accountSync';
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
  TrendingDown,
  Cloud,
  CloudCheck,
  AlertCircle,
  Loader2
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
  onLoginSuccess?: (userData: UserAccountData) => void;
  onLogoutSuccess?: () => void;
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
  onSelectGame,
  onLoginSuccess,
  onLogoutSuccess
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

  // Real Auth state
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');
  const [authErrorMsg, setAuthErrorMsg] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Sync edit form with profile changes
  useEffect(() => {
    setEditedName(currentProfile.username || 'Cozy Gamer');
    setEditedTag(currentProfile.gamerTag || 'Cozy#1000');
    setEditedBio(currentProfile.bio || '');
    setEditedVibe(currentProfile.favoriteVibe || '');
    setSelectedAvatar(currentProfile.avatarIcon || 'sprout');
  }, [currentProfile]);

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

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrorMsg('');
    setAuthSuccessMsg('');
    setIsSubmittingAuth(true);

    try {
      if (authMode === 'signup') {
        const res = await signupAccount(loginEmail, loginPassword, editedName, {
          profile: currentProfile,
          wishlistedGameIds: wishlistGames.map((g) => g.id),
          wishlistItems: wishlistItems
        });

        if (res.success && res.user) {
          setAuthSuccessMsg(`Account created! Logged in as ${res.user.profile.username}.`);
          if (onLoginSuccess) {
            onLoginSuccess(res.user);
          }
          setLoginPassword('');
        } else {
          setAuthErrorMsg(res.error || 'Failed to create account.');
        }
      } else {
        const res = await loginAccount(loginEmail, loginPassword);
        if (res.success && res.user) {
          setAuthSuccessMsg(`Welcome back, ${res.user.profile.username}! Your cloud data has loaded.`);
          if (onLoginSuccess) {
            onLoginSuccess(res.user);
          }
          setLoginPassword('');
        } else {
          setAuthErrorMsg(res.error || 'Invalid email or password.');
        }
      }
    } catch (err: any) {
      setAuthErrorMsg(err.message || 'Authentication error.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    await logoutAccount();
    if (onLogoutSuccess) {
      onLogoutSuccess();
    }
    setAuthSuccessMsg('Logged out successfully.');
    setTimeout(() => setAuthSuccessMsg(''), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-base rounded-3xl border border-border w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        
        {/* Modal Top Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-surface/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className={`w-9 sm:w-10 h-9 sm:h-10 rounded-2xl ${currentAvatarObj.bg} text-white flex items-center justify-center text-base sm:text-lg shadow-xs shrink-0`}>
              {currentAvatarObj.emoji}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="font-serif-natural text-base sm:text-lg font-normal text-text-heading truncate">
                  {currentProfile.username}
                </h2>
                <span className="text-[10px] sm:text-[11px] font-mono bg-border text-text-heading px-1.5 sm:px-2 py-0.5 rounded-md shrink-0">
                  {currentProfile.gamerTag}
                </span>
                {currentProfile.isLoggedIn && (
                  <span className="text-[10px] bg-brand text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                    <Cloud className="w-3 h-3" />
                    Cloud Synced
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-text-muted truncate">
                {currentProfile.isLoggedIn ? currentProfile.email : 'Guest Profile'} • Member since {currentProfile.memberSince || '2025'} • {wishlistItems.length || wishlistGames.length} Saved
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl bg-surface hover:bg-border text-text-muted hover:text-text-main transition-colors cursor-pointer border border-border shrink-0 ml-2"
          >
            <X className="w-4 sm:w-5 h-4 sm:h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 border-b border-border bg-surface/40 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <User className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            <span>Profile & Bio</span>
          </button>

          <button
            onClick={() => setActiveTab('wishlist')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'wishlist'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Heart className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            <span>Wishlist ({wishlistGames.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'preferences'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Settings className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            <span>Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('auth')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'auth'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <ShieldCheck className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            <span>{currentProfile.isLoggedIn ? 'Cloud Account' : 'Sign In / Sync'}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: Profile & Customization */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Avatar Picker */}
              <div className="bg-base p-4 sm:p-5 rounded-2xl border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Choose Cozy Avatar Icon
                  </span>
                  <span className="text-xs text-brand font-semibold">
                    {currentAvatarObj.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 pt-1">
                  {AVATAR_OPTIONS.map((avatar) => {
                    const isSelected = selectedAvatar === avatar.id;
                    return (
                      <button
                        key={avatar.id}
                        onClick={() => {
                          setSelectedAvatar(avatar.id);
                          onUpdateProfile({ ...currentProfile, avatarIcon: avatar.id });
                        }}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? `${avatar.bg} text-white border-brand shadow-sm scale-105`
                            : 'bg-surface border-border hover:bg-border/60 text-text-heading'
                        }`}
                      >
                        <span className="text-xl sm:text-2xl">{avatar.emoji}</span>
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-text-muted'} truncate w-full text-center`}>
                          {avatar.label.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bio & Gamer Details */}
              <div className="bg-base p-4 sm:p-5 rounded-2xl border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Player Identity & Bio
                  </span>
                  {!isEditingBio ? (
                    <button
                      onClick={() => setIsEditingBio(true)}
                      className="text-xs font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditingBio(false)}
                        className="text-xs font-semibold text-text-muted hover:text-text-main cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfileDetails}
                        className="text-xs font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>
                    </div>
                  )}
                </div>

                {isEditingBio ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-text-muted block mb-1">Display Name</label>
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-heading focus:outline-hidden focus:border-brand"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-text-muted block mb-1">Cozy GamerTag</label>
                        <input
                          type="text"
                          value={editedTag}
                          onChange={(e) => setEditedTag(e.target.value)}
                          className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-heading focus:outline-hidden focus:border-brand"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-text-muted block mb-1">Favorite Cozy Vibe / Aesthetic</label>
                      <input
                        type="text"
                        value={editedVibe}
                        onChange={(e) => setEditedVibe(e.target.value)}
                        placeholder="e.g. 90s Anime Watercolors & Petting Animals"
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-heading focus:outline-hidden focus:border-brand"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-text-muted block mb-1">Player Bio</label>
                      <textarea
                        value={editedBio}
                        onChange={(e) => setEditedBio(e.target.value)}
                        rows={3}
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-heading focus:outline-hidden focus:border-brand"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-surface rounded-xl border border-border">
                      <span className="text-[10px] font-bold uppercase text-text-muted block mb-0.5">Player Bio</span>
                      <p className="text-text-main leading-relaxed">
                        {currentProfile.bio || 'No bio written yet. Click Edit Details to add a personal touch!'}
                      </p>
                    </div>

                    <div className="p-3 bg-surface rounded-xl border border-border flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-text-muted">Favorite Aesthetic</span>
                      <span className="font-semibold text-brand">{currentProfile.favoriteVibe || 'Wholesome Sim'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Wishlist Management */}
          {activeTab === 'wishlist' && (
            <div className="space-y-4">
              {wishlistGames.length === 0 ? (
                <div className="p-8 text-center bg-base rounded-2xl border border-border space-y-2">
                  <Heart className="w-8 h-8 text-text-muted mx-auto" />
                  <h4 className="font-serif-natural text-base text-text-heading">Your Wishlist is Empty</h4>
                  <p className="text-xs text-text-muted">
                    Click the heart icon on any game card across the catalog to track releases, prices, and patch notes.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {wishlistGames.map((game) => (
                    <div
                      key={game.id}
                      className="p-3.5 bg-base rounded-2xl border border-border flex items-center justify-between gap-3 hover:border-brand/40 transition-colors"
                    >
                      <div 
                        onClick={() => onSelectGame(game)}
                        className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                      >
                        <img
                          src={game.coverImage}
                          alt={game.title}
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="font-serif-natural text-sm text-text-heading truncate">
                            {game.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
                            <span className="font-bold text-brand">{game.price || '$14.99'}</span>
                            <span>•</span>
                            <span>{game.category}</span>
                          </div>
                        </div>
                      </div>

                      {onRemoveWishlist && (
                        <button
                          onClick={() => onRemoveWishlist(game.id)}
                          className="p-2 rounded-xl bg-surface hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors cursor-pointer"
                          title="Remove from wishlist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Preferences */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              {/* Store Preference */}
              <div className="bg-base p-5 rounded-2xl border border-border space-y-3">
                <h4 className="text-xs font-bold uppercase text-text-heading tracking-wider">
                  Default Store Platform
                </h4>
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
                    Epic Games
                  </button>

                  <button
                    onClick={() => handleStorePreferenceChange('all')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      preferences.preferredStore === 'all'
                        ? 'bg-surface-brand border-brand text-text-heading'
                        : 'bg-surface border-border text-text-muted'
                    }`}
                  >
                    All Stores
                  </button>
                </div>
              </div>

              {/* Notification Toggles */}
              <div className="bg-base p-5 rounded-2xl border border-border space-y-4">
                <h4 className="text-xs font-bold uppercase text-text-heading tracking-wider">
                  Automated Cloud Notifications
                </h4>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-surface cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-text-heading">Wishlist Sale Price Drops</div>
                      <div className="text-[11px] text-text-muted">Alerts when saved games go on discount</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.notifyOnPriceDrops}
                      onChange={() => handleTogglePreference('notifyOnPriceDrops')}
                      className="rounded text-brand focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-surface cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-text-heading">New Releases & 1.0 Launches</div>
                      <div className="text-[11px] text-text-muted">Alerts when upcoming cozy games launch</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.notifyOnReleases}
                      onChange={() => handleTogglePreference('notifyOnReleases')}
                      className="rounded text-brand focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-surface cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-text-heading">Major Content Patches & Roadmaps</div>
                      <div className="text-[11px] text-text-muted">Updates when games receive new crops, quests, or Deck patches</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.notifyOnPatches}
                      onChange={() => handleTogglePreference('notifyOnPatches')}
                      className="rounded text-brand focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Real Cloud Account & Auth */}
          {activeTab === 'auth' && (
            <div className="space-y-6">
              {currentProfile.isLoggedIn ? (
                /* Authenticated State */
                <div className="space-y-4">
                  <div className="bg-surface-brand p-5 rounded-2xl border border-brand/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase text-brand">
                        <Cloud className="w-4 h-4" />
                        <span>Cloud Account Active</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand text-white font-bold">
                        Synchronized
                      </span>
                    </div>

                    <div>
                      <h3 className="font-serif-natural text-xl text-text-heading">
                        {currentProfile.username}
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        Connected as <strong className="text-text-heading">{currentProfile.email}</strong>
                      </p>
                    </div>

                    <p className="text-xs text-text-muted leading-relaxed">
                      All your wishlisted games, bookmarked news articles, custom vibe preferences, and notifications are securely synced to the cloud and available on any device you sign into.
                    </p>
                  </div>

                  {authSuccessMsg && (
                    <div className="p-3.5 bg-brand text-white rounded-xl text-xs font-bold text-center">
                      {authSuccessMsg}
                    </div>
                  )}

                  <div className="p-5 bg-base rounded-2xl border border-border flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-text-heading">Log Out of This Device</div>
                      <div className="text-[11px] text-text-muted">Your cloud data will remain safely stored.</div>
                    </div>

                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 rounded-xl bg-surface hover:bg-red-500/10 text-text-muted hover:text-red-500 font-bold text-xs border border-border transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Unauthenticated Login / Signup Form */
                <div className="space-y-4">
                  <div className="bg-surface-brand p-5 rounded-2xl border border-brand/30 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-brand">
                      <Cloud className="w-4 h-4" />
                      <span>Multi-Device Cloud Sync</span>
                    </div>
                    <h4 className="font-serif-natural text-lg text-text-heading">
                      Access your wishlist and favorites from any device
                    </h4>
                    <p className="text-xs text-text-muted leading-relaxed">
                      Create a free account or log in to sync your saved games, bookmarks, and notification alerts across your PC, laptop, phone, and Steam Deck.
                    </p>
                  </div>

                  {authErrorMsg && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{authErrorMsg}</span>
                    </div>
                  )}

                  {authSuccessMsg && (
                    <div className="p-3.5 bg-brand text-white rounded-xl text-xs font-bold text-center">
                      {authSuccessMsg}
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} className="bg-base p-5 rounded-2xl border border-border space-y-4">
                    <div className="flex items-center gap-2 border-b border-border pb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('login');
                          setAuthErrorMsg('');
                        }}
                        className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          authMode === 'login' ? 'bg-inverse text-text-on-inverse' : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('signup');
                          setAuthErrorMsg('');
                        }}
                        className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          authMode === 'signup' ? 'bg-inverse text-text-on-inverse' : 'text-text-muted hover:text-text-main'
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
                        className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-text-heading focus:outline-hidden focus:border-brand transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-heading">Password</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-text-heading focus:outline-hidden focus:border-brand transition-colors"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] text-text-muted">
                        {authMode === 'signup' ? 'Local games will be saved to your account.' : 'Your saved items will sync.'}
                      </span>

                      <button
                        type="submit"
                        disabled={isSubmittingAuth}
                        className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSubmittingAuth ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <>
                            <LogIn className="w-3.5 h-3.5" />
                            <span>{authMode === 'signup' ? 'Create Account & Sync' : 'Sign In & Sync'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
