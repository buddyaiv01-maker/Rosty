import { Link, useParams } from "react-router-dom";
import { useLibrary } from "../../state/LibraryContext";
import WatchlistButton from "../../components/public/WatchlistButton";

export default function MovieDetail() {
  const { id } = useParams();
  const { movies, moviesLoading } = useLibrary();
  const movie = movies.find((m) => m.id === id);

  if (moviesLoading) {
    return (
      <div className="px-6 py-8">
        <p className="text-sm" style={{ color: "var(--r-text-muted)" }}>
          Loading…
        </p>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="px-6 py-8">
        <p style={{ color: "var(--r-text-muted)" }}>Movie not found.</p>
        <Link to="/movies" className="text-sm" style={{ color: "var(--r-accent-2)" }}>
          ← Back to Movies
        </Link>
      </div>
    );
  }

  const hasVideo = !!movie.videoFileName;

  return (
    <div>
      <div
        className="relative flex h-64 items-end overflow-hidden p-6 sm:h-80 sm:p-10"
        style={{ background: "linear-gradient(150deg, var(--r-surface-alt), var(--r-bg))" }}
      >
        {(movie.backdropUrl || movie.posterUrl) && (
          <>
            <img src={movie.backdropUrl ?? movie.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, var(--r-bg) 5%, rgba(0,0,0,0.15) 60%)" }} />
          </>
        )}
        <h1
          className="relative z-10 text-3xl font-extrabold text-white sm:text-5xl"
          style={{ fontFamily: "var(--r-font-heading)", letterSpacing: "var(--r-tracking-heading)" }}
        >
          {movie.title}
        </h1>
      </div>

      <div className="px-6 py-6 sm:px-10" style={{ color: "var(--r-text)" }}>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--r-text-muted)" }}>
          <span>{movie.releaseYear || "—"}</span>
          {movie.runtimeMin > 0 && <span>· {movie.runtimeMin} min</span>}
          {movie.ageRating && (
            <span className="rounded-full px-2 py-0.5" style={{ background: "var(--r-surface-alt)" }}>
              {movie.ageRating}
            </span>
          )}
          {movie.genres.map((g) => (
            <span key={g} className="rounded-full px-2 py-0.5" style={{ background: "var(--r-surface-alt)" }}>
              {g}
            </span>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {hasVideo ? (
            <Link
              to={`/watch/movie/${movie.id}`}
              className="rounded-full px-5 py-2.5 text-sm font-bold"
              style={{ background: "var(--r-accent)", color: "var(--r-bg)", borderRadius: "var(--r-radius)" }}
            >
              ▶ Play
            </Link>
          ) : (
            <span
              className="rounded-full px-5 py-2.5 text-sm font-bold opacity-50"
              style={{ background: "var(--r-surface-alt)", color: "var(--r-text-muted)", borderRadius: "var(--r-radius)" }}
            >
              No video uploaded yet
            </span>
          )}
          <WatchlistButton kind="movie" id={movie.id} />
        </div>

        {movie.synopsis && (
          <p className="max-w-2xl text-sm leading-relaxed" style={{ color: "var(--r-text-muted)", fontFamily: "var(--r-font-body)" }}>
            {movie.synopsis}
          </p>
        )}

        <dl className="mt-6 grid max-w-xl grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {movie.director && (
            <div>
              <dt className="text-xs font-semibold" style={{ color: "var(--r-text-muted)" }}>
                Director
              </dt>
              <dd>{movie.director}</dd>
            </div>
          )}
          {movie.cast.length > 0 && (
            <div>
              <dt className="text-xs font-semibold" style={{ color: "var(--r-text-muted)" }}>
                Cast
              </dt>
              <dd>{movie.cast.join(", ")}</dd>
            </div>
          )}
          {movie.language && (
            <div>
              <dt className="text-xs font-semibold" style={{ color: "var(--r-text-muted)" }}>
                Language
              </dt>
              <dd>{movie.language}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
