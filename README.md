# Cozy Dispatch

A daily guide to **cozy** and **indie** games on Steam: new releases, deals, upcoming games, Steam Deck status, developer updates and news.

Everything about a game (tags, reviews, prices, release dates, Deck status) comes from Steam's public store APIs and refreshes automatically. Nothing is estimated or invented: if Steam doesn't say, the site says "unknown".

## How it works

```
GitHub Action (every 2–6 h) ──► scripts/sync.ts ──► Steam store APIs + press RSS feeds
                                       │
                                       ▼
                           Cloudflare D1 (cozydispatch-db)
                                       ▲
Browser ──► Cloudflare Pages (static React app) ──► functions/api/[[route]].ts ──► src/server/apiRouter.ts
```

- **Frontend:** React 19, Vite and Tailwind 4 in `src/`. Pages live in `src/pages/` and shared pieces in `src/components/`. Routing is a small History-API router (`src/lib/router.tsx`).
- **API:** `src/server/`, which runs as a Cloudflare Pages Function. It is Workers-safe, with no Node APIs.
- **Database:** Cloudflare D1. The schema is in `d1/migrations/`.
- **Sync:** `src/sync/`, run by `scripts/sync.ts`.
  - **Catalog:** Steam's StoreQuery API, paged by tag and popularity, is the catalog source. Games are classified from their Steam community tags (`src/shared/genres.ts`):
    - **Cozy**: a tag like Cozy, Wholesome, Farming Sim or Life Sim, and nothing like Horror or Gore near the top.
    - **Indie**: tagged Indie by players.
    - **Horror**: only ever shown for indie games.
    - **Quality bar**: 30+ reviews for cozy games and 150+ for indie games. New releases and the most-followed upcoming games are kept regardless.
  - **News:**
    - Press RSS stories are kept only when the headline names a game in the catalog, or is clearly about cozy or indie games.
    - Official developer announcements are pulled for the most popular games.

## Local development

Requires Node 22.5 or newer (for `node:sqlite`).

```bash
npm install
npm run sync      # fill the local database (.data/) from Steam: about 1 minute
npm run dev       # http://localhost:3000
```

`npm run dev` serves the app and the same API router through `server.ts`, using a local SQLite file in place of D1.

| Command | What it does |
| --- | --- |
| `npm run sync -- --target=news` | Refresh only news, or `--target=catalog` for only the catalog |
| `npm test` | Account, newsletter and sync tests (no network) |
| `npm run lint` | Type-check everything |
| `npm run build` | Production build of the frontend into `dist/` |
| `npm run check:functions` | Build the Pages Function the way Cloudflare does |

## Deploying (Cloudflare Pages)

1. **Pages project:** Build command `npm run build`, output directory `dist`. The `wrangler.toml` binds the D1 database as `DB`.
2. **Database:** `cozydispatch-db` already exists, and the schema is applied. For future schema changes, add a file to `d1/migrations/` and run `npm run db:migrate:remote`.
3. **Automatic updates:** The workflow in `.github/workflows/sync.yml` runs every few hours. In GitHub → Settings → Secrets and variables → Actions, add:
   - `CLOUDFLARE_API_TOKEN`: create one in Cloudflare → My Profile → API Tokens, with **Account → D1 → Edit** permission.
   - `CLOUDFLARE_ACCOUNT_ID`: shown in the Cloudflare dashboard sidebar.
   - `D1_DATABASE_ID`: `e8574478-bf2c-4d1c-9873-e83ad3408abe`

   Then open Actions → "Sync games and news" → **Run workflow** once to fill the database straight away.

## Accounts and the newsletter

- **Accounts** use HttpOnly session cookies, and only hashed tokens are stored. Sessions expire after 30 days, and passwords use PBKDF2.
- **Saved games:** Visitors who aren't signed in can still save games in their browser. Those saves move into their account when they sign in.
- **Newsletter:** Double opt-in, through [Resend](https://resend.com).
  - **Before email is switched on:** Signups are stored as *pending*, and the site tells people that emails aren't on yet. Nothing is sent or faked.
  - **To switch email on:**
    1. Verify a domain you own in Resend.
    2. In Cloudflare Pages, set `RESEND_API_KEY` (secret) and `EMAIL_FROM`, e.g. `Cozy Dispatch <hello@yourdomain.com>`.
    3. Set `ADMIN_TOKEN` (secret).
    4. Send confirmations to everyone who signed up while email was off:
       ```bash
       curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" https://<your-site>/api/admin/newsletter/send-pending-confirmations
       ```
  - **Sending an issue:**
    ```bash
    curl -X POST https://<your-site>/api/admin/newsletter/send \
      -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
      -d '{"subject":"This week in cozy","intro":"Hello!\n\nThree new farming sims…","appIds":[413150,2142790]}'
    ```
    `GET /api/admin/newsletter/stats` shows subscriber counts and recent sends.
