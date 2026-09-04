import { useState } from "react";
import PageHeader from "../components/PageHeader";
import MovieFormModal from "../components/MovieFormModal";
import { useLibrary } from "../state/LibraryContext";
import type { Movie } from "../data/types";

export default function Movies() {
  const { movies, moviesLoading, moviesError, saveMovie, deleteMovie } = useLibrary();
  const [editing, setEditing] = useState<Movie | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = movies.filter((m) => m.title.toLowerCase().includes(query.toLowerCase()));

  const handleSave = async (
    m: Movie,
    files: { poster?: File; backdrop?: File; video?: File; subtitles: { language: string; file: File }[] },
  ) => {
    await saveMovie(m, files);
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this movie? This also deletes its poster/backdrop/video files on disk.")) return;
    try {
      await deleteMovie(id);
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div>
      <PageHeader
        title="Movies"
        subtitle={`${movies.length} in library`}
        action={
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "white" }}
          >
            + Add Movie
          </button>
        }
      />

      <div className="p-8 pb-0">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies…"
          className="w-full max-w-sm rounded-lg border px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 p-8 sm:grid-cols-2 lg:grid-cols-3">
        {moviesError && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            Failed to load movies: {moviesError}
          </p>
        )}
        {!moviesError && moviesLoading && (
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            Loading…
          </p>
        )}
        {!moviesError && !moviesLoading && filtered.map((m) => (
          <div key={m.id} className="flex gap-3 rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
              {m.posterUrl && <img src={m.posterUrl} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate font-bold">{m.title}</p>
                <div className="flex shrink-0 gap-2 text-xs font-semibold">
                  <button
                    onClick={() => {
                      setEditing(m);
                      setShowForm(true);
                    }}
                    style={{ color: "var(--accent)" }}
                  >
                    Edit
                  </button>
                  <button onClick={() => handleDelete(m.id)} style={{ color: "var(--danger)" }}>
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {m.releaseYear} · {m.genres.join(", ") || "No genres"}
              </p>
              <p className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
                {m.runtimeMin ? `${m.runtimeMin}m` : "Runtime unknown"} · {m.subtitles.length} subtitle{m.subtitles.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        ))}
        {!moviesError && !moviesLoading && filtered.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            {movies.length === 0 ? "No movies yet." : "No movies match your search."}
          </p>
        )}
      </div>

      {showForm && (
        <MovieFormModal
          key={editing?.id ?? "new"}
          movie={editing}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
