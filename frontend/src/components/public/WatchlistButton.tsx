import { useEffect, useState } from "react";
import { IconBookmark } from "../Icons";
import * as api from "../../lib/api";

export default function WatchlistButton({ kind, id }: { kind: "movie" | "show"; id: string }) {
  const [inWatchlist, setInWatchlist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    const check = kind === "movie" ? api.getMovieWatchlistStatus(id) : api.getShowWatchlistStatus(id);
    check
      .then(setInWatchlist)
      .catch(() => setInWatchlist(false))
      .finally(() => setLoading(false));
  }, [kind, id]);

  const toggle = async () => {
    setBusy(true);
    try {
      if (inWatchlist) {
        await (kind === "movie" ? api.removeMovieFromWatchlist(id) : api.removeShowFromWatchlist(id));
        setInWatchlist(false);
      } else {
        await (kind === "movie" ? api.addMovieToWatchlist(id) : api.addShowToWatchlist(id));
        setInWatchlist(true);
      }
    } catch {
      // Leave state as-is on failure — the button still reflects the last known-good state, retry is a click away.
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading || busy}
      aria-label={inWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
      className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-transform active:scale-95 disabled:opacity-50"
      style={{
        background: inWatchlist ? "var(--r-surface-alt)" : "var(--r-surface)",
        border: "1.5px solid var(--r-text)",
        color: "var(--r-text)",
        borderRadius: "var(--r-radius)",
        backdropFilter: "blur(var(--r-blur))",
      }}
    >
      <IconBookmark size={16} filled={inWatchlist} />
      {inWatchlist ? "In Watchlist" : "Watchlist"}
    </button>
  );
}
