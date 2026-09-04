import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLibrary } from "../../state/LibraryContext";
import PosterCard from "../../components/public/PosterCard";
import Row from "../../components/public/Row";
import { IconSearch } from "../../components/Icons";
import * as api from "../../lib/api";
import type { Movie, TVShow } from "../../data/types";

const SUGGESTION_COUNT = 14;

// Netflix/Disney+/Hotstar/Apple TV all skip a decorative empty state here and
// show real browsable content instead (trending/recently-added, "Explore"
// categories, etc.) — so before a query exists, this reuses the same
// Row/PosterCard the Home page uses rather than filling the space with an
// illustration nobody can act on.
function SearchSuggestions({ movies, shows }: { movies: Movie[]; shows: TVShow[] }) {
  const combined = [
    ...movies.map((m) => ({ id: `movie-${m.id}`, to: `/movie/${m.id}`, title: m.title, posterUrl: m.posterUrl, subtitle: String(m.releaseYear || ""), dateAdded: m.dateAdded })),
    ...shows.map((s) => ({ id: `show-${s.id}`, to: `/show/${s.id}`, title: s.title, posterUrl: s.posterUrl, subtitle: String(s.releaseYear || ""), dateAdded: s.dateAdded })),
  ]
    .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))
    .slice(0, SUGGESTION_COUNT);

  if (combined.length === 0) return null;

  return (
    <div className="mt-4">
      <Row title="Recently Added" items={combined} />
    </div>
  );
}

export default function Search() {
  const { movies, shows } = useLibrary();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initial);

  const q = query.trim().toLowerCase();
  // A single letter matches almost everything as a substring (e.g. "p" hits
  // "Spider-Man" via the p in "Spider") — not a meaningful search yet, so
  // hold off on filtering until there's enough of a query to be selective.
  const MIN_QUERY_LENGTH = 2;
  const searchable = q.length >= MIN_QUERY_LENGTH;
  const matchedMovies = searchable ? movies.filter((m) => m.title.toLowerCase().includes(q)) : [];
  const matchedShows = searchable ? shows.filter((s) => s.title.toLowerCase().includes(q)) : [];
  const hasResults = matchedMovies.length > 0 || matchedShows.length > 0;

  // Fire once the query settles, not on every keystroke — mirrors the OMDb search debounce.
  useEffect(() => {
    if (q.length < 2) return;
    const timer = window.setTimeout(() => {
      api.logEvent("search", { metadata: { query: q, resultCount: matchedMovies.length + matchedShows.length } });
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-xl">
        <div
          className="flex items-center gap-2 rounded-full px-4 py-3"
          style={{ border: "1px solid var(--r-border)", background: "var(--r-surface)", backdropFilter: "blur(var(--r-blur))" }}
        >
          <span style={{ color: "var(--r-text-muted)" }}>
            <IconSearch size={18} />
          </span>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchParams(e.target.value ? { q: e.target.value } : {});
            }}
            placeholder="Search movies and TV shows…"
            className="flex-1 bg-transparent text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--r-accent-2)]"
            style={{ color: "var(--r-text)" }}
          />
        </div>
      </div>

      {!q && <SearchSuggestions movies={movies} shows={shows} />}

      {q && !searchable && (
        <p className="mt-8 text-center text-sm" style={{ color: "var(--r-text-muted)" }}>
          Keep typing…
        </p>
      )}

      {searchable && !hasResults && (
        <p className="mt-8 text-center text-sm" style={{ color: "var(--r-text-muted)" }}>
          No titles match "{query}".
        </p>
      )}

      {matchedMovies.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-bold" style={{ fontFamily: "var(--r-font-heading)" }}>
            Movies
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {matchedMovies.map((m) => (
              <PosterCard key={m.id} to={`/movie/${m.id}`} title={m.title} posterUrl={m.posterUrl} subtitle={String(m.releaseYear || "")} />
            ))}
          </div>
        </div>
      )}

      {matchedShows.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-bold" style={{ fontFamily: "var(--r-font-heading)" }}>
            TV Shows
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {matchedShows.map((s) => (
              <PosterCard key={s.id} to={`/show/${s.id}`} title={s.title} posterUrl={s.posterUrl} subtitle={String(s.releaseYear || "")} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
