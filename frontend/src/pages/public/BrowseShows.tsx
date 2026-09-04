import { useLibrary } from "../../state/LibraryContext";
import PosterCard from "../../components/public/PosterCard";

export default function BrowseShows() {
  const { shows, showsLoading } = useLibrary();

  return (
    <div className="px-6 py-8 sm:px-10">
      <h1 className="mb-6 text-2xl font-extrabold" style={{ fontFamily: "var(--r-font-heading)", letterSpacing: "var(--r-tracking-heading)" }}>
        TV Shows
      </h1>
      {showsLoading && (
        <p className="text-sm" style={{ color: "var(--r-text-muted)" }}>
          Loading…
        </p>
      )}
      {!showsLoading && shows.length === 0 && (
        <p className="text-sm" style={{ color: "var(--r-text-muted)" }}>
          No TV shows in the library yet.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {shows.map((s) => (
          <PosterCard key={s.id} to={`/show/${s.id}`} title={s.title} posterUrl={s.posterUrl} subtitle={String(s.releaseYear || "")} />
        ))}
      </div>
    </div>
  );
}
