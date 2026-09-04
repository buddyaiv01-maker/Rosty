import { useLibrary } from "../../state/LibraryContext";
import PosterCard from "../../components/public/PosterCard";

export default function BrowseMovies() {
  const { movies, moviesLoading } = useLibrary();

  return (
    <div className="px-6 py-8 sm:px-10">
      <h1 className="mb-6 text-2xl font-extrabold" style={{ fontFamily: "var(--r-font-heading)", letterSpacing: "var(--r-tracking-heading)" }}>
        Movies
      </h1>
      {moviesLoading && (
        <p className="text-sm" style={{ color: "var(--r-text-muted)" }}>
          Loading…
        </p>
      )}
      {!moviesLoading && movies.length === 0 && (
        <p className="text-sm" style={{ color: "var(--r-text-muted)" }}>
          No movies in the library yet.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {movies.map((m) => (
          <PosterCard key={m.id} to={`/movie/${m.id}`} title={m.title} posterUrl={m.posterUrl} subtitle={String(m.releaseYear || "")} />
        ))}
      </div>
    </div>
  );
}
