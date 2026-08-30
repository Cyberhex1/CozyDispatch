import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { 
  subscribeUser, 
  getSubscribers, 
  broadcastNewsletter, 
  getOutbox, 
  unsubscribeUserByToken 
} from './src/services/emailService';
import { 
  syncNewsIncremental, 
  syncRankingsIncremental, 
  syncCatalogIncremental, 
  runAllIncrementalSyncs,
  loadIngestionState 
} from './src/services/incrementalSyncService';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client lazily/safely
let genAiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAiClient && process.env.GEMINI_API_KEY) {
    genAiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAiClient;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// Real Cozy & Indie News Storage & Endpoints
// ============================================================================
const NEWS_FILE = path.join(process.cwd(), 'src', 'data', 'newsFeed.json');
let cachedNews: any[] | null = null;
let lastNewsRefreshTime = 0;

function loadNewsFromFile(): any[] {
  try {
    if (fs.existsSync(NEWS_FILE)) {
      const data = fs.readFileSync(NEWS_FILE, 'utf8');
      cachedNews = JSON.parse(data);
      return cachedNews || [];
    }
  } catch (err) {
    console.error('Error reading newsFeed.json:', err);
  }
  return cachedNews || [];
}

// GET /api/news - Query, filter, and paginate live cozy news
app.get('/api/news', (req, res) => {
  try {
    const { category, source, search, page = '1', limit = '50' } = req.query;
    let articles = cachedNews || loadNewsFromFile();

    // Category filter
    if (category && category !== 'all') {
      const catLower = String(category).toLowerCase();
      articles = articles.filter((a: any) => 
        a.category?.toLowerCase() === catLower || 
        (a.tags && a.tags.some((t: string) => t.toLowerCase() === catLower))
      );
    }

    // Source outlet filter
    if (source && source !== 'all') {
      const srcLower = String(source).toLowerCase();
      articles = articles.filter((a: any) => a.source?.toLowerCase() === srcLower);
    }

    // Search filter
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      articles = articles.filter((a: any) => 
        a.title?.toLowerCase().includes(q) ||
        a.summary?.toLowerCase().includes(q) ||
        a.relatedGameTitle?.toLowerCase().includes(q) ||
        (a.tags && a.tags.some((t: string) => t.toLowerCase().includes(q)))
      );
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 50));
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = articles.slice(startIndex, startIndex + limitNum);

    return res.json({
      success: true,
      total: articles.length,
      page: pageNum,
      limit: limitNum,
      articles: paginated
    });
  } catch (error: any) {
    console.error('Error fetching news:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve news feed.' });
  }
});

// POST /api/news/refresh - On-demand background sync
app.post('/api/news/refresh', async (req, res) => {
  const now = Date.now();
  if (now - lastNewsRefreshTime < 60_000) {
    return res.json({
      success: true,
      message: 'News feed was recently updated. Serving cached articles.',
      total: (cachedNews || loadNewsFromFile()).length
    });
  }

  lastNewsRefreshTime = now;
  try {
    const { syncNewsIncremental } = await import('./src/services/incrementalSyncService');
    const result = await syncNewsIncremental(process.env.GEMINI_API_KEY);
    cachedNews = loadNewsFromFile();

    return res.json({
      success: result.success,
      message: `Incremental news sync complete: ${result.newArticles} new articles added (${result.skipped} unchanged).`,
      total: result.totalArticles,
      newCount: result.newArticles,
      skippedCount: result.skipped
    });
  } catch (error: any) {
    console.error('Error refreshing news:', error);
    return res.status(500).json({ success: false, error: 'Failed to refresh news feed.' });
  }
});

// ============================================================================
// Game Catalog API — Serves steamGamesCatalog.json directly from disk
// Incremental sync updates are instantly visible without rebuilding the client.
// ============================================================================

const CATALOG_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'steamGamesCatalog.json');
let cachedCatalog: any[] | null = null;
let lastCatalogReadTime = 0;
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000; // Refresh from disk at most every 5 minutes

function loadCatalogFromFile(): any[] {
  const now = Date.now();
  if (cachedCatalog && (now - lastCatalogReadTime) < CATALOG_CACHE_TTL_MS) {
    return cachedCatalog;
  }
  try {
    if (fs.existsSync(CATALOG_FILE_PATH)) {
      const data = fs.readFileSync(CATALOG_FILE_PATH, 'utf8');
      cachedCatalog = JSON.parse(data);
      lastCatalogReadTime = now;
      return cachedCatalog || [];
    }
  } catch (err) {
    console.error('[Catalog] Error reading steamGamesCatalog.json:', err);
  }
  return cachedCatalog || [];
}

// GET /api/catalog - Query, filter, and paginate the game catalog
app.get('/api/catalog', (req, res) => {
  try {
    const { category, search, deckVerified, sort, page = '1', limit = '100' } = req.query;
    let games = loadCatalogFromFile();

    // Category filter (basic string match - client-side matchesGameCategory handles full logic)
    if (category && category !== 'all') {
      const catLower = String(category).toLowerCase();
      games = games.filter((g: any) =>
        g.category?.toLowerCase() === catLower ||
        (g.tags && g.tags.some((t: string) => t.toLowerCase().includes(catLower)))
      );
    }

    // Steam Deck Verified filter
    if (deckVerified === 'true') {
      games = games.filter((g: any) => g.steamDeckStatus === 'Verified');
    }

    // Search filter
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      games = games.filter((g: any) =>
        g.title?.toLowerCase().includes(q) ||
        g.developer?.toLowerCase().includes(q) ||
        g.shortDescription?.toLowerCase().includes(q) ||
        (g.tags && g.tags.some((t: string) => t.toLowerCase().includes(q)))
      );
    }

    // Sort
    if (sort === 'rating') games = games.sort((a: any, b: any) => (b.ratingScore || 0) - (a.ratingScore || 0));
    else if (sort === 'cozy') games = games.sort((a: any, b: any) => (b.cozyScore || 0) - (a.cozyScore || 0));

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.max(1, Math.min(500, parseInt(String(limit), 10) || 100));
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = games.slice(startIndex, startIndex + limitNum);

    return res.json({
      success: true,
      total: games.length,
      page: pageNum,
      limit: limitNum,
      games: paginated
    });
  } catch (error: any) {
    console.error('[Catalog] Error serving catalog:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve catalog.' });
  }
});

// POST /api/catalog/invalidate - Force catalog cache flush (called after incremental sync)
app.post('/api/catalog/invalidate', (req, res) => {
  cachedCatalog = null;
  lastCatalogReadTime = 0;
  console.log('[Catalog] Cache invalidated — next request will reload from disk.');
  return res.json({ success: true, message: 'Catalog cache cleared.' });
});



// GET /api/sync/status - Inspect sync metadata, timestamps & error states
app.get('/api/sync/status', async (req, res) => {
  try {
    const state = loadIngestionState();
    return res.json({
      success: true,
      state
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sync/news - Trigger incremental news sync
app.post('/api/sync/news', async (req, res) => {
  try {
    const result = await syncNewsIncremental(process.env.GEMINI_API_KEY);
    cachedNews = loadNewsFromFile();
    return res.json({ success: result.success, result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sync/catalog - Trigger incremental game discovery
app.post('/api/sync/catalog', async (req, res) => {
  try {
    const result = await syncCatalogIncremental();
    return res.json({ success: result.success, result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sync/rankings - Trigger incremental rankings & deals refresh
app.post('/api/sync/rankings', async (req, res) => {
  try {
    const result = await syncRankingsIncremental();
    return res.json({ success: result.success, result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sync/all - Run all scheduled syncs in sequence
app.post('/api/sync/all', async (req, res) => {
  try {
    const result = await runAllIncrementalSyncs(process.env.GEMINI_API_KEY);
    cachedNews = loadNewsFromFile();
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// Multi-Device User Account & Cloud Persistence System
// ============================================================================
const USERS_FILE = path.join(process.cwd(), 'src', 'data', 'users.json');
const SESSIONS_FILE = path.join(process.cwd(), 'src', 'data', 'sessions.json');

function getUsers(): any[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading users.json:', err);
  }
  return [];
}

function saveUsers(users: any[]) {
  try {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving users.json:', err);
  }
}

function getSessions(): Record<string, { userId: string; createdAt: string; lastActiveAt: string }> {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading sessions.json:', err);
  }
  return {};
}

function saveSessions(sessions: Record<string, any>) {
  try {
    fs.mkdirSync(path.dirname(SESSIONS_FILE), { recursive: true });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving sessions.json:', err);
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

/**
 * Prune sessions older than `maxAgeDays` days to prevent unbounded file growth.
 * Called on server startup and after each login.
 */
function pruneExpiredSessions(maxAgeDays = 30): void {
  try {
    const sessions = getSessions();
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const pruned: Record<string, any> = {};
    let removed = 0;
    for (const [token, session] of Object.entries(sessions)) {
      const lastActive = session.lastActiveAt ? new Date(session.lastActiveAt).getTime() : 0;
      if (lastActive >= cutoff) {
        pruned[token] = session;
      } else {
        removed++;
      }
    }
    if (removed > 0) {
      saveSessions(pruned);
      console.log(`[Sessions] Pruned ${removed} expired session(s) older than ${maxAgeDays} days.`);
    }
  } catch (err) {
    console.error('[Sessions] Error pruning expired sessions:', err);
  }
}

function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const sessions = getSessions();
  sessions[token] = {
    userId,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString()
  };
  saveSessions(sessions);
  return token;
}

function getUserFromToken(token: string): any | null {
  if (!token) return null;
  const sessions = getSessions();
  const session = sessions[token];
  if (!session) return null;

  session.lastActiveAt = new Date().toISOString();
  saveSessions(sessions);

  const users = getUsers();
  return users.find((u: any) => u.id === session.userId) || null;
}

function sanitizeUser(user: any) {
  if (!user) return null;
  const { passwordHash, salt, ...safeUser } = user;
  return safeUser;
}

// POST /api/auth/signup - Register account & migrate local state
app.post('/api/auth/signup', (req, res) => {
  try {
    const { email, password, username, initialData } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    if (!password || typeof password !== 'string' || password.length < 4) {
      return res.status(400).json({ success: false, error: 'Password must be at least 4 characters long.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const users = getUsers();

    if (users.some((u: any) => u.email === trimmedEmail)) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists. Please log in.' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const chosenName = (username && typeof username === 'string' && username.trim()) || trimmedEmail.split('@')[0] || 'CozyGamer';

    const userId = `usr_${crypto.randomUUID()}`;
    const newUser = {
      id: userId,
      email: trimmedEmail,
      passwordHash,
      salt,
      createdAt: new Date().toISOString(),
      profile: {
        id: userId,
        email: trimmedEmail,
        isLoggedIn: true,
        username: chosenName,
        gamerTag: `${chosenName}#${Math.floor(1000 + Math.random() * 9000)}`,
        avatarIcon: initialData?.profile?.avatarIcon || 'sprout',
        bio: initialData?.profile?.bio || 'Cozy indie gamer and Steam Deck explorer.',
        favoriteVibe: initialData?.profile?.favoriteVibe || 'Pastel Watercolor & Zero Combat',
        memberSince: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        preferences: initialData?.profile?.preferences || {
          notifyOnPriceDrops: true,
          notifyOnReleases: true,
          notifyOnPatches: true,
          preferredGenres: ['Farming Sim', 'Gridless Builder', 'Atmospheric', 'Cozy Castle', 'Roguelike Deckbuilder'],
          preferredStore: 'all',
          steamDeckOnly: false,
          minCozyScore: 8.5,
          dailyDigestOptIn: true
        }
      },
      wishlistedGameIds: Array.isArray(initialData?.wishlistedGameIds) && initialData.wishlistedGameIds.length > 0
        ? initialData.wishlistedGameIds
        : ['fields-of-mistria', 'tiny-glade', 'balatro'],
      wishlistItems: Array.isArray(initialData?.wishlistItems) ? initialData.wishlistItems : [],
      bookmarkedArticleIds: Array.isArray(initialData?.bookmarkedArticleIds) ? initialData.bookmarkedArticleIds : [],
      notifications: Array.isArray(initialData?.notifications) && initialData.notifications.length > 0
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
          ],
      lastSyncedAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    const token = createSession(userId);
    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: sanitizeUser(newUser)
    });
  } catch (error: any) {
    console.error('Error signing up:', error);
    return res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login - Log into account from any device
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Please provide both email and password.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const users = getUsers();
    const user = users.find((u: any) => u.email === trimmedEmail);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const computedHash = hashPassword(password, user.salt);
    if (computedHash !== user.passwordHash) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    // Ensure isLoggedIn in profile is true
    user.profile.isLoggedIn = true;
    user.profile.email = user.email;
    saveUsers(users);

    // Opportunistically prune stale sessions on each login
    pruneExpiredSessions(30);

    const token = createSession(user.id);
    return res.json({
      success: true,
      message: `Welcome back, ${user.profile.username}!`,
      token,
      user: sanitizeUser(user)
    });
  } catch (error: any) {
    console.error('Error logging in:', error);
    return res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

// POST /api/auth/logout - Invalidate session
app.post('/api/auth/logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = req.body?.token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (token) {
      const sessions = getSessions();
      delete sessions[token];
      saveSessions(sessions);
    }

    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error: any) {
    console.error('Error logging out:', error);
    return res.status(500).json({ success: false, error: 'Failed to log out.' });
  }
});

// GET /api/user/sync - Hydrate cloud user data on any device
app.get('/api/user/sync', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);

    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
    }

    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
    }

    return res.json({
      success: true,
      user: sanitizeUser(user)
    });
  } catch (error: any) {
    console.error('Error syncing user:', error);
    return res.status(500).json({ success: false, error: 'Failed to sync user data.' });
  }
});

// PUT /api/user/sync - Cloud save updates for authenticated user
app.put('/api/user/sync', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.body?.token as string);

    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
    }

    const users = getUsers();
    const sessions = getSessions();
    const session = sessions[token];

    if (!session) {
      return res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
    }

    const userIndex = users.findIndex((u: any) => u.id === session.userId);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const targetUser = users[userIndex];
    const { profile, wishlistedGameIds, wishlistItems, bookmarkedArticleIds, notifications } = req.body;

    if (profile && typeof profile === 'object') {
      targetUser.profile = {
        ...targetUser.profile,
        ...profile,
        id: targetUser.id,
        email: targetUser.email,
        isLoggedIn: true
      };
    }

    if (Array.isArray(wishlistedGameIds)) {
      targetUser.wishlistedGameIds = wishlistedGameIds;
    }

    if (Array.isArray(wishlistItems)) {
      targetUser.wishlistItems = wishlistItems;
    }

    if (Array.isArray(bookmarkedArticleIds)) {
      targetUser.bookmarkedArticleIds = bookmarkedArticleIds;
    }

    if (Array.isArray(notifications)) {
      targetUser.notifications = notifications;
    }

    targetUser.lastSyncedAt = new Date().toISOString();
    users[userIndex] = targetUser;
    saveUsers(users);

    return res.json({
      success: true,
      message: 'Cloud sync successful.',
      user: sanitizeUser(targetUser)
    });
  } catch (error: any) {
    console.error('Error saving sync data:', error);
    return res.status(500).json({ success: false, error: 'Failed to persist user updates.' });
  }
});

// ============================================================================
// Real Newsletter, Welcome Email & Subscriber Broadcast System
// ============================================================================

// POST /api/newsletter/subscribe - Subscribe email, deduplicate, and trigger welcome email
app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const { email, source = 'footer_signup' } = req.body;
    
    if (!email || typeof email !== 'string' || !email.includes('@') || !email.includes('.')) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.'
      });
    }

    const result = await subscribeUser(email, source);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to process subscription.'
      });
    }

    const allSubscribers = getSubscribers();
    return res.json({
      success: true,
      alreadySubscribed: !result.isNew,
      welcomeSent: result.welcomeSent,
      message: result.message,
      totalSubscribers: allSubscribers.length
    });
  } catch (error: any) {
    console.error('[Newsletter] Subscription endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process subscription. Please try again.'
    });
  }
});

// POST /api/newsletter/broadcast - Dispatch newsletter campaign to all active subscribers
app.post('/api/newsletter/broadcast', async (req, res) => {
  try {
    const { headline, intro, editionNumber, featuredGames, articles } = req.body;

    if (!headline || !intro) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both a headline and an intro for the newsletter campaign.'
      });
    }

    const result = await broadcastNewsletter({
      headline,
      intro,
      editionNumber,
      featuredGames,
      articles
    });

    return res.json({
      success: true,
      message: `Newsletter broadcast complete: Sent to ${result.successfulSends} active subscribers.`,
      result
    });
  } catch (error: any) {
    console.error('[Newsletter] Broadcast error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to broadcast newsletter.'
    });
  }
});

// GET /api/newsletter/outbox - Inspect sent emails and delivery logs
app.get('/api/newsletter/outbox', async (req, res) => {
  try {
    const outbox = getOutbox();
    return res.json({
      success: true,
      totalSent: outbox.length,
      outbox
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/newsletter/unsubscribe - 1-Click unsubscribe handler
app.get('/api/newsletter/unsubscribe', async (req, res) => {
  const token = req.query.token as string;
  const result = unsubscribeUserByToken(token);

  return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Cozy Dispatch Unsubscribe</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #F8F6F0; color: #2C2C24; display: flex; align-items: center; justify-content: center; min-height: 90vh; margin: 0; }
    .card { background: #FFFFFF; border: 1px solid #E6E2D8; border-radius: 20px; padding: 36px; max-width: 460px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
    h2 { font-family: Georgia, serif; color: #2C2C24; margin-top: 0; }
    p { font-size: 14px; color: #505045; line-height: 1.6; }
    a { display: inline-block; margin-top: 16px; background: #2C2C24; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <h2>${result.success ? 'Unsubscribed' : 'Notice'}</h2>
    <p>${result.message}</p>
    <a href="/">Return to Cozy Dispatch</a>
  </div>
</body>
</html>`);
});

// Subscriber Stats Endpoint
app.get('/api/newsletter/stats', async (req, res) => {
  const { getSubscribers, getOutbox } = await import('./src/services/emailService');
  const subs = getSubscribers();
  const activeCount = subs.filter(s => s.status === 'active').length;
  const outbox = getOutbox();

  return res.json({
    success: true,
    totalSubscribers: subs.length,
    activeSubscribers: activeCount,
    totalEmailsSent: outbox.length,
    latestEdition: 'Issue #42: Fields of Mistria Magic & Tiny Glade Zen'
  });
});

// Generate Daily Cozy Indie News Digest
app.post('/api/gemini/daily-briefing', async (req, res) => {
  try {
    const { category, focusTopic } = req.body;
    const ai = getGenAI();

    if (!ai) {
      // Return a rich structured fallback if no key
      return res.json({
        success: true,
        digest: {
          date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
          headline: `Daily Cozy & Indie Dispatch: ${category ? category.toUpperCase() : 'ALL CATEGORIES'} Edition`,
          greeting: "Welcome to today's cozy edition! Here is your curated roundup of the most relaxing and inspiring indie gaming moments.",
          curatedPicks: [
            {
              gameTitle: "Fields of Mistria",
              highlight: "90s magical anime farming sim expands festival events and heart interactions in recent community updates.",
              vibeTag: "Wholesome Magic"
            },
            {
              gameTitle: "Tiny Glade",
              highlight: "Procedural building sensation celebrates over 20,000 positive reviews for its zero-stress castle crafting.",
              vibeTag: "Zen Architecture"
            },
            {
              gameTitle: "Balatro",
              highlight: "Continues reigning as the premier Steam Deck travel companion with record-setting battery efficiency.",
              vibeTag: "Card Roguelike"
            }
          ],
          industryWhispers: [
            "Indie developers report growing popularity of desktop-friendly idle sims like Rusty's Retirement.",
            "Steam Deck OLED optimizations are driving a renaissance for low-TDP 2D pixel art and cozy narrative adventures.",
            "Wholesome Direct showcase plans indicate an abundance of botanical and culinary simulators slated for 2025."
          ],
          communityVibeCheck: "Warm and contented. Gamers are embracing mindful, low-stress play sessions.",
          aiGenerated: false
        }
      });
    }

    const prompt = `You are the chief editor of "Cozy & Indie Game Dispatch", a warm, witty, and deeply informed publication dedicated to cozy games, wholesome indie titles, simulation games, and Steam Deck optimization.
Generate today's daily briefing for ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.
Focus: ${focusTopic || category || 'Cozy & Indie Gaming Highlights, updates, and relaxing recommendations'}.

Format your response as a JSON object with:
- headline (string: catchy, warm, creative morning headline)
- greeting (string: 1-2 sentence warm morning welcome mentioning tea/coffee/relaxing)
- curatedPicks (array of 3-4 objects, each with { gameTitle: string, highlight: string (1-2 sentences about what's happening or why to play), vibeTag: string (e.g. "Cottagecore Farming", "Deck Verified Masterpiece", "Tactile Zen") })
- industryWhispers (array of 3 interesting short bullet points about upcoming trends, rumors, or developer updates in indie/cozy space)
- communityVibeCheck (string: 1-2 sentence warm summary of how the cozy gaming community is feeling today)
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            greeting: { type: Type.STRING },
            curatedPicks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  gameTitle: { type: Type.STRING },
                  highlight: { type: Type.STRING },
                  vibeTag: { type: Type.STRING },
                },
                required: ['gameTitle', 'highlight', 'vibeTag'],
              },
            },
            industryWhispers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            communityVibeCheck: { type: Type.STRING },
          },
          required: ['headline', 'greeting', 'curatedPicks', 'industryWhispers', 'communityVibeCheck'],
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      digest: {
        ...parsed,
        date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        aiGenerated: true
      }
    });
  } catch (error: any) {
    console.error('Error generating daily briefing:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate briefing'
    });
  }
});

// Interactive AI Cozy Vibe Matcher
app.post('/api/gemini/vibe-recommend', async (req, res) => {
  try {
    const { energyLevel, setting, gameplayFocus, timeCommitment, steamDeckRequired, customNotes } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.json({
        success: true,
        recommendations: [
          {
            title: "Fields of Mistria",
            tagline: "The perfect romantic magic farming escape",
            matchReason: `Matches your desire for a ${setting || 'farm'} setting with gentle ${gameplayFocus || 'farming'} vibes and complete relaxation.`,
            cozyFactor: 9.8,
            steamDeckFit: "Verified - 60FPS lock with under 6W power draw",
            suggestedActivity: "Spend a relaxing afternoon fishing by the river and tending to magical rainbow chickens."
          },
          {
            title: "Tiny Glade",
            tagline: "Pure tactile building joy with zero stress",
            matchReason: "Gridless castle doodling fits your requested chill energy level perfectly.",
            cozyFactor: 10.0,
            steamDeckFit: "Verified - Intuitive touch and trackpad sculpting",
            suggestedActivity: "Draw an overgrown mossy cottage with climbing roses and a family of sheep."
          },
          {
            title: "Minami Lane",
            tagline: "Wholesome bite-sized Japanese street management",
            matchReason: "Short, satisfying bursts of organizing boba cafes and petting stray cats.",
            cozyFactor: 9.7,
            steamDeckFit: "Verified - Great on gamepad",
            suggestedActivity: "Design the perfect ramen recipe to make your neighborhood elders smile."
          }
        ]
      });
    }

    const prompt = `You are an expert cozy game sommelier. A user is looking for indie/cozy game recommendations based on their current mood and setup:
- Energy Level: ${energyLevel || 'Zen / Gentle'}
- Preferred Setting: ${setting || 'Cozy Village or Nature'}
- Gameplay Focus: ${gameplayFocus || 'Relaxing Crafting / Farming / Building'}
- Time Commitment: ${timeCommitment || 'Flexible'}
- Steam Deck Required: ${steamDeckRequired ? 'YES (must run great on Steam Deck)' : 'Not required'}
- Additional user notes: ${customNotes || 'Looking for something wholesome and low-stress'}

Recommend 3 real indie/cozy/simulation games that fit this exact vibe perfectly.
Provide structured JSON array of recommendations:
- title (string)
- tagline (string)
- matchReason (string, 2 sentences explaining why it fits their vibe)
- cozyFactor (number from 1.0 to 10.0)
- steamDeckFit (string, notes on controls/performance)
- suggestedActivity (string, specific heartwarming in-game activity to try first)
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              tagline: { type: Type.STRING },
              matchReason: { type: Type.STRING },
              cozyFactor: { type: Type.NUMBER },
              steamDeckFit: { type: Type.STRING },
              suggestedActivity: { type: Type.STRING },
            },
            required: ['title', 'tagline', 'matchReason', 'cozyFactor', 'steamDeckFit', 'suggestedActivity'],
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || '[]');
    return res.json({
      success: true,
      recommendations: parsed
    });
  } catch (error: any) {
    console.error('Error generating vibe recommendations:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to match cozy vibes'
    });
  }
});

// AI Patch Note / News Article Summarizer
app.post('/api/gemini/summarize-news', async (req, res) => {
  try {
    const { title, text, type } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.json({
        success: true,
        summary: `Key takeaways for ${title}: Major quality of life improvements, enhanced controller and Steam Deck responsiveness, and new content drops to keep gameplay relaxing and rewarding.`,
        bullets: [
          'Performance tuned for seamless handheld play.',
          'Enhanced user interface with cleaner readability and less clutter.',
          'Community-requested balance adjustments integrated.'
        ]
      });
    }

    const prompt = `Summarize the following ${type || 'indie game news article / patch notes'} into a cozy, friendly, 30-second bulleted takeaway.
Title: ${title}
Content: ${text}

Output JSON with:
- summary (string: 2 sentences conversational summary)
- bullets (array of 3-4 concise bullet points explaining what players care about most)
- steamDeckImpact (string: 1 sentence on performance or handheld impact, if applicable)
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            bullets: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            steamDeckImpact: { type: Type.STRING }
          },
          required: ['summary', 'bullets']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      ...parsed
    });
  } catch (error: any) {
    console.error('Error summarizing news:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to summarize'
    });
  }
});

// Vite Middleware for development vs static production serve
async function setupViteMiddleware() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express 5 / path-to-regexp v8 requires a named wildcard; a bare '*' throws
    // "Missing parameter name at index 1" and crashes the server on startup.
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cozy Indie Dispatch server running on port ${PORT}`);
    // Prune stale sessions on startup
    pruneExpiredSessions(30);
    startScheduledSyncJobs();
  });
}

function startScheduledSyncJobs() {
  console.log('[Scheduler] Initializing automated incremental content updates (News: 2h, Rankings: 12h, Catalog: 24h)...');

  // 1. News sync: Every 2 hours
  const NEWS_INTERVAL_MS = 2 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      console.log('[Scheduler] Executing scheduled incremental news update...');
      await syncNewsIncremental(process.env.GEMINI_API_KEY);
      cachedNews = loadNewsFromFile();
    } catch (err: any) {
      console.error('[Scheduler] Scheduled news update error:', err.message);
    }
  }, NEWS_INTERVAL_MS);

  // 2. Rankings & Deals sync: Every 12 hours
  const RANKINGS_INTERVAL_MS = 12 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      console.log('[Scheduler] Executing scheduled incremental rankings update...');
      await syncRankingsIncremental();
    } catch (err: any) {
      console.error('[Scheduler] Scheduled rankings update error:', err.message);
    }
  }, RANKINGS_INTERVAL_MS);

  // 3. Catalog discovery check: Every 24 hours
  const CATALOG_INTERVAL_MS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      console.log('[Scheduler] Executing scheduled incremental catalog discovery...');
      await syncCatalogIncremental();
      // Invalidate in-memory catalog cache so /api/catalog serves fresh data immediately
      cachedCatalog = null;
      lastCatalogReadTime = 0;
    } catch (err: any) {
      console.error('[Scheduler] Scheduled catalog update error:', err.message);
    }
  }, CATALOG_INTERVAL_MS);
}

setupViteMiddleware().catch((err) => {
  console.error('Failed to start server:', err);
});
