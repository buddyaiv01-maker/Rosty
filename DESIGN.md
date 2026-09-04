# Rosty — Self-Hosted LAN Streaming Platform

Design doc for V1. Written before any implementation, per the project brief's own instruction.

## 1. What this is

A personal, self-hosted Netflix-style server for movies and TV shows, built to run first on a
Windows dev machine and later move onto a headless Mini PC — same app, no rewrite, just a change
of storage paths and OS.

**Not in scope for V1:** public internet access, payments, CDN, cloud storage, social features,
recommendations, AI, ads, multi-region, Kubernetes, Docker-as-a-requirement. This is a LAN
appliance, not a SaaS product. Every design decision below optimizes for "works reliably on a
home network with zero ongoing maintenance," not for scale.

## 2. Core design constraint: storage is not app-adjacent

The single requirement that shapes the whole architecture: **the media library and the
application must be able to live on physically different drives**, and that mapping must be
config, not code.

```
App Drive (SSD/NVMe)              Media Drive (external HDD/SSD/DAS)
C:\StreamingServer\                D:\Media\
  app\                               Movies\
  database\                          TV Shows\
  cache\
  thumbnails\
  logs\
```

On the Mini PC this becomes `/opt/rosty/` + `/mnt/media/` — same app, different paths, read
from one `.env` / settings row. This is why the backend never hardcodes a path: every file
operation goes through a `StorageConfig` service that resolves `media_root`, `app_data_root`, and
`cache_root` from settings (env var at boot, overridable later from the Admin UI, persisted to DB
so it survives restarts).

## 3. Recommended architecture

```
┌─────────────┐      ┌──────────────┐      ┌───────────────────────┐
│  Frontend   │ ───▶ │   REST API   │ ───▶ │        Backend        │
│ React + TS  │      │  (FastAPI)   │      │                        │
└─────────────┘      └──────────────┘      │  auth                  │
                                            │  movies                │
                                            │  tv_shows               │
                                            │  seasons / episodes     │
                                            │  subtitles              │
                                            │  media_library (scanner)│
                                            │  streaming (HLS)         │
                                            │  playback_progress       │
                                            └──────────┬─────────────┘
                                                        │
                                         ┌──────────────┼──────────────┐
                                         ▼                              ▼
                                  ┌─────────────┐              ┌───────────────┐
                                  │  Database    │              │ Media Storage │
                                  │ SQLite → PG  │              │ (movies/shows)│
                                  └─────────────┘              └───────────────┘
```

- **Backend:** Python + FastAPI. Chosen because it pairs naturally with `ffmpeg-python`/subprocess
  calls for transcoding, has first-class async support for streaming responses, and auto-generates
  OpenAPI docs which double as a contract for the frontend during solo development.
- **Database:** SQLite for V1 (zero-setup, file-based, trivial to back up — just copy one file).
  All access goes through SQLAlchemy models + Alembic migrations from day one, so the swap to
  PostgreSQL later is a connection-string change plus running the same migrations against Postgres,
  not a rewrite.
- **Frontend:** React + TypeScript, built as a static bundle the FastAPI backend serves directly
  (one process, one port, no separate frontend server to keep alive on the Mini PC).
- **Video pipeline:** FFmpeg for transcode-on-demand → HLS (`.m3u8` + `.ts` segments). Direct play
  (byte-range serving of the original file) is used whenever the client's `Accept`/codec support
  makes transcoding unnecessary — avoids burning CPU on a Mini PC for files that would just play
  natively.
- **Reverse proxy:** not present in V1. The FastAPI process binds directly to the LAN interface.
  The `StorageConfig`/settings layer is structured so Caddy or Nginx can be dropped in front later
  (e.g., for HTTPS on the LAN) without touching application code.

## 4. Database schema (V1)

SQLite/SQLAlchemy, one file at `{app_data_root}/database/rosty.db`.

```
users
  id            INTEGER PK
  username      TEXT UNIQUE NOT NULL
  password_hash TEXT NOT NULL
  role          TEXT NOT NULL   -- 'admin' | 'user'
  created_at    DATETIME

movies
  id            INTEGER PK
  title         TEXT NOT NULL
  poster_path   TEXT
  backdrop_path TEXT
  synopsis      TEXT
  release_year  INTEGER
  runtime_min   INTEGER
  language      TEXT
  director      TEXT
  age_rating    TEXT
  video_path    TEXT NOT NULL        -- absolute path under media_root
  date_added    DATETIME
  created_at    DATETIME
  updated_at    DATETIME

movie_genres            -- movie <-> genre, many-to-many
  movie_id      INTEGER FK -> movies.id
  genre_id      INTEGER FK -> genres.id

movie_cast               -- movie <-> cast member, many-to-many, ordered
  movie_id      INTEGER FK -> movies.id
  person_id     INTEGER FK -> people.id
  role_order    INTEGER

genres
  id            INTEGER PK
  name          TEXT UNIQUE

people                    -- shared by cast + directors + creators
  id            INTEGER PK
  name          TEXT

tv_shows
  id            INTEGER PK
  title         TEXT NOT NULL
  poster_path   TEXT
  backdrop_path TEXT
  synopsis      TEXT
  release_year  INTEGER
  language      TEXT
  age_rating    TEXT
  creator       TEXT
  date_added    DATETIME
  created_at    DATETIME
  updated_at    DATETIME

show_genres               -- same pattern as movie_genres
show_cast                 -- same pattern as movie_cast

seasons
  id            INTEGER PK
  show_id       INTEGER FK -> tv_shows.id
  season_number INTEGER NOT NULL
  UNIQUE(show_id, season_number)

episodes
  id            INTEGER PK
  season_id     INTEGER FK -> seasons.id
  episode_number INTEGER NOT NULL
  title         TEXT
  synopsis      TEXT
  thumbnail_path TEXT
  runtime_min   INTEGER
  video_path    TEXT NOT NULL
  air_date      DATE
  created_at    DATETIME
  updated_at    DATETIME
  UNIQUE(season_id, episode_number)

subtitles
  id            INTEGER PK
  -- exactly one of movie_id / episode_id is set
  movie_id      INTEGER FK -> movies.id NULL
  episode_id    INTEGER FK -> episodes.id NULL
  language      TEXT NOT NULL     -- free text, e.g. "Tamil" — not an enum, per spec
  format        TEXT NOT NULL     -- 'srt' | 'vtt'
  file_path     TEXT NOT NULL

playback_progress
  id            INTEGER PK
  user_id       INTEGER FK -> users.id
  movie_id      INTEGER FK -> movies.id NULL
  episode_id    INTEGER FK -> episodes.id NULL
  position_sec  INTEGER NOT NULL
  duration_sec  INTEGER NOT NULL
  completed     BOOLEAN NOT NULL DEFAULT 0
  updated_at    DATETIME
  UNIQUE(user_id, movie_id, episode_id)

media_scan_log
  id            INTEGER PK
  scanned_at    DATETIME
  files_found   INTEGER
  new_items     INTEGER
  errors        TEXT             -- JSON list of problem paths

settings
  key           TEXT PK           -- 'media_root', 'app_data_root', 'server_port', 'server_host', ...
  value         TEXT
```

Genres/cast/people are normalized into their own tables (rather than comma-separated strings)
specifically so the CMS "Add genre" / "Add cast" flows are real relational operations — you can
rename a person once and it updates everywhere, and filtering "all movies with this actor" is a
join, not a string search.

## 5. Folder structure

```
Rosty/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, mounts routers + static frontend
│   │   ├── config.py                # StorageConfig: resolves media_root/app_data_root from settings
│   │   ├── database.py              # SQLAlchemy engine/session (swappable SQLite→Postgres)
│   │   ├── models/                  # SQLAlchemy models (one file per table group above)
│   │   ├── schemas/                 # Pydantic request/response models
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── movies.py
│   │   │   ├── tv_shows.py
│   │   │   ├── subtitles.py
│   │   │   ├── media_library.py     # scan/re-scan endpoints
│   │   │   ├── streaming.py         # HLS playlist + segment + direct-play byte-range serving
│   │   │   └── playback.py          # progress get/set
│   │   ├── services/
│   │   │   ├── scanner.py           # walks media_root, diffs against DB, reports new files
│   │   │   ├── transcoder.py        # ffmpeg subprocess wrapper, HLS segment generation + cache
│   │   │   └── metadata_provider.py # optional online lookup (title/year → poster/synopsis/cast)
│   │   └── auth/                    # password hashing, session/JWT handling
│   ├── alembic/                     # migrations (SQLite now, same migrations run on Postgres later)
│   ├── requirements.txt
│   └── run.py                       # `python run.py` == the "start-server" command
│
├── frontend/
│   ├── src/
│   │   ├── pages/                   # Home, Movies, TVShows, Search, MovieDetail, ShowDetail, Player, Admin/*
│   │   ├── components/
│   │   ├── api/                     # typed fetch client generated/hand-written against the OpenAPI schema
│   │   └── player/                  # hls.js wrapper: play/pause, seek, subtitle track switch, quality menu
│   ├── package.json
│   └── vite.config.ts
│
├── docs/
│   ├── WINDOWS_SETUP.md
│   ├── MINI_PC_DEPLOYMENT.md
│   └── FIREWALL.md                  # Windows Firewall rule for LAN access to the bound port
│
└── README.md
```

At runtime, `app_data_root` (database, cache, thumbnails, logs) and `media_root` (Movies/TV Shows)
are two independent paths read from `settings` — nothing under `backend/` ever assumes media lives
next to the code.

## 6. Streaming pipeline

```
request for /stream/movie/{id}
        │
        ▼
Can the requesting client's declared support (container/codec) play the source file directly?
        │                                   │
       yes                                  no
        │                                   │
        ▼                                   ▼
Byte-range serve original file      FFmpeg transcodes to HLS on first request,
via FastAPI StreamingResponse       caches .m3u8 + .ts segments under
(direct play, ~0 CPU cost)          {cache_root}/hls/{movie_id}/
                                     Subsequent requests for the same title reuse the cache.
```

V1 targets a single practical rung (source quality, roughly capped for reasonable LAN Wi-Fi) with
direct play as the common case; the `transcoder.py` service is written so 1080p/720p/480p renditions
and adaptive bitrate switching are additive later — same interface, more output variants — rather
than a redesign.

## 7. Subtitle handling

- `.srt` and `.vtt` accepted; `.srt` is converted to `.vtt` on ingest (browsers' native `<track>`
  only understands VTT) and the original is kept for reference.
- `language` is a free-text field on the `subtitles` row, not an enum — the CMS lets you type
  anything ("Tamil", "Malayalam", a dialect name, whatever). The player just lists whatever
  subtitle rows exist for that title.
- A movie/episode can have any number of subtitle rows; the player's subtitle menu is built from
  that list at request time.

## 8. CMS / Admin

Server-rendered-data, client-driven React admin at `/admin`, gated by the `admin` role from
`users`. Covers, 1:1 with the brief:

- **Dashboard:** counts (movies, shows, seasons, episodes), storage used/available on `media_root`
  (via `shutil.disk_usage`), recently added.
- **Movie management:** create/edit/delete, poster/backdrop/video upload, metadata + genre + cast +
  director editing, subtitle upload, video replace/remove, trigger re-scan.
- **TV show management:** create/edit/delete show → season → episode, per-episode video/thumbnail/
  subtitle upload.
- **Media scanner:** walks `media_root/Movies` and `media_root/TV Shows`, diffs against what's in
  the DB by path, surfaces unimported files in a review queue rather than silently auto-creating
  entries with empty metadata. Optional metadata-provider lookup (by title/year guessed from the
  filename) pre-fills poster/synopsis/cast/genres for one-click confirm; manual entry always stays
  available as a fallback/override.

## 9. LAN & auth requirements

- Server binds to `0.0.0.0` (or a configured LAN-facing IP) on a configurable port — default
  `8080`, changeable from `settings`.
- No cloud dependency anywhere in the request path; no internet access required for playback once
  media/metadata already exist locally.
- Local auth only: password hash + session cookie (or JWT) issued by `auth.py`. `/admin` requires
  the `admin` role; `/login` is the plain-user entry point. No OAuth providers.
- `docs/FIREWALL.md` documents the one `netsh advfirewall` rule needed to open the chosen port to
  the LAN on Windows.

## 10. Dev → Mini PC migration path

| | Development (now) | Mini PC (later) |
|---|---|---|
| App data | `C:\StreamingServer\` | `/opt/rosty/` |
| Media | `D:\Media\` | `/mnt/media/` (external SSD/DAS) |
| DB | SQLite file | SQLite file (or Postgres, same Alembic migrations) |
| Start command | `python run.py` | `systemd` unit running the same `run.py` |
| Config change | none in code — two path values in `settings` |

Nothing in `backend/app` reads an OS-specific path; every path comes from `StorageConfig`, which
reads `settings` at boot and falls back to environment variables (`ROSTY_MEDIA_ROOT`,
`ROSTY_APP_DATA_ROOT`) if the DB doesn't have them yet (first-run bootstrap).

## 11. V1 roadmap (build order)

Matches the brief's stated priority order:

1. Backend skeleton: FastAPI app, SQLAlchemy models, Alembic baseline migration, `StorageConfig`.
2. Auth: local users table, login, admin-role gate.
3. Movie CRUD + file upload (poster/backdrop/video) + genre/cast/director editing — the CMS's core
   loop, end to end, for one content type first.
4. TV show → season → episode CRUD, mirroring the movie flow.
5. Subtitle upload + `.srt`→`.vtt` conversion + per-title subtitle list endpoint.
6. Media library scanner (read-only diff + review queue).
7. Streaming: direct-play byte-range serving first (simplest, works immediately), then FFmpeg→HLS
   transcode path with on-disk caching.
8. Frontend: Home/Movies/TV Shows/Search pages, movie detail, show detail (season/episode
   accordion), video player (hls.js: play/pause/seek/volume/fullscreen/subtitle menu).
9. Playback progress: save on interval + on pause/unload, "Continue Watching" row reads it back.
10. LAN polish: bind-address/port settings UI, Windows Firewall doc, README with the
    `start-server` → `http://<LAN-IP>:8080` flow verified from a second device.

Search and metadata-provider auto-fill are useful but explicitly ride along after #7–9 are solid,
per "do not over-engineer V1."
