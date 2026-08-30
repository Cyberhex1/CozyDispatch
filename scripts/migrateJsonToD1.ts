/**
 * scripts/migrateJsonToD1.ts
 *
 * Migrates existing data from src/data/*.json to Cloudflare D1 (SQLite).
 * Preserves all registered users, profiles, wishlists, subscribers, outbox,
 * news articles, game catalog, and ingestion states.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../src/server/db/d1Client';

async function migrateData() {
  console.log('🔄 Starting CozyDispatch JSON to D1 Database Migration...\n');

  const db = await getDb();
  const dataDir = path.join(process.cwd(), 'src', 'data');

  // ==========================================================================
  // 1. Users & Profiles Migration
  // ==========================================================================
  const usersFile = path.join(dataDir, 'users.json');
  if (fs.existsSync(usersFile)) {
    try {
      const users: any[] = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      let migratedUsers = 0;

      for (const u of users) {
        // Insert user
        await db
          .prepare(`
            INSERT INTO users (id, email, password_hash, salt, hash_algorithm, created_at, last_synced_at)
            VALUES (?, ?, ?, ?, 'scrypt', ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              email = excluded.email,
              password_hash = excluded.password_hash,
              salt = excluded.salt,
              last_synced_at = excluded.last_synced_at
          `)
          .bind(
            u.id,
            u.email.trim().toLowerCase(),
            u.passwordHash,
            u.salt,
            u.createdAt || new Date().toISOString(),
            u.lastSyncedAt || new Date().toISOString()
          )
          .run();

        // Insert profile
        const p = u.profile || {};
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
          .bind(
            u.id,
            p.username || u.email.split('@')[0],
            p.gamerTag || `${p.username || 'CozyGamer'}#1024`,
            p.avatarIcon || 'sprout',
            p.bio || 'Cozy indie gamer and Steam Deck explorer.',
            p.favoriteVibe || 'Pastel Watercolor & Zero Combat',
            p.memberSince || 'August 2024',
            JSON.stringify(p.preferences || {}),
            u.lastSyncedAt || new Date().toISOString()
          )
          .run();

        // Insert wishlist
        const wishlistIds: string[] = Array.isArray(u.wishlistedGameIds) ? u.wishlistedGameIds : [];
        for (const gameId of wishlistIds) {
          await db
            .prepare(`
              INSERT OR IGNORE INTO user_wishlist (user_id, game_id, added_at, notify_on_sale, notify_on_release, priority)
              VALUES (?, ?, ?, 1, 1, 'high')
            `)
            .bind(u.id, gameId, u.createdAt || new Date().toISOString())
            .run();
        }

        // Insert bookmarks
        const bookmarks: string[] = Array.isArray(u.bookmarkedArticleIds) ? u.bookmarkedArticleIds : [];
        for (const artId of bookmarks) {
          await db
            .prepare(`
              INSERT OR IGNORE INTO user_bookmarks (user_id, article_id, bookmarked_at)
              VALUES (?, ?, ?)
            `)
            .bind(u.id, artId, u.createdAt || new Date().toISOString())
            .run();
        }

        // Insert notifications
        const notifs: any[] = Array.isArray(u.notifications) ? u.notifications : [];
        for (const n of notifs) {
          await db
            .prepare(`
              INSERT OR IGNORE INTO user_notifications 
              (id, user_id, type, title, message, timestamp, is_read, game_id, game_title, game_cover, discount_percent, sale_price, original_price, store_url, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              n.id || `notif_${Math.random()}`,
              u.id,
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
              u.createdAt || new Date().toISOString()
            )
            .run();
        }

        migratedUsers++;
      }
      console.log(`✓ Migrated ${migratedUsers} user accounts & profiles to D1.`);
    } catch (err: any) {
      console.error('Error migrating users:', err.message);
    }
  }

  // ==========================================================================
  // 2. Sessions Migration
  // ==========================================================================
  const sessionsFile = path.join(dataDir, 'sessions.json');
  if (fs.existsSync(sessionsFile)) {
    try {
      const sessions: Record<string, any> = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
      let sessionCount = 0;
      for (const [token, sess] of Object.entries(sessions)) {
        await db
          .prepare(`
            INSERT OR IGNORE INTO sessions (token, user_id, created_at, last_active_at)
            VALUES (?, ?, ?, ?)
          `)
          .bind(token, sess.userId, sess.createdAt || new Date().toISOString(), sess.lastActiveAt || new Date().toISOString())
          .run();
        sessionCount++;
      }
      console.log(`✓ Migrated ${sessionCount} sessions to D1.`);
    } catch (err: any) {
      console.error('Error migrating sessions:', err.message);
    }
  }

  // ==========================================================================
  // 3. Newsletter Subscribers & Outbox Migration
  // ==========================================================================
  const subscribersFile = path.join(dataDir, 'subscribers.json');
  if (fs.existsSync(subscribersFile)) {
    try {
      const subs: any[] = JSON.parse(fs.readFileSync(subscribersFile, 'utf8'));
      let subCount = 0;
      for (const s of subs) {
        await db
          .prepare(`
            INSERT INTO newsletter_subscribers 
            (id, email, subscribed_at, source, status, welcome_email_sent, welcome_email_sent_at, unsubscribe_token, last_newsletter_sent_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
              status = excluded.status,
              welcome_email_sent = excluded.welcome_email_sent
          `)
          .bind(
            s.id,
            s.email.trim().toLowerCase(),
            s.subscribedAt || new Date().toISOString(),
            s.source || 'footer_signup',
            s.status || 'active',
            s.welcomeEmailSent ? 1 : 0,
            s.welcomeEmailSentAt || null,
            s.unsubscribeToken || `token_${Math.random()}`,
            s.lastNewsletterSentAt || null
          )
          .run();
        subCount++;
      }
      console.log(`✓ Migrated ${subCount} newsletter subscribers to D1.`);
    } catch (err: any) {
      console.error('Error migrating subscribers:', err.message);
    }
  }

  const outboxFile = path.join(dataDir, 'emailOutbox.json');
  if (fs.existsSync(outboxFile)) {
    try {
      const outbox: any[] = JSON.parse(fs.readFileSync(outboxFile, 'utf8'));
      let emailCount = 0;
      for (const o of outbox.slice(0, 100)) {
        await db
          .prepare(`
            INSERT OR IGNORE INTO email_outbox 
            (id, recipient, subject, template, provider, status, sent_at, html_content, text_content, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            o.id || `msg_${Math.random()}`,
            o.recipient,
            o.subject,
            o.template || 'newsletter',
            o.provider || 'resend',
            o.status || 'delivered',
            o.sentAt || new Date().toISOString(),
            o.htmlContent || '',
            o.textContent || '',
            o.error || null
          )
          .run();
        emailCount++;
      }
      console.log(`✓ Migrated ${emailCount} outbox email logs to D1.`);
    } catch (err: any) {
      console.error('Error migrating outbox:', err.message);
    }
  }

  // ==========================================================================
  // 4. Game Catalog Migration
  // ==========================================================================
  const catalogFile = path.join(dataDir, 'steamGamesCatalog.json');
  if (fs.existsSync(catalogFile)) {
    try {
      const catalog: any[] = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
      console.log(`\nImporting ${catalog.length} games into games_catalog table...`);
      let count = 0;
      const now = new Date().toISOString();

      for (const g of catalog) {
        await db
          .prepare(`
            INSERT INTO games_catalog
            (id, title, slug, developer, publisher, short_description, full_description, header_image, capsule_image, price_original, price_current, discount_percent, is_free, release_date, steam_deck_status, steam_deck_notes, cozy_score, rating_score, review_count, review_sentiment, categories_json, tags_json, vibes_json, raw_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              short_description = excluded.short_description,
              price_current = excluded.price_current,
              discount_percent = excluded.discount_percent,
              rating_score = excluded.rating_score,
              raw_json = excluded.raw_json,
              updated_at = excluded.updated_at
          `)
          .bind(
            g.id,
            g.title,
            g.slug || g.id,
            g.developer || null,
            g.publisher || null,
            g.shortDescription || null,
            g.fullDescription || null,
            g.headerImage || g.coverImage || null,
            g.capsuleImage || g.coverImage || null,
            g.price?.original || 0,
            g.price?.current || 0,
            g.price?.discountPercent || 0,
            g.price?.isFree ? 1 : 0,
            g.releaseDate || null,
            g.steamDeckStatus || 'Unknown',
            g.steamDeckNotes || null,
            g.cozyScore || null,
            g.ratingScore || null,
            g.reviewCount || 0,
            g.reviewSentiment || null,
            JSON.stringify(g.categories || []),
            JSON.stringify(g.tags || []),
            JSON.stringify(g.vibes || []),
            JSON.stringify(g),
            now,
            now
          )
          .run();
        count++;
      }
      console.log(`✓ Migrated ${count} games to D1.`);
    } catch (err: any) {
      console.error('Error migrating catalog:', err.message);
    }
  }

  // ==========================================================================
  // 5. News Articles Migration
  // ==========================================================================
  const newsFile = path.join(dataDir, 'newsFeed.json');
  if (fs.existsSync(newsFile)) {
    try {
      const articles: any[] = JSON.parse(fs.readFileSync(newsFile, 'utf8'));
      let artCount = 0;
      const now = new Date().toISOString();

      for (const a of articles) {
        await db
          .prepare(`
            INSERT INTO news_articles
            (id, title, summary, content, category, source, source_url, published_at, image_url, author, read_time_minutes, tags_json, related_game_id, related_game_title, gemini_enriched, gemini_summary, gemini_bullets_json, gemini_sentiment, steam_deck_impact, raw_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              summary = excluded.summary,
              raw_json = excluded.raw_json
          `)
          .bind(
            a.id,
            a.title,
            a.summary || '',
            a.content || a.summary || '',
            a.category || 'news',
            a.source || 'Curated',
            a.sourceUrl || a.url || '',
            a.publishedAt || now,
            a.imageUrl || null,
            a.author || null,
            a.readTimeMinutes || 3,
            JSON.stringify(a.tags || []),
            a.relatedGameId || null,
            a.relatedGameTitle || null,
            a.geminiEnriched ? 1 : 0,
            a.geminiSummary || null,
            JSON.stringify(a.geminiBullets || []),
            a.geminiSentiment || null,
            a.steamDeckImpact || null,
            JSON.stringify(a),
            now
          )
          .run();
        artCount++;
      }
      console.log(`✓ Migrated ${artCount} news articles to D1.`);
    } catch (err: any) {
      console.error('Error migrating news:', err.message);
    }
  }

  // ==========================================================================
  // 6. Ingestion State Migration
  // ==========================================================================
  const stateFile = path.join(dataDir, 'ingestionState.json');
  if (fs.existsSync(stateFile)) {
    try {
      const state: any = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      const now = new Date().toISOString();

      for (const key of ['news', 'catalog', 'rankings']) {
        if (state[key]) {
          const s = state[key];
          await db
            .prepare(`
              INSERT INTO ingestion_state
              (key, status, last_run_at, last_success_at, items_processed, new_items_count, updated_items_count, skipped_count, last_error, known_ids_json, content_hashes_json, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET
                status = excluded.status,
                last_run_at = excluded.last_run_at,
                last_success_at = excluded.last_success_at,
                items_processed = excluded.items_processed,
                known_ids_json = excluded.known_ids_json,
                content_hashes_json = excluded.content_hashes_json,
                updated_at = excluded.updated_at
            `)
            .bind(
              key,
              s.status || 'idle',
              s.lastRunAt || null,
              s.lastSuccessAt || null,
              s.itemsProcessed || 0,
              s.newItemsCount || 0,
              s.updatedItemsCount || 0,
              s.skippedCount || 0,
              s.lastError || null,
              JSON.stringify(s.knownIds || []),
              JSON.stringify(s.contentHashes || {}),
              now
            )
            .run();
        }
      }
      console.log('✓ Migrated incremental sync states to D1.');
    } catch (err: any) {
      console.error('Error migrating ingestion state:', err.message);
    }
  }

  console.log('\n🎉 CozyDispatch D1 Database Migration Complete!');
}

migrateData().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
