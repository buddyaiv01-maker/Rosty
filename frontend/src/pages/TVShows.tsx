import { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import ShowFormModal from "../components/ShowFormModal";
import { useLibrary } from "../state/LibraryContext";
import type { TVShow } from "../data/types";
import { IconArrowRight } from "../components/Icons";

export default function TVShows() {
  const { shows, showsLoading, showsError, saveShow, deleteShow } = useLibrary();
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = shows.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()));

  const handleCreate = async (s: TVShow, files: { poster?: File; backdrop?: File }) => {
    await saveShow(s, files);
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this show and all its seasons/episodes from the library?")) return;
    try {
      await deleteShow(id);
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div>
      <PageHeader
        title="TV Shows"
        subtitle={`${shows.length} in library`}
        action={
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "white" }}
          >
            + Create TV Show
          </button>
        }
      />

      <div className="p-8 pb-0">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search TV shows…"
          className="w-full max-w-sm rounded-lg border px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 p-8 sm:grid-cols-2 lg:grid-cols-3">
        {showsError && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            Failed to load TV shows: {showsError}
          </p>
        )}
        {!showsError && showsLoading && (
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            Loading…
          </p>
        )}
        {!showsError && !showsLoading && filtered.map((s) => {
          const episodeCount = s.seasons.reduce((a, se) => a + se.episodes.length, 0);
          return (
            <div key={s.id} className="flex gap-3 rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div
                className="h-24 w-16 shrink-0 overflow-hidden rounded-lg"
                style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
              >
                {s.posterUrl && <img src={s.posterUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-bold">{s.title}</p>
                  <button onClick={() => handleDelete(s.id)} className="shrink-0 text-xs font-semibold" style={{ color: "var(--danger)" }}>
                    Delete
                  </button>
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {s.releaseYear} · {s.genres.join(", ") || "No genres"}
                </p>
                <p className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
                  {s.seasons.length} season{s.seasons.length === 1 ? "" : "s"} · {episodeCount} episode{episodeCount === 1 ? "" : "s"}
                </p>
                <Link
                  to={`/admin/tv-shows/${s.id}`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ background: "var(--surface-alt)", color: "var(--text)" }}
                >
                  Manage Seasons & Episodes <IconArrowRight size={12} />
                </Link>
              </div>
            </div>
          );
        })}
        {!showsError && !showsLoading && filtered.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            {shows.length === 0 ? "No TV shows yet." : "No TV shows match your search."}
          </p>
        )}
      </div>

      {showForm && <ShowFormModal show={null} onSave={handleCreate} onClose={() => setShowForm(false)} />}
    </div>
  );
}
