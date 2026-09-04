# LANStream — Recommendation System (future work)

Not in scope for V1 (see [DESIGN.md](DESIGN.md)). This doc exists so that when the time comes,
the data has already been collecting for months instead of starting from zero. It captures the
schema decisions made now specifically to make that possible, and a phased plan for turning that
data into actual recommendations after the first deployed version has been running for a while.

## Why start now instead of later

A recommender is only as good as its training data, and training data can't be backfilled —
if `interaction_events` doesn't exist yet, there is no way to later reconstruct "what did the
household actually watch in March." So the schema below ships in V1 even though the model that
consumes it doesn't. The cost is one extra table and a couple of `INSERT`s in already-existing
endpoints; the alternative is re-collecting six months of behavior from scratch.

## What already exists (as of this doc)

LANStream's schema already covers more of this than it looks like at first glance:

| Need | Table | Status |
|---|---|---|
| Item catalog | `movies`, `tv_shows`, `seasons`, `episodes` | ✅ done (Phase 3/4) |
| Genre / cast metadata | `genres`, `people`, `movie_genres`/`show_genres`, `movie_cast`/`show_cast` | ✅ done |
| Watch progress + completion | `playback_progress` | ✅ done (Phase 9) — `position_sec`, `duration_sec`, `completed` |
| Explicit save-for-later signal | `watchlist_items` | ✅ done |
| Raw event log ("the gold mine") | `interaction_events` | ✅ table + partial logging added alongside this doc |
| Users | `users` | ⚠️ exists but single hardcoded row (`DEFAULT_USER_ID`) until Phase 2 auth ships — see caveat below |
| Ratings (explicit 1–5 stars) | — | ❌ not built, no UI for it yet |
| Sessions / watch sequences | — | ❌ not built, `session_id` column exists on `interaction_events` but nothing populates it yet |

### The single-user caveat

Phase 2 (auth) is deliberately deferred — right now every row in this database belongs to one
bootstrapped `DEFAULT_USER_ID`. That has a real consequence for this plan: **classic
user-to-user collaborative filtering needs many users to work at all**, and a single household
watching from one shared login won't produce that. The realistic path here is:

- **Content-based filtering** (genre/cast/language overlap) works today, with zero interaction
  data, and doesn't care how many users there are.
- **Sequence-based / "watch next"** modeling (what usually follows what, from `session_id` +
  `created_at` ordering) works with one household's data and gets better the longer the app runs.
- **Collaborative filtering** only becomes meaningful once Phase 2 ships real per-person profiles
  (so "you and your sibling have similar taste" becomes a real signal instead of a null set).

So the plan below is ordered by what's achievable now, not by ML sophistication.

## Schema: `interaction_events`

The raw event log. Deliberately schemaless-ish (a free-form `event_metadata` text column) so new
event types don't require a migration every time. One row per event, never updated, never
deleted except by cascade when the underlying user/movie/show/episode is deleted.

```
interaction_events
────────────────────────────
id                  PK
user_id             FK → users.id
movie_id            FK → movies.id, nullable
episode_id          FK → episodes.id, nullable
show_id             FK → tv_shows.id, nullable   -- for show-level events (e.g. watchlisting a series)
event_type          string, indexed              -- see table below
position_sec        int, nullable                -- playback position at event time
duration_sec        int, nullable                -- total duration, if known
session_id          string, nullable, indexed     -- groups events into one sitting (not populated yet)
event_metadata       text, nullable                -- free-form JSON: search query, etc.
created_at           datetime, indexed
```

No `CHECK` constraint tying it to exactly one content item — unlike `playback_progress` and
`watchlist_items`, some event types are content-less (a search query isn't "about" a movie until
the user clicks a result), so `movie_id`/`episode_id`/`show_id` can all be null.

### Event types

| event_type | Currently logged? | Where |
|---|---|---|
| `watch_progress` | ✅ | every `PUT /api/progress/...` save (Player heartbeat/pause/unmount) |
| `complete` | ✅ | first `PUT` that crosses the 95%-watched threshold |
| `add_to_watchlist` / `remove_from_watchlist` | ✅ | watchlist router |
| `play` / `pause` / `stop` | ❌ future | needs explicit `Player.tsx` instrumentation — right now only the *result* of playback (progress) is captured, not the individual transport actions |
| `search` | ❌ future | `Search.tsx` — log query text (in `event_metadata`) + whether it produced a click |
| `click` | ❌ future | poster-card click-through, useful for "shown but not watched" signal |
| `skip` | ❌ future | position jumps larger than a normal seek, or abandoning under ~30s |
| `rewatch` | ❌ future | a `watch_progress` sequence starting near 0 again after a prior `complete` for the same item |
| `like` / `dislike` | ❌ future | no UI for this yet — see Ratings below |

## Schema: `ratings` (not yet built)

```
ratings
────────────────
id           PK
user_id      FK → users.id
movie_id     FK → movies.id, nullable
show_id      FK → tv_shows.id, nullable
rating       int (1–5)
created_at   datetime
```

Deliberately not built in this pass — there's no UI trigger for it, and per the design principle
above, explicit ratings are a *weaker* signal than watch-to-completion behavior anyway. Worth
adding once there's a natural UI moment to ask for it (e.g. a prompt after `complete`), not before.

## Schema: `playback_sessions` (not yet built)

```
playback_sessions
────────────────
id            PK
user_id       FK → users.id
started_at    datetime
ended_at      datetime, nullable
```

`interaction_events.session_id` already has a column reserved for this — once the frontend
generates a UUID per app-open (or per Player mount) and threads it through the existing
`saveMovieProgress`/`saveEpisodeProgress` calls, sessions can be reconstructed with a `GROUP BY
session_id` over the existing event log without a schema change. The dedicated table above is an
optional later convenience (precomputed start/end), not a prerequisite.

## What this does *not* need, and why

The original design sketch this doc is based on suggested tracking device type and geolocation.
Both are cut here on purpose:

- **Device type** — LANStream is one app on one LAN; there's no meaningful "mobile vs. TV app"
  behavioral split to learn from the way a multi-platform streaming service would have.
- **Location** — this is a self-hosted appliance on a home network. There is no legitimate
  recommendation use for it, and collecting it would be pure privacy liability for zero benefit.

If either ever becomes relevant, `event_metadata`'s free-form JSON column can absorb it without a
migration — no need to reserve schema space for it speculatively now.

## The phased plan

### Phase R0 — data collection (this pass)
`interaction_events` table exists, `watch_progress`/`complete`/`watchlist` events flow from
endpoints that already existed. No user-facing change. Goal: have *something* to train on by the
time R2 starts.

### Phase R1 — finish instrumentation
- Wire `session_id` generation into the Player and thread it through progress saves.
- Add `play`/`pause`/`stop`/`skip` events directly in `Player.tsx`'s existing event listeners
  (the hooks are already there from Phase 9 — `onPlay`/`onPause`/etc. — this is "also POST an
  event" next to the state updates that already happen).
- Log `search` events from `Search.tsx` and `click` events from `PosterCard`.
- Detect `rewatch` server-side: a new `watch_progress` near 0 for a movie/episode that already has
  a `complete` event in its history.

### Phase R2 — heuristic recommendations (no ML)
Ships value immediately, entirely from data already in the schema:
- **"Because you watched X"**: other titles sharing genres/cast/director with anything the
  household completed or rated highly, filtered to what's already in the library.
- **"Continue the story"**: next unwatched episode in a show with recent activity (this already
  exists as Continue Watching — R2 extends it to cross-show suggestions when a show is finished).
- **Popularity/recency fallback**: most-played titles in the last N days, for the cold-start case
  (empty history, e.g. right after a fresh install).

This alone covers most of what a home streaming app needs and requires zero training
infrastructure — it's a scored SQL query, not a model.

### Phase R3 — sequence-aware "watch next"
Once `session_id` has been collecting for a while: mine `session_items`-style sequences (via
`GROUP BY session_id ORDER BY created_at`) for "people who watched A in a session often watch B
next." Still not ML in the traditional sense — co-occurrence counting — but meaningfully better
than pure content similarity because it captures actual behavior, not just metadata overlap.

### Phase R4 — real ML, once there's enough data
Only worth doing once `interaction_events` has enough volume to be worth the operational cost of
a training pipeline (rough rule of thumb: thousands of events, not hundreds). At that point:
- Export flow: `interaction_events` + `playback_progress` + catalog metadata → a feature table
  shaped like `user_id, movie_id, watch_pct, completed, liked, rewatched, days_since, genre_match`
  → train offline (start with something like implicit-feedback matrix factorization or a
  gradient-boosted ranker — LightFM and similar libraries handle the "mostly implicit signal,
  little explicit rating" situation described above well).
- Serve as a scheduled batch job (score all titles per user nightly, cache the ranked list) rather
  than real-time inference — there's no latency requirement here that justifies an online model
  server on a home LAN box.
- Prototype against MovieLens 1M first to validate the pipeline mechanics before pointing it at
  LANStream's own (much smaller) real dataset.

### Phase R5 — surfacing it
A `/api/recommendations` endpoint + a "Recommended for You" row on Home, same shape as the
existing Continue Watching / Movies / TV Shows rows. Falls back to Phase R2's heuristic ranking
when there isn't enough personalized data yet (new install, new person on the household profile
once Phase 2 auth exists) rather than showing nothing.

## Summary: what to actually prioritize

Matches the original priority ranking this doc is based on, adjusted for what's realistic on a
single-household LAN app:

| Signal | Priority | Status |
|---|---|---|
| `event_type` + `timestamp` | ⭐⭐⭐⭐⭐ | ✅ collecting |
| `watch_seconds` / `completion_percentage` | ⭐⭐⭐⭐⭐ | ✅ collecting (`playback_progress`, `watch_progress` events) |
| `genres` / cast (content features) | ⭐⭐⭐⭐⭐ | ✅ already in catalog schema |
| `watchlist` | ⭐⭐⭐⭐ | ✅ collecting |
| `session_id` | ⭐⭐⭐⭐ | ⚠️ column exists, not populated yet (R1) |
| explicit `rating` / `like`/`dislike` | ⭐⭐⭐⭐ | ❌ no UI yet (R1+) |
| `language`, `release_year` | ⭐⭐⭐–⭐⭐⭐⭐ | ✅ already in catalog schema |
| device type, location | ⭐⭐/⭐ | ❌ intentionally skipped — see above |
