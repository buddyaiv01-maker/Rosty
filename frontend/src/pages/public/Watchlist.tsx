import { useEffect, useState } from "react";
import PosterCard from "../../components/public/PosterCard";
import * as api from "../../lib/api";
import type { WatchlistItem } from "../../lib/api";

export default function Watchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getWatchlist()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-6 py-8 sm:px-10">
      <h1 className="mb-6 text-2xl font-extrabold" style={{ fontFamily: "var(--r-font-heading)", letterSpacing: "var(--r-tracking-heading)" }}>
        Watchlist
      </h1>
      {loading && (
        <p className="text-sm" style={{ color: "var(--r-text-muted)" }}>
          Loading…
        </p>
      )}
      {error && (
        <p className="text-sm" style={{ color: "#f87171" }}>
          Failed to load: {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="text-sm" style={{ color: "var(--r-text-muted)" }}>
          Nothing saved yet — tap "Watchlist" on any movie or show to add it here.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((item) => (
          <PosterCard
            key={`${item.kind}-${item.id}`}
            to={item.kind === "movie" ? `/movie/${item.id}` : `/show/${item.id}`}
            title={item.title}
            posterUrl={item.posterUrl}
            subtitle={String(item.releaseYear || "")}
          />
        ))}
      </div>
    </div>
  );
}
