# Rosty — Architecture

Three independent processes, each on its own port, run together to make up
the app. This is a topology overview; see [DESIGN.md](DESIGN.md) for the
database schema and per-feature design detail.

## Topology

```
                     LAN (any device, same network)
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│  Frontend — React + Vite, port 5185                         │
│  (dev: Vite dev server / prod: static build behind a        │
│  static file server, see docs/MINI_PC_DEPLOYMENT.md)        │
└───────────────┬───────────────────────────────┬─────────────┘
                 │ /api/*                        │ /auth/*
                 ▼                                ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│  Backend — FastAPI, port 8090  │   │  Auth service — FastAPI,      │
│  (default 8080, DB-overridable)│   │  port 8001                     │
│                                 │   │                                 │
│  movies / tv_shows / seasons    │   │  register / login / OTP        │
│  streaming (HLS + direct play)  │   │  set-password / forgot-password│
│  playback_progress / watchlist  │   │  issues + signs JWTs           │
│  scan (library import)          │   │  (login/server/)                │
│  hero banner, settings          │   └──────────────┬──────────────────┘
│  (backend/)                     │                  │
└───────────────┬─────────────────┘                  │
                 │                                     │
                 ▼                                     ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│  SQLite — rosty.db              │   │  SQLite — auth.db              │
│  {app_data_root}/database/       │   │  login/server/auth.db          │
└───────────────────────────────┘   └───────────────────────────────┘
                 │
                 ▼
┌───────────────────────────────┐
│  Media storage (movies/shows)   │
│  {media_root}, can be a           │
│  separate physical drive         │
└───────────────────────────────┘
```

## The trust boundary: one shared secret, no runtime coupling

The backend and the auth service **never call each other synchronously on
the request path that matters for verifying a logged-in user**. The auth
service issues JWTs signed with `JWT_SECRET`; the backend holds the same
value as `AUTH_JWT_SECRET` and decodes tokens locally
(`backend/app/auth/security.py`). This is the one fact that has to stay
true for login to work at all — if the two secrets drift, every existing
session breaks silently with 401s.

The one exception: on a user's *first* request after registering, the
backend calls the auth service's `/auth/me` once to learn their email (for
matching against `ADMIN_EMAILS`) — see `fetch_auth_email` in the same file.
Every request after that is fully local.

Two independent SQLite databases exist for a reason: `auth.db` (identity —
email, password hash, OTP state) and `rosty.db` (everything else — movies,
watch history, profiles). A user row in `rosty.db` is created just-in-time
on first contact, linked to the auth service's user id via `auth_subject`
(`backend/app/auth/deps.py`). Deleting an account deletes both rows
independently (see `frontend/src/state/AuthContext.tsx`'s `deleteAccount`).

## Why CORS is wide open on both services

Both FastAPI apps set `allow_origins=["*"]`. This is deliberate, not an
oversight — see [SECURITY.md](SECURITY.md) for the full reasoning.

## Documentation split

This file is the source of truth for topology (how the three processes
are wired together). DESIGN.md §3 now points here instead of duplicating
the diagram; DESIGN.md remains the source of truth for the database
schema and per-feature rationale (§4 onward).
