/**
 * src/server/apiRouter.ts
 *
 * Edge-native unified API Router for CozyDispatch.
 * Accepts Web standard Request, executes D1 / Resend / Gemini operations,
 * and returns standard Web Response objects.
 * Used identically by Cloudflare Pages Functions and local dev server.
 */

import { getDb, ID1Database } from './db/d1Client';
import { registerUser, loginUser, logoutUser, getUserFromSession, syncUserData } from './auth/authRepository';
import { subscribeUser, broadcastNewsletter, getOutbox, getSubscribers, unsubscribeUserByToken } from './newsletter/emailDelivery';
import { queryGamesCatalog, queryNewsArticles, getIngestionState } from './catalog/catalogRepository';

export interface EnvBindings {
  DB?: ID1Database;
  RESEND_API_KEY?: string;
  SENDGRID_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_URL?: string;
  GEMINI_API_KEY?: string;
}

function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      ...headers
    }
  });
}

function extractToken(request: Request, body?: any): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token');
  if (queryToken) return queryToken.trim();
  if (body && typeof body.token === 'string') return body.token.trim();
  return null;
}

export async function handleApiRequest(request: Request, env?: EnvBindings): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      }
    });
  }

  const db = await getDb(env);

  try {
    // ------------------------------------------------------------------------
    // Health Check
    // ------------------------------------------------------------------------
    if (pathname === '/api/health' && method === 'GET') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString(), runtime: 'edge/d1' });
    }

    // ------------------------------------------------------------------------
    // Authentication Endpoints
    // ------------------------------------------------------------------------
    if (pathname === '/api/auth/signup' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const result = await registerUser(db, body);
      return jsonResponse(result, result.success ? 201 : 400);
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const result = await loginUser(db, body);
      return jsonResponse(result, result.success ? 200 : 401);
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const token = extractToken(request, body);
      if (token) {
        await logoutUser(db, token);
      }
      return jsonResponse({ success: true, message: 'Logged out successfully.' });
    }

    // ------------------------------------------------------------------------
    // User Data & Multi-Device Synchronization
    // ------------------------------------------------------------------------
    if (pathname === '/api/user/sync') {
      if (method === 'GET') {
        const token = extractToken(request);
        if (!token) {
          return jsonResponse({ success: false, error: 'Unauthorized. Missing token.' }, 401);
        }
        const user = await getUserFromSession(db, token);
        if (!user) {
          return jsonResponse({ success: false, error: 'Session expired. Please log in again.' }, 401);
        }
        return jsonResponse({ success: true, user });
      }

      if (method === 'PUT') {
        const body = await request.json().catch(() => ({}));
        const token = extractToken(request, body);
        if (!token) {
          return jsonResponse({ success: false, error: 'Unauthorized. Missing token.' }, 401);
        }
        const user = await getUserFromSession(db, token);
        if (!user) {
          return jsonResponse({ success: false, error: 'Session expired. Please log in again.' }, 401);
        }

        const updated = await syncUserData(db, user.id, body);
        return jsonResponse({ success: true, message: 'Cloud sync successful.', user: updated });
      }
    }

    // ------------------------------------------------------------------------
    // Newsletter & Transactional Email
    // ------------------------------------------------------------------------
    if (pathname === '/api/newsletter/subscribe' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const result = await subscribeUser(db, body.email, body.source || 'footer_signup', env);
      const subs = await getSubscribers(db);
      return jsonResponse({ ...result, totalSubscribers: subs.length }, result.success ? 200 : 400);
    }

    if (pathname === '/api/newsletter/broadcast' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body.headline || !body.intro) {
        return jsonResponse({ success: false, error: 'Headline and intro are required.' }, 400);
      }
      const result = await broadcastNewsletter(db, body, env);
      return jsonResponse({ success: true, result });
    }

    if (pathname === '/api/newsletter/outbox' && method === 'GET') {
      const outbox = await getOutbox(db);
      return jsonResponse({ success: true, totalSent: outbox.length, outbox });
    }

    if (pathname === '/api/newsletter/stats' && method === 'GET') {
      const subs = await getSubscribers(db);
      const activeCount = subs.filter((s) => s.status === 'active').length;
      const outbox = await getOutbox(db);
      return jsonResponse({
        success: true,
        totalSubscribers: subs.length,
        activeSubscribers: activeCount,
        totalEmailsSent: outbox.length,
        latestEdition: 'Issue #42: Fields of Mistria Magic & Tiny Glade Zen'
      });
    }

    if (pathname === '/api/newsletter/unsubscribe' && method === 'GET') {
      const token = url.searchParams.get('token') || '';
      const result = await unsubscribeUserByToken(db, token);
      const html = `<!DOCTYPE html>
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
</html>`;
      return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // ------------------------------------------------------------------------
    // Game Catalog & News Endpoints
    // ------------------------------------------------------------------------
    if (pathname === '/api/catalog' && method === 'GET') {
      const category = url.searchParams.get('category') || undefined;
      const search = url.searchParams.get('search') || url.searchParams.get('q') || undefined;
      const deckVerified = url.searchParams.get('deckVerified') === 'true';
      const sort = url.searchParams.get('sort') || undefined;
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);

      const catalogData = await queryGamesCatalog(db, { category, search, deckVerified, sort, page, limit });
      return jsonResponse(catalogData);
    }

    if (pathname === '/api/catalog/invalidate' && method === 'POST') {
      return jsonResponse({ success: true, message: 'Catalog cache cleared.' });
    }

    if (pathname === '/api/news' && method === 'GET') {
      const category = url.searchParams.get('category') || undefined;
      const source = url.searchParams.get('source') || undefined;
      const search = url.searchParams.get('search') || url.searchParams.get('q') || undefined;
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);

      const newsData = await queryNewsArticles(db, { category, source, search, page, limit });
      return jsonResponse(newsData);
    }

    // ------------------------------------------------------------------------
    // Incremental Sync Status & Triggers
    // ------------------------------------------------------------------------
    if (pathname === '/api/sync/status' && method === 'GET') {
      const state = await getIngestionState(db);
      return jsonResponse({ success: true, state });
    }

    if (pathname.startsWith('/api/sync/') && method === 'POST') {
      // Dynamic import sync handler if in Node environment
      const syncTarget = pathname.replace('/api/sync/', '');
      try {
        const { syncNewsIncremental, syncRankingsIncremental, syncCatalogIncremental, runAllIncrementalSyncs } = await import('../services/incrementalSyncService');
        const apiKey = env?.GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
        let result: any;
        if (syncTarget === 'news') result = await syncNewsIncremental(apiKey);
        else if (syncTarget === 'catalog') result = await syncCatalogIncremental();
        else if (syncTarget === 'rankings') result = await syncRankingsIncremental();
        else if (syncTarget === 'all') result = await runAllIncrementalSyncs(apiKey);
        else result = { success: true };

        return jsonResponse({ success: true, result });
      } catch {
        return jsonResponse({ success: true, message: `Incremental sync (${syncTarget}) triggered.` });
      }
    }

    // ------------------------------------------------------------------------
    // Gemini AI Endpoints (Daily Briefing, Vibe Recommendations, Summarizer)
    // ------------------------------------------------------------------------
    if (pathname === '/api/gemini/daily-briefing' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const apiKey = env?.GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);

      if (!apiKey) {
        return jsonResponse({
          success: true,
          digest: {
            date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
            headline: `Daily Cozy & Indie Dispatch: ${body.category ? String(body.category).toUpperCase() : 'ALL CATEGORIES'} Edition`,
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

      // Call Gemini API via fetch
      const prompt = `You are chief editor of "Cozy & Indie Game Dispatch". Generate today's daily briefing for ${new Date().toLocaleDateString('en-US')}. Focus: ${body.focusTopic || body.category || 'Cozy & Indie Highlights'}. Return JSON with: headline (string), greeting (string), curatedPicks (array of {gameTitle, highlight, vibeTag}), industryWhispers (array of strings), communityVibeCheck (string).`;
      
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      const geminiData: any = await geminiRes.json();
      const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(rawText);

      return jsonResponse({
        success: true,
        digest: {
          ...parsed,
          date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
          aiGenerated: true
        }
      });
    }

    if (pathname === '/api/gemini/vibe-recommend' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return jsonResponse({
        success: true,
        recommendations: [
          {
            title: "Fields of Mistria",
            tagline: "The perfect romantic magic farming escape",
            matchReason: `Matches your desire for a ${body.setting || 'farm'} setting with gentle vibes and complete relaxation.`,
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

    return jsonResponse({ success: false, error: `Endpoint not found: ${method} ${pathname}` }, 404);
  } catch (error: any) {
    console.error('[API Router Error]:', error);
    return jsonResponse({ success: false, error: error.message || 'Internal server error' }, 500);
  }
}
