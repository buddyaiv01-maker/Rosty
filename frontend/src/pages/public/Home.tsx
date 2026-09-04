import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useLibrary } from "../../state/LibraryContext";
import Row from "../../components/public/Row";
import * as api from "../../lib/api";
import type { ContinueWatchingItem, HeroItem } from "../../lib/api";

const SLIDE_INTERVAL_MS = 7000;

type HeroSlide = {
  id: string;
  kind: "movie" | "show";
  contentId: string;
  title: string;
  synopsis: string;
  backdropUrl?: string;
  posterUrl?: string;
  releaseYear: number;
  genres: string[];
  // Where the Play button should actually send a "show" slide (see HeroItem).
  playEpisodeId?: string;
};

export default function Home() {
  const { movies, moviesLoading, shows, showsLoading } = useLibrary();
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [heroItems, setHeroItems] = useState<HeroItem[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const location = useLocation();

  const refreshContinueWatching = useCallback(() => {
    api.getContinueWatching().then(setContinueWatching).catch(() => setContinueWatching([]));
  }, []);

  // Re-fetch on every navigation back to Home (location.key changes per nav
  // entry, so this fires reliably even in edge cases where the component
  // doesn't fully remount) and when the tab regains focus, e.g. after
  // finishing something in the player — not just once on first mount.
  useEffect(() => {
    refreshContinueWatching();
  }, [refreshContinueWatching, location.key]);

  useEffect(() => {
    window.addEventListener("focus", refreshContinueWatching);
    return () => window.removeEventListener("focus", refreshContinueWatching);
  }, [refreshContinueWatching]);

  useEffect(() => {
    api.getHeroItems().then(setHeroItems).catch(() => setHeroItems([]));
  }, [location.key]);

  const removeFromContinueWatching = (item: ContinueWatchingItem) => {
    const remove = item.kind === "movie" ? api.removeMovieFromContinueWatching(item.id) : api.removeShowFromContinueWatching(item.showId!);
    remove.then(refreshContinueWatching).catch(() => {});
  };

  const loading = moviesLoading || showsLoading;
  const hasContent = movies.length > 0 || shows.length > 0;

  const recentMovies = [...movies].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
  const recentShows = [...shows].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));

  // Curated hero list from the admin CMS, falling back to the most recently
  // added movie so Home never has a blank hero before anyone's curated one.
  const heroSlides: HeroSlide[] = useMemo(() => {
    if (heroItems.length > 0) {
      return heroItems.map((h) => ({
        id: h.id, kind: h.kind, contentId: h.contentId, title: h.title, synopsis: h.synopsis,
        backdropUrl: h.backdropUrl, posterUrl: h.posterUrl, releaseYear: h.releaseYear, genres: [],
        playEpisodeId: h.playEpisodeId,
      }));
    }
    const fallback = recentMovies[0];
    if (!fallback) return [];
    return [
      {
        id: `fallback-${fallback.id}`, kind: "movie", contentId: fallback.id, title: fallback.title,
        synopsis: fallback.synopsis, backdropUrl: fallback.backdropUrl, posterUrl: fallback.posterUrl,
        releaseYear: fallback.releaseYear, genres: fallback.genres,
      },
    ];
    // recentMovies is derived fresh every render from `movies` — depending on
    // the array itself (not recentMovies) avoids re-sorting being treated as
    // a new dependency value on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroItems, movies]);

  const slide = heroSlides[heroIndex] ?? null;
  const slideBackdrop = slide?.backdropUrl ?? slide?.posterUrl;

  // Clamp the index if the slide list shrinks (e.g. admin removes items).
  useEffect(() => {
    if (heroIndex >= heroSlides.length) setHeroIndex(0);
  }, [heroSlides.length, heroIndex]);

  const advanceTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearInterval(advanceTimer.current);
    if (paused || heroSlides.length < 2) return;
    advanceTimer.current = window.setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroSlides.length);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(advanceTimer.current);
  }, [paused, heroSlides.length]);

  const goTo = (i: number) => setHeroIndex(i);

  return (
    <div>
      {slide && (
        <div
          // Pulled up behind the now-`fixed` nav (see PublicLayout.tsx) using
          // the exact same 80px/88px this page wrapper's pt-20/sm:pt-[88px]
          // is keyed off — with that same amount added back to the hero's own
          // height so the bottom-anchored title/buttons block ends up in the
          // same place as before; only the top extends further up, behind the
          // transparent nav, instead of stopping short of it.
          className="relative -mt-20 flex h-[calc(60vh+80px)] min-h-[400px] items-end overflow-hidden sm:-mt-[88px] sm:h-[calc(60vh+88px)] sm:min-h-[408px]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <AnimatePresence mode="sync">
            <motion.div
              key={slide.id}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            >
              {slideBackdrop ? (
                <motion.img
                  src={slideBackdrop}
                  alt=""
                  className="h-full w-full object-cover"
                  initial={{ scale: 1 }}
                  animate={{ scale: 1.06 }}
                  transition={{ duration: SLIDE_INTERVAL_MS / 1000 + 0.8, ease: "linear" }}
                />
              ) : (
                <div className="h-full w-full" style={{ background: "linear-gradient(140deg, var(--r-surface-alt), var(--r-bg))" }} />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="pointer-events-none absolute inset-0">
            {/* Was too weak (0.15 alpha) by the 45% mark, right where the
            synopsis text sits — legible on a dark backdrop but not against a
            bright one (e.g. Interstellar's wormhole shot), since the text has
            no shadow/outline of its own to fall back on. Darker through the
            same span the text actually occupies, only fading out after. */}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(90deg, var(--r-bg) 15%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.15) 65%, transparent 80%)" }}
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, var(--r-bg) 2%, transparent 45%)" }} />
            {/* A plain two-stop fade (opaque -> transparent) reads as a hard edge
            right around where it finishes, because the eye is much more
            sensitive to the steep part of that curve than a straight alpha
            ramp actually is — three stops with a slow start gives a visibly
            gradual fade instead, stretched over more of the hero (was 18%,
            then 40%, now 65%) since the nav bar no longer has its own
            background to visually separate the top from the image. */}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, var(--r-bg) 0%, color-mix(in srgb, var(--r-bg) 55%, transparent) 30%, transparent 65%)" }}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              className="relative z-10 max-w-xl px-6 pb-14 sm:px-10 sm:pb-16"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--r-text-muted)" }}>
                Start Watching
              </p>
              <p className="text-sm font-extrabold uppercase tracking-wide" style={{ fontFamily: "var(--r-font-heading)", color: "var(--r-accent)" }}>
                LANStream
              </p>
              <h1
                className="mt-1 text-4xl font-extrabold uppercase leading-[0.95] sm:text-6xl"
                style={{ fontFamily: "var(--r-font-heading)", letterSpacing: "var(--r-tracking-heading)", color: "var(--r-text)" }}
              >
                {slide.title}
              </h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed line-clamp-3" style={{ color: "var(--r-text-muted)" }}>
                {slide.synopsis}
              </p>
              <p className="mt-3 text-xs font-medium" style={{ color: "var(--r-text-muted)" }}>
                {slide.releaseYear || ""} {slide.releaseYear && slide.genres.length ? " · " : ""}
                {slide.genres.join(", ")}
              </p>

              <div className="mt-6 flex items-center gap-3">
                {(slide.kind === "movie" || slide.playEpisodeId) && (
                  <Link
                    to={slide.kind === "movie" ? `/watch/movie/${slide.contentId}` : `/watch/episode/${slide.playEpisodeId}`}
                    className="flex items-center gap-2 px-6 py-3 text-sm font-bold transition-transform active:scale-95"
                    style={{ background: "var(--r-text)", color: "var(--r-bg)", borderRadius: "var(--r-radius)" }}
                  >
                    ▶ Play
                  </Link>
                )}
                <Link
                  to={`/${slide.kind}/${slide.contentId}`}
                  className="px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-transform active:scale-95"
                  style={{
                    background: "var(--r-surface)",
                    backdropFilter: "blur(var(--r-blur))",
                    color: "var(--r-text)",
                    border: "1.5px solid var(--r-text)",
                    borderRadius: "var(--r-radius)",
                  }}
                >
                  Details
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>

          {heroSlides.length > 1 && (
            <div className="relative z-10 mb-4 flex items-center gap-2 px-6 sm:px-10">
              {heroSlides.map((s, i) => (
                // Fixed-size slot so the active dot's width change never shifts
                // later siblings — only the inner indicator animates in place.
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Show slide ${i + 1}: ${s.title}`}
                  className="flex h-4 w-6 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--r-accent-2)]"
                >
                  <span
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === heroIndex ? 24 : 8,
                      background: i === heroIndex ? "var(--r-text)" : "rgba(255,255,255,0.35)",
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="py-6">
        {loading && (
          <p className="px-6 text-sm" style={{ color: "var(--r-text-muted)" }}>
            Loading…
          </p>
        )}

        {!loading && !hasContent && (
          <div className="px-6 py-16 text-center">
            <p className="text-lg font-semibold">Your library is empty</p>
            <p className="mt-1 text-sm" style={{ color: "var(--r-text-muted)" }}>
              Add movies and TV shows from the Admin CMS to see them here.
            </p>
          </div>
        )}

        {continueWatching.length > 0 && (
          <Row
            title="Continue Watching"
            aspect="landscape"
            layout="grid"
            items={continueWatching.map((item) => ({
              id: `${item.kind}-${item.id}`,
              to: `/watch/${item.kind}/${item.id}`,
              title: item.title,
              // A backdrop/still is shot for a 16:9 frame — a poster (2:3)
              // stretched into this row's landscape cards would look wrong.
              posterUrl: item.backdropUrl ?? item.posterUrl,
              progress: item.durationSec > 0 ? item.positionSec / item.durationSec : 0,
              menu: [{ label: "Remove from Continue Watching", onClick: () => removeFromContinueWatching(item) }],
            }))}
          />
        )}

        {!loading && (
          <>
            <Row
              title="Movies"
              viewAllTo="/movies"
              items={recentMovies.map((m) => ({ id: m.id, to: `/movie/${m.id}`, title: m.title, posterUrl: m.posterUrl, subtitle: String(m.releaseYear || "") }))}
            />
            <Row
              title="TV Shows"
              viewAllTo="/tv-shows"
              items={recentShows.map((s) => ({ id: s.id, to: `/show/${s.id}`, title: s.title, posterUrl: s.posterUrl, subtitle: String(s.releaseYear || "") }))}
            />
          </>
        )}
      </div>
    </div>
  );
}
