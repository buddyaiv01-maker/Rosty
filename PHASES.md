# Rosty — Build Phases

Status legend: ✅ done · 🔧 in progress · ⬜ not started

---

## Phase 0 — Design ✅
Architecture, database schema, folder structure, and this roadmap. See [DESIGN.md](DESIGN.md).

## Phase 1 — Backend Skeleton ✅
Get a bare FastAPI process booting with the data layer wired end to end, nothing content-specific yet.
- Python deps (`requirements.txt`)
- `StorageConfig`: env-var bootstrap + DB-backed settings, resolves `media_root` / `app_data_root` / `cache_root`
- SQLAlchemy models for the full schema (movies, tv_shows, seasons, episodes, subtitles, genres, people, users, playback_progress, media_scan_log, settings)
- `database.py`: engine/session, SQLite at `{app_data_root}/database/rosty.db`
- Alembic wired to that DB + models, baseline migration generated
- `run.py`: creates data dirs, runs `alembic upgrade head`, starts uvicorn
- `/health` endpoint responds; `python run.py` → `http://localhost:8080/health` works

**Exit criteria:** server boots, DB file + tables exist, one endpoint responds.

## Phase 2 — Auth & Profiles ✅
Real login gate, role-based admin access, and Netflix-style profiles — built by bundling in a separate standalone auth service ("Auth") rather than writing Rosty's own signup/OTP/password flow from scratch.
- `login/` — a copy of the standalone Auth app (FastAPI + email OTP + JWT), run as its own process; Rosty's backend never talks to it at request time, just verifies its JWTs locally with a shared secret (`AUTH_JWT_SECRET`)
- JIT user provisioning: the first request from a new Auth account creates a matching local `users` row (`app/auth/deps.py`), linked by `auth_subject`
- `ADMIN_EMAILS` allow-list decides `role` (`admin`/`user`) once at that provisioning step; `require_admin` gates all CMS mutations (movie/show CRUD, uploads, subtitles, scan, settings) while browsing/reading stays open to any logged-in account
- Full login UI ported into the frontend (`pages/auth/`) — register/verify/set-password/login/forgot-password — gating the whole app behind `AuthGate`
- Account deletion (self-service, both Rosty and Auth sides) from Settings and the public nav
- Profiles: up to 5 per account, each with a name + a chosen SVG avatar (`pages/profiles/`), watch data (progress/watchlist/interaction events) scoped per-`profile_id` instead of per-account. A normal account must create its first profile before entering; the picker reappears every login once 2+ exist; admin accounts get one silent, hidden profile and never see any of this UI.

**Exit criteria:** unauthenticated requests to admin routes are rejected; login returns a usable session. — **Verified**: registered real accounts end to end through the browser (OTP → password → session), confirmed `/api/movies` 401s with no token and 403s for a non-admin token on write routes, confirmed the allow-listed admin email gets `role: "admin"` and write access, confirmed per-profile watchlist isolation (two profiles under one account, one item added, only visible under the profile that added it), and confirmed the admin bypass still lets playback/watchlist work via its auto-created hidden profile.

## Phase 3 — Movie CMS (backend + frontend, end to end) ✅
- REST endpoints: create/list/get/update/delete movie, upload poster/backdrop/video, genre + cast + director editing
- Wire the already-built Movies admin UI to these endpoints instead of mock state
- File uploads land under `media_root/Movies/<title>/`, DB row stores the resolved path

**Exit criteria:** a movie added through the CMS is a real row + real files, editable and deletable. — **Verified**: added "Inception" via OMDb autofill, poster fetched and uploaded as a real file (`Movies/Inception/poster.jpg`), edited, deleted (row + files cascaded).

## Phase 4 — TV Show CMS (backend + frontend, end to end) ✅
- REST endpoints: show/season/episode CRUD, episode video/thumbnail upload
- Wire the already-built TV Shows + Show Detail admin UI to these endpoints
- Bonus: OMDb per-episode fetch (title/synopsis/runtime/air date/thumbnail via `&Season=&Episode=`), not just per-show

**Exit criteria:** a show with seasons and episodes, fully manageable from the CMS, backed by real data. — **Verified**: created "Breaking Bad" via OMDb, added 3 seasons, added episode S1E1 with per-episode OMDb fetch (real air date, synopsis, thumbnail uploaded as a real file), confirmed nested structure via the API.

*(Subtitle upload deferred to Phase 5 below, where it belongs.)*

## Phase 5 — Subtitles ✅
- Upload endpoint accepting `.srt`/`.vtt`, arbitrary free-text language
- `.srt` → `.vtt` conversion on ingest (kept alongside the original)
- Subtitle lists nested directly into `MovieRead`/`EpisodeRead` for the player

**Exit criteria:** a movie/episode can carry multiple subtitle tracks in different languages, listed correctly. — **Verified**: uploaded a multi-cue `.srt` to a real episode, confirmed byte-correct `.vtt` conversion on disk, confirmed delete removes both files.

## Phase 6 — Media Library Scanner ✅
- Walk `media_root/Movies` and `media_root/TV Shows`, diff against DB by path (separator-normalized)
- Review queue for unimported files (not silent auto-create) — `GET /api/scan`, nothing written until an explicit import call
- OMDb lookup pre-fills title/year/poster/synopsis/cast (movies) or title/synopsis/runtime/air date/thumbnail (episodes) on import; manual entry stays available always
- `Scan Library` page in the CMS nav, with season/episode guessed from folder + filename patterns (`Season NN`, `SxxExx`)

**Exit criteria:** dropping a new file into the media folder and clicking "Scan" surfaces it for one-click import. — **Verified**: dropped a movie file and an `SxxExx`-named episode file directly on disk, scanned, imported both with real OMDb metadata attached, confirmed re-scan no longer surfaces them.

## Phase 7 — Streaming ✅
- Direct-play: byte-range serving of the original file when the client already supports its codec/container
- Transcode path: FFmpeg → HLS (`.m3u8` + segments), cached under `{cache_root}/hls/{kind}_{id}/`
- `streaming.py` router: `GET /api/stream/movies|episodes/{id}` (direct play), `.../hls/playlist.m3u8` + `.../hls/{segment}` (on-demand transcode, cached after first request)

**Exit criteria:** a movie plays back over HTTP from a second LAN device, both via direct play and via a forced-transcode test file. — **Verified** (FFmpeg installed via winget for this): generated a real synthetic test video, confirmed `Range` requests return correct `206 Partial Content` on direct play, confirmed the HLS endpoint invokes FFmpeg and produces a valid playlist + segment (checked with `ffprobe` — real h264/aac streams), confirmed the second request is served from cache with no re-transcode, and confirmed segment path-traversal is blocked.

*(Not yet done: testing playback from an actual second device on the LAN — this was verified via HTTP requests/ffprobe from the dev machine itself, matching what Phase 8's public player UI will need once it exists to actually play video in a browser.)*

## Phase 8 — Public-Facing Player UI ✅
Home / Movies / TV Shows / Search pages, movie + show detail pages, and the video player (hls.js: play/pause/seek/volume/fullscreen/subtitle+quality menus) — the actual "customer" side of the app, as opposed to `/admin`.
- New routes at `/` (separate from `/admin`): Home (hero + rows), `/movies`, `/tv-shows`, `/search`, `/movie/:id`, `/show/:id`, `/watch/:kind/:id`
- Player: hls.js-driven (native HLS fallback for Safari), custom controls, subtitle track menu (real `<track>` elements from each title's subtitles), a Quality menu that doubles as an HLS/Direct-Play source switch
- `vite.config.ts` now binds `host: true` so the dev server is reachable from other LAN devices, not just localhost

**Exit criteria:** browse → detail → play works end to end from a phone or another PC on the LAN. — **Verified** (from this dev machine; a genuine second-device test is still up to you to try, see note below): Home/Movies/TV Shows/Search all render real data; Movie Detail → Play and Show Detail → Play both launch the player, confirmed via real HLS playlist+segment network requests, video playing to completion, and subtitle track switching to "showing" mode.

*(One real bug found and fixed during verification: the `TVShow` type/mapping was silently missing a `cast` field, causing the public Show Detail page to crash. Also discovered this project's `tsc --noEmit` had been a silent no-op all session due to TS project references — the real command is `tsc -b --noEmit`. Both documented in the session so future work here uses the correct check.)*

## Phase 9 — Playback Progress ✅
- Save position on an interval + on pause/unload
- "Continue Watching" row reads it back on Home

**Exit criteria:** stopping a movie partway through and reopening it resumes at roughly the same spot. — **Verified**: played a test clip to ~24s, paused (triggers save), confirmed `GET /api/progress/movies/{id}` returned the saved position and Home's Continue Watching row picked it up with a progress bar; reopened the player and confirmed it resumed from ~24s instead of 0. Also verified the "restart near the beginning clears progress" guard: seeking back under 15s and pausing deleted the row (404 on GET, gone from Continue Watching) instead of leaving a stale near-zero entry.

*(Originally attributed to a single bootstrapped local user (id 1, still seeded at startup for backward compatibility) since Phase 2 hadn't landed yet — now scoped to the active profile instead, see Phase 2.)*

## Phase 10 — LAN Polish ⬜
- Host/port settings exposed in Admin → Settings, backed by `StorageConfig`
- `docs/FIREWALL.md`: the one `netsh advfirewall` rule for Windows
- Full README: `python run.py` → verified reachable from a second device by LAN IP

**Exit criteria:** a phone on the same Wi-Fi opens `http://<server-LAN-IP>:8080` cold, no prior setup on that device.

## Phase 11 — Search ✅
Basic title search across movies + shows, surfaced in the public UI nav.
- `PillNav` (in `PublicLayout.tsx`) has an expandable search icon that submits to `/search?q=`
- `pages/public/Search.tsx`: client-side, case-insensitive substring match against the already-loaded library (`LibraryContext`) — no dedicated backend endpoint needed at this scale. Query stays synced to the URL (`?q=`), results grouped into Movies/TV Shows sections, empty state for no matches, and a debounced `search` interaction event logged for the future recommendation engine (see RECOMMENDATIONS.md)

**Exit criteria:** typing a query surfaces matching movies/shows. — **Verified**: created two real titles ("Search Test Alpha" movie, "Search Test Beta Show" series), confirmed a query matching only one type returns just that section, a broader query matching both returns both sections grouped correctly, and profile persistence (Phase 2) means a deep link to `/search?q=...` survives a reload without re-prompting for a profile.

*(This one was actually already built — appears to have landed naturally as part of Phase 8's public UI work — just never got marked done here.)*

## Phase 12 — Mini PC Migration ⬜
- `docs/MINI_PC_DEPLOYMENT.md`: Linux setup, systemd unit, path layout (`/opt/rosty`, `/mnt/media`)
- Verify: same DB (or migrate SQLite → Postgres using the existing Alembic migrations), same app code, only `settings`/env values change
- Confirm external HDD/DAS mount survives reboot and is what `media_root` points to

**Exit criteria:** the exact same codebase, freshly deployed on the Mini PC, serves the same library with no code changes.

---

## Deliberately deferred (not V1)
Payments, public subscriptions, CDN, cloud storage, social features, recommendations, AI features, ads, multi-region infra, Kubernetes, Docker-as-a-requirement, adaptive multi-rendition ABR (single practical quality rung is enough until direct play + basic HLS are solid).
