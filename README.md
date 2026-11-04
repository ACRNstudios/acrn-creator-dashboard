# ACRN Studios Creator Dashboard — Phase 1

A private Next.js dashboard starter for Critter Factory. It includes password-based owner access and a server-side Roblox Open Cloud announcement endpoint. It is not connected to Roblox until you configure the environment variables and install the Roblox listener script.

## Requirements
- Node.js 20.9+
- A GitHub account
- A Vercel account
- Roblox Creator Dashboard access for the Critter Factory experience

## 1. Run locally
1. Install Node.js from https://nodejs.org/
2. Extract this project.
3. Open a terminal in this folder.
4. Run `npm install`.
5. Copy `.env.example` to `.env.local`.
6. Generate an admin password hash:
   `node scripts/make-password-hash.mjs "YOUR-LONG-UNIQUE-PASSWORD"`
7. Put the output into `ADMIN_PASSWORD_HASH` in `.env.local`.
8. Generate a session secret (PowerShell):
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
9. Put that output into `SESSION_SECRET`.
10. Run `npm run dev` and open http://localhost:3000.

## 2. Configure Roblox Open Cloud
Do this only after the dashboard works locally:
1. In Roblox Creator Dashboard, open API Keys and create a dedicated key for Critter Factory.
2. Grant only Messaging Service access and the `universe-messaging-service:publish` operation.
3. Restrict the key to the Critter Factory experience.
4. Copy the Universe ID from the experience's Creator Dashboard page.
5. Put the key in `ROBLOX_API_KEY` and Universe ID in `ROBLOX_UNIVERSE_ID`.
6. Keep the API key out of Roblox scripts, GitHub, chat, screenshots, and browser code.

## 3. Roblox scripts
Two matching scripts are included in `roblox/`:
- `CreatorCommandListener.server.lua` → add as a new Script under ServerScriptService.
- `AnnouncementUI.client.lua` → add as a new LocalScript under StarterPlayer > StarterPlayerScripts.
- Confirm the topic name in the server script matches `ROBLOX_COMMAND_TOPIC` in the website backend.
- The server script creates the RemoteEvent automatically. Do not create a second RemoteEvent with the same name.
- Enable Studio HTTP requests only if your game scripts need outbound HTTP; this listener uses MessagingService and does not need an API key inside the game.
- Test in a private test server first, then publish the scripts before testing against live servers.

## 4. Deploy to Vercel
1. Create a private GitHub repository and upload this project.
2. Import the repository in Vercel.
3. Add all environment variables from `.env.local` in Vercel Project Settings → Environment Variables.
4. Deploy.
5. Use the Vercel production URL to open the private dashboard.

## 5. Server Management
Open **Server Management** in the sidebar, or go to `/servers` (same login as the Overview page).

- **Live data only.** Cards, the server table and server events in Recent activity come from real heartbeats stored in Neon Postgres. There is no demo data; if storage or the secret is missing the page shows **Setup required** instead.
- **Send announcement** quick action uses the existing `POST /api/command` endpoint (same as the Overview form).
- **Schedule announcement** is a disabled preview; nothing is saved or sent.
- There are intentionally **no** shutdown/kick buttons until targeted commands exist and are tested.
- **Region** always shows "Not available": Roblox has no official API for a server's location, and geo-IP workarounds are unreliable.

## 6. Phase 2 — live server monitoring setup

### How it works
```
Roblox server (ACRNServerMonitor.server.lua)
   │  every 30s + on player changes (debounced) + on shutdown
   │  POST /api/roblox/server-heartbeat   Authorization: Bearer <ROBLOX_TELEMETRY_SECRET>
   ▼
Dashboard (Vercel) ── validates ──► Neon Postgres
                                    game_servers               (1 row per server, updated in place)
                                    server_population_samples  (1 row per server per 5 min)
   ▲
   │  GET /api/servers (admin session only), auto-refresh every 15s
Server Management page
```
Health is computed from heartbeat age, never from the server saying it shut down:
**online** ≤ 75s since last heartbeat · **stale** ≤ 180s · **offline** after that (defaults; configurable).

### Step 1 — Create the database (Neon via Vercel)
1. Vercel → your project → **Storage** → **Create Database** → **Neon** (Marketplace). Follow the prompts and connect it to this project for Production and Preview. Vercel adds `DATABASE_URL` automatically.
2. For local work: in the Neon panel on Vercel, open the **.env.local** tab and copy only the `DATABASE_URL` line into your local `.env.local`.
3. Create the tables (run once; safe to re-run):
   `node --env-file=.env.local scripts/db-migrate.mjs`
   Alternatively paste `db/migrations/001_server_monitoring.sql` into the Neon **SQL Editor**.

### Step 2 — Create the telemetry secret
1. Generate it locally (do not share it with anyone, including in chat):
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Vercel → Project Settings → Environment Variables → add `ROBLOX_TELEMETRY_SECRET` with that value (Production and Preview). Also add it to `.env.local` if you run locally.
3. Optional: `SERVER_HEARTBEAT_INTERVAL_SECONDS` (default 30), `SERVER_STALE_AFTER_SECONDS` (75), `SERVER_OFFLINE_AFTER_SECONDS` (180). The heartbeat interval is sent to Roblox servers in each response, so you only change it here.
4. Redeploy so the new variables take effect.

`ROBLOX_UNIVERSE_ID` (already set for announcements) is reused: heartbeats from any other experience are rejected.

### Step 3 — Roblox experience settings
1. Studio → **Game Settings → Security → Allow HTTP Requests: ON**, then save/publish.
2. Creator Hub → Critter Factory → **Secrets** → **Create Secret**:
   - Name: `acrn_telemetry_secret`
   - Value: the same value as `ROBLOX_TELEMETRY_SECRET`
   - Domain: your dashboard domain (e.g. `your-project.vercel.app`). Secrets only work for the domain you set.
3. For Studio play tests, add the same secret under **Game Settings → Security → Secrets** (Studio-only local secrets). In Studio the server reports as a **Studio test** server.

### Step 4 — Install the script
1. Copy `roblox/ACRNServerMonitor.server.lua` into a **new Script** in **ServerScriptService** (a server Script, not a LocalScript; never put it in ReplicatedStorage).
2. Set `ENDPOINT` at the top to `https://<your-dashboard-domain>/api/roblox/server-heartbeat`. Use the production domain: Vercel Deployment Protection blocks preview URLs for anonymous callers such as Roblox. Roblox cannot reach `localhost`.
3. Keep `CreatorCommandListener.server.lua` and `AnnouncementUI.client.lua` as they are; the monitor is independent.
4. Play-test in Studio and check the Output for `[ACRN Monitor] Reporting to dashboard as studio-…`. Then **publish** the place.

### Step 5 — Verify (live test plan)
Run these in order and record the results. None of them have been run against real Roblox servers yet.
1. **Registration:** start a server (join the game). Within ~30s it appears on Server Management as Online, with the correct JobId (compare with the in-game F9 console: `print(game.JobId)`), Place ID, players and capacity.
2. **Heartbeats update in place:** wait two minutes; "Last heartbeat" keeps resetting and the server list does **not** grow. In the Neon SQL Editor: `SELECT job_id, heartbeat_count FROM game_servers;` shows the count increasing on one row.
3. **Player counts:** have a second account join; within ~10–20s the count increases. Leave; it decreases.
4. **Multiple servers:** lower Max Players to 1 temporarily (or use a private server) so two accounts land in different servers; both rows appear with different JobIds and types.
5. **Uptime:** refresh over several minutes; uptime increases.
6. **Stale:** to test without waiting, temporarily disable the Script in a running Studio test (or turn off HTTP); after ~75s the server shows **Stale**.
7. **Offline:** after ~180s it shows **Offline** and disappears from the default "Active" filter. A normal shutdown shows Offline immediately with "reported a graceful shutdown".
8. **Unauthorized heartbeat:** `curl -i -X POST https://<domain>/api/roblox/server-heartbeat -d "{}"` → `401`.
9. **Unauthorized dashboard data:** open `https://<domain>/api/servers` in a private window → `401`.
10. **Announcements:** send one from Overview and one from Server Management → Send announcement; both appear in-game.

### Data, limits and cost
- Each heartbeat is one SQL statement (upsert + history bucket). A server at the default 30s interval produces ~2,900 statements/day; history grows by 288 rows per server per day and is pruned after 30 days. Server rows are pruned 7 days after their last heartbeat.
- Rate limits: one accepted report per server every 5s (excess → 429; the script backs off). Failed requests are retried with exponential backoff (5s → 300s max) and never queued, so a recovering server sends one fresh report rather than a backlog.
- Not yet built: per-server admin commands, persisted announcement history, charts for the stored player-count history (data is collected and returned by `/api/servers` as `history`), multi-game selector (tables are keyed by `universe_id` already), and IP-based rate limiting of unauthenticated requests (consider Vercel Firewall rules for `/api/roblox/*`).

## Important
- Do not commit `.env.local`.
- Do not send anyone your Roblox API key or session secret.
- The login is a single-owner password gate for the initial private dashboard. Add rate limiting and stronger account management before inviting other administrators.
- Roblox MessagingService delivery is best-effort, not guaranteed. Critical gameplay state must not depend on a single message.
