import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../../lib/api";
import type { TVShow } from "../../data/types";
import { IconChevronDown } from "../../components/Icons";
import WatchlistButton from "../../components/public/WatchlistButton";

export default function ShowDetail() {
  const { id } = useParams();
  const [show, setShow] = useState<TVShow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSeason, setActiveSeason] = useState<string | null>(null);
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const seasonMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!seasonMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (seasonMenuRef.current && !seasonMenuRef.current.contains(e.target as Node)) setSeasonMenuOpen(false);
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [seasonMenuOpen]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getShow(id)
      .then((s) => {
        setShow(s);
        setActiveSeason(s.seasons[0]?.id ?? null);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="px-6 py-8">
        <p className="text-sm" style={{ color: "var(--r-text-muted)" }}>
          Loading…
        </p>
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="px-6 py-8">
        <p style={{ color: error ? "#f87171" : "var(--r-text-muted)" }}>{error ? `Failed to load: ${error}` : "Show not found."}</p>
        <Link to="/tv-shows" className="text-sm" style={{ color: "var(--r-accent-2)" }}>
          ← Back to TV Shows
        </Link>
      </div>
    );
  }

  const season = show.seasons.find((s) => s.id === activeSeason) ?? show.seasons[0] ?? null;
  const episodes = season?.episodes ?? [];

  return (
    <div>
      <div
        className="relative flex h-64 items-end overflow-hidden p-6 sm:h-80 sm:p-10"
        style={{ background: "linear-gradient(150deg, var(--r-surface-alt), var(--r-bg))" }}
      >
        {(show.backdropUrl || show.posterUrl) && (
          <>
            <img src={show.backdropUrl ?? show.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, var(--r-bg) 5%, rgba(0,0,0,0.15) 60%)" }} />
          </>
        )}
        <h1
          className="relative z-10 text-3xl font-extrabold text-white sm:text-5xl"
          style={{ fontFamily: "var(--r-font-heading)", letterSpacing: "var(--r-tracking-heading)" }}
        >
          {show.title}
        </h1>
      </div>

      <div className="px-6 py-6 sm:px-10" style={{ color: "var(--r-text)" }}>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--r-text-muted)" }}>
          <span>{show.releaseYear || "—"}</span>
          {show.ageRating && (
            <span className="rounded-full px-2 py-0.5" style={{ background: "var(--r-surface-alt)" }}>
              {show.ageRating}
            </span>
          )}
          {show.genres.map((g) => (
            <span key={g} className="rounded-full px-2 py-0.5" style={{ background: "var(--r-surface-alt)" }}>
              {g}
            </span>
          ))}
        </div>

        <div className="mb-4">
          <WatchlistButton kind="show" id={show.id} />
        </div>

        {show.synopsis && (
          <p className="max-w-2xl text-sm leading-relaxed" style={{ color: "var(--r-text-muted)", fontFamily: "var(--r-font-body)" }}>
            {show.synopsis}
          </p>
        )}

        {(show.creator || show.cast.length > 0) && (
          <dl className="mt-5 grid max-w-xl grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {show.creator && (
              <div>
                <dt className="text-xs font-semibold" style={{ color: "var(--r-text-muted)" }}>
                  Creator
                </dt>
                <dd>{show.creator}</dd>
              </div>
            )}
            {show.cast.length > 0 && (
              <div>
                <dt className="text-xs font-semibold" style={{ color: "var(--r-text-muted)" }}>
                  Cast
                </dt>
                <dd>{show.cast.join(", ")}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <div className="px-6 pb-12 sm:px-10">
        {show.seasons.length === 0 && (
          <p className="text-sm" style={{ color: "var(--r-text-muted)" }}>
            No seasons yet.
          </p>
        )}

        {show.seasons.length > 0 && (
          <>
            <div className="relative mb-4 inline-block" ref={seasonMenuRef}>
              <button
                type="button"
                onClick={() => setSeasonMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full border py-2 pl-4 pr-3 text-sm font-semibold outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--r-accent-2)]"
                style={{ borderColor: "var(--r-border)", background: "var(--r-surface)", backdropFilter: "blur(var(--r-blur))", color: "var(--r-text)" }}
              >
                Season {season?.number}
                <span style={{ color: "var(--r-text-muted)" }}>
                  <IconChevronDown size={14} />
                </span>
              </button>

              {seasonMenuOpen && (
                <div
                  className="absolute left-0 top-full z-20 mt-1 min-w-full overflow-hidden rounded-xl border py-1 shadow-2xl"
                  style={{ borderColor: "var(--r-border)", background: "var(--r-surface)", backdropFilter: "blur(var(--r-blur))" }}
                >
                  {show.seasons.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setActiveSeason(s.id);
                        setSeasonMenuOpen(false);
                      }}
                      className="block w-full whitespace-nowrap px-4 py-2 text-left text-sm font-medium"
                      style={{
                        color: s.id === season?.id ? "var(--r-bg)" : "var(--r-text)",
                        background: s.id === season?.id ? "var(--r-accent)" : "transparent",
                      }}
                    >
                      Season {s.number}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {episodes.map((ep) => {
                const hasVideo = !!ep.videoFileName;
                return (
                  <div
                    key={ep.id}
                    className="flex gap-4 p-3"
                    style={{ borderRadius: "var(--r-radius)", border: "1px solid var(--r-border)", background: "var(--r-surface)" }}
                  >
                    <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg" style={{ background: "var(--r-surface-alt)" }}>
                      {ep.thumbnailUrl && <img src={ep.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        E{ep.number} · {ep.title || "Untitled"}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--r-text-muted)" }}>
                        {ep.runtimeMin ? `${ep.runtimeMin}m` : "—"} {ep.airDate ? `· ${ep.airDate}` : ""}
                      </p>
                      {ep.synopsis && (
                        <p className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--r-text-muted)" }}>
                          {ep.synopsis}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center">
                      {hasVideo ? (
                        <Link
                          to={`/watch/episode/${ep.id}`}
                          className="rounded-full px-4 py-2 text-xs font-bold"
                          style={{ background: "var(--r-accent)", color: "var(--r-bg)" }}
                        >
                          ▶ Play
                        </Link>
                      ) : (
                        <span
                          className="rounded-full px-4 py-2 text-xs font-bold opacity-50"
                          style={{ background: "var(--r-surface-alt)", color: "var(--r-text-muted)" }}
                        >
                          No video
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {episodes.length === 0 && (
                <p className="text-sm" style={{ color: "var(--r-text-muted)" }}>
                  No episodes in this season yet.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
