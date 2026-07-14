# HusAI — Live Call Coach for Filipino VAs

*"Husay" is Filipino for skill/finesse — HusAI sharpens it in real time.*

Two AI features, two clients, one codebase:

- **The Lifeline** — when the client goes silent for ~4 seconds mid-call, you instantly get 3 suggestions for what to say next.
- **The Review** — after the call, the transcript is analyzed for communication patterns (over-apologizing, buried leads, over-hedging…) and turned into personalized roleplay exercises.
- Ships as a **web app** (Chrome/Edge) and a **desktop app** (Windows `.exe` + macOS `.dmg`) from the same React frontend.

Everything runs on free tiers: Groq (`llama-3.1-8b-instant` + `whisper-large-v3-turbo`), Gemini (`gemini-3.5-flash`), Render/Railway (backend), Vercel/Netlify (web). **No credit card needed anywhere.**

---

## Local dev setup (~10 minutes)

### 0. Prerequisites

- [Node.js 18+](https://nodejs.org) (LTS recommended)
- Chrome or Edge (web transcription uses the Web Speech API — Chromium-only)

### 1. Get your free API keys (no card required)

| Key | Where | Notes |
|---|---|---|
| `GROQ_API_KEY` | https://console.groq.com/keys | Sign up → Create API Key |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | Sign in with Google → Create API key |

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env         # then paste your two keys into .env and set JWT_SECRET
npx prisma migrate dev       # creates the local SQLite database (dev.db)
npm run dev                  # → http://localhost:3001
```

The backend is TypeScript (`src/`), run with `tsx` in dev and compiled with `tsc` for deploys (`npm run build && npm start`). The local database is SQLite via Prisma; for deploys, switch the Prisma provider to `postgresql` and point `DATABASE_URL` at a free hosted Postgres (e.g. Neon).

Sanity check: open http://localhost:3001/api/health — you should see `{"status":"ok", ...}` with quota counters.

> **No keys yet?** The backend runs in **mock mode** for any missing key — lifeline/review return canned responses so you can build UI without burning quota.

### 3. Frontend (web)

```bash
cd frontend
npm install
npm run dev             # → http://localhost:5173 (proxies /api to :3001)
```

Open http://localhost:5173 in **Chrome**, click **Start Call**, allow the mic, and talk. Stop talking for 4 seconds → the Lifeline card appears. Click **End Call** → the Review dashboard loads.

### 4. Desktop app (dev mode)

The desktop build uses **Groq Whisper** for transcription instead of the Web Speech API (Electron's Chromium has no speech backend — this is structural, not a bug). Transcript updates arrive in ~60-second chunks.

```bash
# with backend (:3001) and frontend dev server (:5173) already running:
cd desktop
npm install
npm run dev             # opens the Electron shell pointed at the dev server
```

---

## Deploying the alpha

### Backend → Render or Railway (free tier)

1. Push this repo to GitHub.
2. Create a new web service from `backend/`, start command `npm start`.
3. Set env vars: `GROQ_API_KEY`, `GEMINI_API_KEY`, and `FRONTEND_ORIGIN` (your web app URL).
4. Note the public URL (e.g. `https://husai-backend.onrender.com`).

> Render's free tier sleeps after ~15 min idle — the first request after a sleep takes ~30–60s. Acceptable for the alpha; a teammate can hit `/api/health` before demo sessions to warm it.

### Web app → Vercel or Netlify (free tier)

1. Import the repo, set the project root to `frontend/`.
2. Build command `npm run build`, output `dist`.
3. Set env var `VITE_API_BASE_URL` to the backend URL from above.

### Desktop builds → GitHub Actions (free minutes)

Nobody on the team needs a Mac. The workflow at `.github/workflows/build-desktop.yml` builds the Windows `.exe` on a `windows-latest` runner and the macOS `.dmg` on `macos-latest`:

1. In the GitHub repo, set a **repository variable** `VITE_API_BASE_URL` = your deployed backend URL (Settings → Secrets and variables → Actions → Variables).
2. Trigger it from the Actions tab (**Run workflow**) or push a tag like `v0.1.0`.
3. Download `HusAI-windows` / `HusAI-macos` from the run's artifacts and share with testers.

To build locally instead (produces only your own OS's installer):

```bash
cd frontend && VITE_API_BASE_URL=https://your-backend.onrender.com npm run build
cd ../desktop && npm run dist:win    # or dist:mac on a Mac
```

---

## Installing the desktop app (for testers — no dev skills needed)

The alpha builds are **unsigned** (code-signing certificates cost money we deliberately didn't spend). Your OS will warn you — this is expected. Only install builds you received directly from the HusAI team.

**Windows:** run the `.exe`. When SmartScreen shows "Windows protected your PC", click **More info** → **Run anyway**. Then check Settings → Privacy & security → Microphone → "Let desktop apps access your microphone" is **On**.

**macOS:** open the `.dmg`, drag HusAI to Applications. On first launch, **right-click the app → Open → Open** (double-clicking will just show "unidentified developer"). If it still refuses, run in Terminal:

```bash
xattr -cr /Applications/HusAI.app
```

macOS will ask for microphone permission on first call — click Allow.

---

## Architecture notes for teammates

```
frontend/   React (Vite) — ONE build serves both web and the Electron renderer
backend/    Express + TypeScript — proxies ALL AI calls; API keys live ONLY here (.env)
            src/modules/ (lifeline, transcribe, review, auth, users)
            src/providers/ (swappable STT + LLM clients), src/ws/ (JWT-authed WebSocket hub)
            Prisma + SQLite locally / Postgres in deploys; JWT auth (email+password)
desktop/    Electron wrapper only — no app logic, just shell + preload + packaging
```

- **Platform detection:** the Electron preload exposes `window.electronAPI.isDesktop`; `usePlatform()` returns `'web'` or `'desktop'`.
- **Transcription:** web = Web Speech API (free, in-browser, auto-restart wrapper included); desktop = MediaRecorder → `/api/transcribe` → Groq Whisper in rolling 60s chunks.
- **Silence detection is STT-independent:** a Web Audio `AnalyserNode` amplitude VAD on the raw mic stream fires the Lifeline identically on both platforms (4s silence, 8s debounce).
- **Security:** API keys never reach either client. An Electron `.asar` is trivially unpacked, so a key baked into the desktop app would be public the moment it ships — both clients talk to the same hosted backend over HTTPS instead.
- **Free-tier quotas are org-wide, not per user.** The backend's `quotaGuard` middleware counts today's calls per provider and returns a graceful "at capacity" message at ~90% of each cap (configurable in `.env`). Every external call is logged to `backend/logs/api-calls.log` (JSONL, includes platform) for post-alpha analysis.
- **Desktop costs far more Groq quota than web** (web transcribes in-browser for free; desktop burns ~30 Whisper requests per 30-min call). During the alpha, nudge testers to the web app by default and treat desktop as the lower-volume option.

## Free-tier quota cheat sheet (as of July 2026)

| Provider / model | Free limit | Our guard cap (90%) |
|---|---|---|
| Groq `llama-3.1-8b-instant` (Lifeline) | 14,400 req/day, 30 req/min | 12,960/day |
| Groq `whisper-large-v3-turbo` (desktop STT) | 2,000 req/day, 7,200 audio-sec/hr | 1,800/day |
| Gemini `gemini-3.5-flash` (Review) | ~250 req/day (unpublished) | 225/day |

Check remaining quota anytime: `GET /api/health`.
