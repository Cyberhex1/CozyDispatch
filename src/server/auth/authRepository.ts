/**
 * src/server/auth/authRepository.ts
 *
 * D1-backed authentication & user data persistence.
 * Implements secure multi-device account registration, login, session tokens,
 * profile hydration, and scoped user data updates (wishlists, bookmarks, notifications).
 */

import { ID1Database } from '../db/d1Client';
import { generateSalt, generateToken, hashPasswordPBKDF2, verifyPassword } from './cryptoUtils';

export interface UserAccountResponse {
  id: string;
  email: string;
  createdAt: string;
  lastSyncedAt: string;
  profile: {
    id: string;
    email: string;
    isLoggedIn: boolean;
    username: string;
    gamerTag: string;
    avatarIcon: string;
    bio: string;
    favoriteVibe: string;
    memberSince: string;
    preferences: {
      notifyOnPriceDrops: boolean;
      notifyOnReleases: boolean;
      notifyOnPatches: boolean;
      preferredGenres: string[];
      preferredStore: string;
      steamDeckOnly: boolean;
      minCozyScore: number;
      dailyDigestOptIn: boolean;
    };
  };
  wishlistedGameIds: string[];
  wishlistItems: Array<{
    gameId: string;
    addedAt: string;
    notifyOnSale: boolean;
    notifyOnRelease: boolean;
    priority: string;
    customNotes?: string;
  }>;
  bookmarkedArticleIds: string[];
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    timestamp: string;
    isRead: boolean;
    gameId?: string;
    gameTitle?: string;
    gameCover?: string;
    discountPercent?: number;
    salePrice?: string;
    originalPrice?: string;
    storeUrl?: string;
  }>;
}

const DEFAULT_PREFERENCES = {
  notifyOnPriceDrops: true,
  notifyOnReleases: true,
  notifyOnPatches: true,
  preferredGenres: ['Farming Sim', 'Gridless Builder', 'Atmospheric', 'Cozy Castle', 'Roguelike Deckbuilder'],
  preferredStore: 'all',
  steamDeckOnly: false,
  minCozyScore: 8.5,
  dailyDigestOptIn: true
};

/**
 * Hydrates complete user account data by user ID.
 */
export async function getFullUserDataById(db: ID1Database, userId: string): Promise<UserAccountResponse | null> {
  const userRow = await db
    .prepare('SELECT id, email, created_at, last_synced_at FROM users WHERE id = ?')
    .bind(userId)
    .first<any>();

  if (!userRow) return null;

  const profileRow = await db
    .prepare('SELECT * FROM user_profiles WHERE user_id = ?')
    .bind(userId)
    .first<any>();

  const wishlistRows = await db
    .prepare('SELECT game_id, added_at, notify_on_sale, notify_on_release, priority, custom_notes FROM user_wishlist WHERE user_id = ? ORDER BY added_at ASC')
    .bind(userId)
    .all<any>();

  const bookmarkRows = await db
    .prepare('SELECT article_id FROM user_bookmarks WHERE user_id = ? ORDER BY bookmarked_at ASC')
    .bind(userId)
    .all<any>();

  const notifRows = await db
    .prepare('SELECT id, type, title, message, timestamp, is_read, game_id, game_title, game_cover, discount_percent, sale_price, original_price, store_url FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .all<any>();

  let parsedPrefs = DEFAULT_PREFERENCES;
  try {
    if (profileRow?.preferences_json) {
      parsedPrefs = { ...DEFAULT_PREFERENCES, ...JSON.parse(profileRow.preferences_json) };
    }
  } catch {}

  const username = profileRow?.username || userRow.email.split('@')[0] || 'CozyGamer';

  const wishlistItems = wishlistRows.results.map((w: any) => ({
    gameId: w.game_id,
    addedAt: w.added_at,
    notifyOnSale: Boolean(w.notify_on_sale),
    notifyOnRelease: Boolean(w.notify_on_release),
    priority: w.priority || 'high',
    customNotes: w.custom_notes || ''
  }));

  const wishlistedGameIds = wishlistItems.map((w) => w.gameId);
  const bookmarkedArticleIds = bookmarkRows.results.map((b: any) => b.article_id);
  const notifications = notifRows.results.map((n: any) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    timestamp: n.timestamp,
    isRead: Boolean(n.is_read),
    gameId: n.game_id || undefined,
    gameTitle: n.game_title || undefined,
    gameCover: n.game_cover || undefined,
    discountPercent: n.discount_percent || undefined,
    salePrice: n.sale_price || undefined,
    originalPrice: n.original_price || undefined,
    storeUrl: n.store_url || undefined
  }));

  return {
    id: userRow.id,
    email: userRow.email,
    createdAt: userRow.created_at,
    lastSyncedAt: userRow.last_synced_at,
    profile: {
      id: userRow.id,
      email: userRow.email,
      isLoggedIn: true,
      username,
      gamerTag: profileRow?.gamer_tag || `${username}#${Math.floor(1000 + Math.random() * 9000)}`,
      avatarIcon: profileRow?.avatar_icon || 'sprout',
      bio: profileRow?.bio || 'Cozy indie gamer and Steam Deck explorer.',
      favoriteVibe: profileRow?.favoriteVibe || profileRow?.favorite_vibe || 'Pastel Watercolor & Zero Combat',
      memberSince: profileRow?.member_since || new Date(userRow.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      preferences: parsedPrefs
    },
    wishlistedGameIds,
    wishlistItems,
    bookmarkedArticleIds,
    notifications
  };
}

/**
 * Creates a new user session and returns the secure session token.
 */
export async function createSession(db: ID1Database, userId: string): Promise<string> {
  const token = generateToken(32);
  const now = new Date().toISOString();
  await db
    .prepare('INSERT INTO sessions (token, user_id, created_at, last_active_at) VALUES (?, ?, ?, ?)')
    .bind(token, userId, now, now)
    .run();
  return token;
}

/**
 * Verifies session token and retrieves user account data.
 */
export async function getUserFromSession(db: ID1Database, token: string): Promise<UserAccountResponse | null> {
  if (!token) return null;

  const sessionRow = await db
    .prepare('SELECT user_id, last_active_at FROM sessions WHERE token = ?')
    .bind(token)
    .first<{ user_id: string; last_active_at: string }>();

  if (!sessionRow) return null;

  // Update last active timestamp
  const now = new Date().toISOString();
  await db
    .prepare('UPDATE sessions SET last_active_at = ? WHERE token = ?')
    .bind(now, token)
    .run();

  return getFullUserDataById(db, sessionRow.user_id);
}

/**
 * Registers a new account and populates initial profile/wishlist in D1.
 */
export async function registerUser(
  db: ID1Database,
  params: {
    email: string;
    password: string;
    username?: string;
    initialData?: any;
  }
): Promise<{ success: boolean; token?: string; user?: UserAccountResponse; error?: string }> {
  const { email, password, username, initialData } = params;

  if (!email || typeof email !== 'string' || !email.includes('@') || !email.includes('.')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  if (!password || typeof password !== 'string' || password.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters long.' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists
  const existing = await db
    .prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE')
    .bind(normalizedEmail)
    .first<any>();

  if (existing) {
    return { success: false, error: 'An account with this email already exists. Please log in.' };
  }

  const salt = generateSalt(16);
  const passwordHash = await hashPasswordPBKDF2(password, salt);
  const userId = `usr_${generateToken(16)}`;
  const now = new Date().toISOString();
  const chosenName = (username && username.trim()) || normalizedEmail.split('@')[0] || 'CozyGamer';

  // Insert user
  await db
    .prepare('INSERT INTO users (id, email, password_hash, salt, hash_algorithm, created_at, last_synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(userId, normalizedEmail, passwordHash, salt, 'pbkdf2_sha256', now, now)
    .run();

  // Insert profile
  const gamerTag = `${chosenName}#${Math.floor(1000 + Math.random() * 9000)}`;
  const prefs = initialData?.profile?.preferences || DEFAULT_PREFERENCES;
  const memberSince = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  await db
    .prepare(`
      INSERT INTO user_profiles 
      (user_id, username, gamer_tag, avatar_icon, bio, favorite_vibe, member_since, preferences_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      userId,
      chosenName,
      gamerTag,
      initialData?.profile?.avatarIcon || 'sprout',
      initialData?.profile?.bio || 'Cozy indie gamer and Steam Deck explorer.',
      initialData?.profile?.favoriteVibe || 'Pastel Watercolor & Zero Combat',
      memberSince,
      JSON.stringify(prefs),
      now
    )
    .run();

  // Insert initial wishlist
  const initialWishlist: string[] = Array.isArray(initialData?.wishlistedGameIds) && initialData.wishlistedGameIds.length > 0
    ? initialData.wishlistedGameIds
    : ['fields-of-mistria', 'tiny-glade', 'balatro'];

  for (const gameId of initialWishlist) {
    await db
      .prepare('INSERT OR IGNORE INTO user_wishlist (user_id, game_id, added_at, notify_on_sale, notify_on_release, priority) VALUES (?, ?, ?, 1, 1, ?)')
      .bind(userId, gameId, now, 'high')
      .run();
  }

  // Insert initial bookmarks
  const initialBookmarks: string[] = Array.isArray(initialData?.bookmarkedArticleIds)
    ? initialData.bookmarkedArticleIds
    : [];

  for (const artId of initialBookmarks) {
    await db
      .prepare('INSERT OR IGNORE INTO user_bookmarks (user_id, article_id, bookmarked_at) VALUES (?, ?, ?)')
      .bind(userId, artId, now)
      .run();
  }

  // Insert initial notifications
  const initialNotifs = Array.isArray(initialData?.notifications) && initialData.notifications.length > 0
    ? initialData.notifications
    : [
        {
          id: 'notif-welcome',
          type: 'wishlist',
          title: 'Welcome to Cozy Dispatch Cloud!',
          message: 'Your profile and wishlist are now securely synchronized across all your devices.',
          timestamp: 'Just now',
          isRead: false
        }
      ];

  for (const n of initialNotifs) {
    await db
      .prepare(`
        INSERT OR IGNORE INTO user_notifications 
        (id, user_id, type, title, message, timestamp, is_read, game_id, game_title, game_cover, discount_percent, sale_price, original_price, store_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        n.id || `notif_${generateToken(8)}`,
        userId,
        n.type || 'info',
        n.title || 'Welcome',
        n.message || '',
        n.timestamp || 'Just now',
        n.isRead ? 1 : 0,
        n.gameId || null,
        n.gameTitle || null,
        n.gameCover || null,
        n.discountPercent || null,
        n.salePrice || null,
        n.originalPrice || null,
        n.storeUrl || null,
        now
      )
      .run();
  }

  const token = await createSession(db, userId);
  const user = await getFullUserDataById(db, userId);

  return {
    success: true,
    token,
    user: user!
  };
}

/**
 * Authenticates user credentials and returns an independent session token.
 */
export async function loginUser(
  db: ID1Database,
  params: { email: string; password: string }
): Promise<{ success: boolean; token?: string; user?: UserAccountResponse; error?: string }> {
  const { email, password } = params;

  if (!email || !password) {
    return { success: false, error: 'Please provide both email and password.' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const userRow = await db
    .prepare('SELECT id, password_hash, salt, hash_algorithm FROM users WHERE email = ? COLLATE NOCASE')
    .bind(normalizedEmail)
    .first<any>();

  if (!userRow) {
    return { success: false, error: 'Invalid email or password.' };
  }

  const isValid = await verifyPassword(password, userRow.salt, userRow.password_hash, userRow.hash_algorithm);
  if (!isValid) {
    return { success: false, error: 'Invalid email or password.' };
  }

  const token = await createSession(db, userRow.id);
  const user = await getFullUserDataById(db, userRow.id);

  return {
    success: true,
    token,
    user: user!
  };
}

/**
 * Revokes a session token upon logout.
 */
export async function logoutUser(db: ID1Database, token: string): Promise<boolean> {
  if (!token) return true;
  await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return true;
}

/**
 * Persists updated profile, wishlist, bookmarks, and notifications for authenticated user.
 */
export async function syncUserData(
  db: ID1Database,
  userId: string,
  payload: {
    profile?: any;
    wishlistedGameIds?: string[];
    wishlistItems?: any[];
    bookmarkedArticleIds?: string[];
    notifications?: any[];
  }
): Promise<UserAccountResponse | null> {
  const now = new Date().toISOString();

  // Update profile
  if (payload.profile && typeof payload.profile === 'object') {
    const p = payload.profile;
    const existing = await db
      .prepare('SELECT * FROM user_profiles WHERE user_id = ?')
      .bind(userId)
      .first<any>();

    const username = p.username || existing?.username || 'CozyGamer';
    const gamerTag = p.gamerTag || existing?.gamer_tag || `${username}#1024`;
    const avatarIcon = p.avatarIcon || existing?.avatar_icon || 'sprout';
    const bio = p.bio !== undefined ? p.bio : existing?.bio;
    const favoriteVibe = p.favoriteVibe || existing?.favorite_vibe || 'Pastel Watercolor & Zero Combat';
    const preferencesJson = p.preferences ? JSON.stringify(p.preferences) : (existing?.preferences_json || '{}');

    await db
      .prepare(`
        INSERT INTO user_profiles 
        (user_id, username, gamer_tag, avatar_icon, bio, favorite_vibe, member_since, preferences_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          username = excluded.username,
          gamer_tag = excluded.gamer_tag,
          avatar_icon = excluded.avatar_icon,
          bio = excluded.bio,
          favorite_vibe = excluded.favorite_vibe,
          preferences_json = excluded.preferences_json,
          updated_at = excluded.updated_at
      `)
      .bind(userId, username, gamerTag, avatarIcon, bio, favoriteVibe, existing?.member_since || 'August 2024', preferencesJson, now)
      .run();
  }

  // Update wishlist if provided
  if (Array.isArray(payload.wishlistedGameIds) || Array.isArray(payload.wishlistItems)) {
    await db.prepare('DELETE FROM user_wishlist WHERE user_id = ?').bind(userId).run();

    if (Array.isArray(payload.wishlistItems) && payload.wishlistItems.length > 0) {
      for (const item of payload.wishlistItems) {
        await db
          .prepare('INSERT INTO user_wishlist (user_id, game_id, added_at, notify_on_sale, notify_on_release, priority, custom_notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(
            userId,
            item.gameId,
            item.addedAt || now,
            item.notifyOnSale !== false ? 1 : 0,
            item.notifyOnRelease !== false ? 1 : 0,
            item.priority || 'high',
            item.customNotes || ''
          )
          .run();
      }
    } else if (Array.isArray(payload.wishlistedGameIds)) {
      for (const gameId of payload.wishlistedGameIds) {
        await db
          .prepare('INSERT INTO user_wishlist (user_id, game_id, added_at, notify_on_sale, notify_on_release, priority) VALUES (?, ?, ?, 1, 1, ?)')
          .bind(userId, gameId, now, 'high')
          .run();
      }
    }
  }

  // Update bookmarks if provided
  if (Array.isArray(payload.bookmarkedArticleIds)) {
    await db.prepare('DELETE FROM user_bookmarks WHERE user_id = ?').bind(userId).run();
    for (const artId of payload.bookmarkedArticleIds) {
      await db
        .prepare('INSERT INTO user_bookmarks (user_id, article_id, bookmarked_at) VALUES (?, ?, ?)')
        .bind(userId, artId, now)
        .run();
    }
  }

  // Update notifications if provided
  if (Array.isArray(payload.notifications)) {
    await db.prepare('DELETE FROM user_notifications WHERE user_id = ?').bind(userId).run();
    for (const n of payload.notifications) {
      await db
        .prepare(`
          INSERT INTO user_notifications 
          (id, user_id, type, title, message, timestamp, is_read, game_id, game_title, game_cover, discount_percent, sale_price, original_price, store_url, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          n.id || `notif_${generateToken(8)}`,
          userId,
          n.type || 'info',
          n.title || 'Notification',
          n.message || '',
          n.timestamp || 'Just now',
          n.isRead ? 1 : 0,
          n.gameId || null,
          n.gameTitle || null,
          n.gameCover || null,
          n.discountPercent || null,
          n.salePrice || null,
          n.originalPrice || null,
          n.storeUrl || null,
          now
        )
        .run();
    }
  }

  await db
    .prepare('UPDATE users SET last_synced_at = ? WHERE id = ?')
    .bind(now, userId)
    .run();

  return getFullUserDataById(db, userId);
}
