import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import ShowFormModal from "../components/ShowFormModal";
import EpisodeFormModal from "../components/EpisodeFormModal";
import { useLibrary } from "../state/LibraryContext";
import * as api from "../lib/api";
import { IconArrowLeft, IconChevronDown } from "../components/Icons";
import type { Episode, TVShow } from "../data/types";

export default function ShowDetail() {
  const { id } = useParams();
  const { refreshShows } = useLibrary();
  const [show, setShow] = useState<TVShow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openSeasons, setOpenSeasons] = useState<Record<string, boolean>>({});
  const [editShow, setEditShow] = useState(false);
  const [episodeTarget, setEpisodeTarget] = useState<{ seasonId: string; episode: Episode | null } | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setShow(await api.getShow(id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--text-dim)" }}>Loading…</p>
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="p-8">
        <p style={{ color: error ? "var(--danger)" : "var(--text-dim)" }}>{error ? `Failed to load show: ${error}` : "Show not found."}</p>
        <Link to="/admin/tv-shows" className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
          <IconArrowLeft size={12} /> Back to TV Shows
        </Link>
      </div>
    );
  }

  const toggleSeason = (seasonId: string) => setOpenSeasons((prev) => ({ ...prev, [seasonId]: !prev[seasonId] }));

  const addSeason = async () => {
    const nextNumber = show.seasons.length ? Math.max(...show.seasons.map((s) => s.number)) + 1 : 1;
    try {
      const season = await api.createSeason(show.id, nextNumber);
      await load();
      setOpenSeasons((prev) => ({ ...prev, [season.id]: true }));
    } catch (err) {
      alert(`Failed to add season: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const deleteSeason = async (seasonId: string) => {
    if (!confirm("Delete this season and all its episodes?")) return;
    try {
      await api.deleteSeason(show.id, seasonId);
      await load();
    } catch (err) {
      alert(`Failed to delete season: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const saveEpisode = async (
    seasonId: string,
    isNew: boolean,
    episode: Episode,
    files: { thumbnail?: File; video?: File; subtitles: { language: string; file: File }[] },
  ) => {
    try {
      let saved = isNew ? await api.createEpisode(show.id, seasonId, episode) : await api.updateEpisode(episode.id, episode);
      if (files.thumbnail) saved = await api.uploadEpisodeThumbnail(saved.id, files.thumbnail);
      if (files.video) saved = await api.uploadEpisodeVideo(saved.id, files.video);
      for (const sub of files.subtitles) {
        await api.uploadEpisodeSubtitle(saved.id, sub.language, sub.file);
      }
      setEpisodeTarget(null);
      await load();
    } catch (err) {
      alert(`Failed to save episode: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const deleteEpisode = async (episodeId: string) => {
    if (!confirm("Delete this episode? This also deletes its video/thumbnail files on disk.")) return;
    try {
      await api.deleteEpisode(episodeId);
      await load();
    } catch (err) {
      alert(`Failed to delete episode: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div>
      <PageHeader
        title={show.title}
        subtitle={`${show.releaseYear} · ${show.genres.join(", ") || "No genres"}`}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setEditShow(true)}
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ background: "var(--surface-alt)", color: "var(--text)" }}
            >
              Edit Show
            </button>
            <button
              onClick={addSeason}
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ background: "var(--accent)", color: "white" }}
            >
              + Add Season
            </button>
          </div>
        }
      />

      <div className="p-8">
        <Link to="/admin/tv-shows" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          <IconArrowLeft size={12} /> Back to TV Shows
        </Link>

        <div className="flex flex-col gap-3">
          {show.seasons.map((season) => {
            const isOpen = !!openSeasons[season.id];
            return (
              <div key={season.id} className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <div
                  className="flex cursor-pointer items-center justify-between px-4 py-3"
                  style={{ background: "var(--surface)" }}
                  onClick={() => toggleSeason(season.id)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="transition-transform"
                      style={{ color: "var(--text-dim)", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                    >
                      <IconChevronDown size={13} />
                    </span>
                    <span className="text-sm font-bold">Season {season.number}</span>
                    <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                      ({season.episodes.length} episode{season.episodes.length === 1 ? "" : "s"})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEpisodeTarget({ seasonId: season.id, episode: null });
                      }}
                      style={{ color: "var(--accent)" }}
                    >
                      + Episode
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSeason(season.id);
                      }}
                      style={{ color: "var(--danger)" }}
                    >
                      Delete Season
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ background: "var(--bg)" }}>
                    {season.episodes.map((ep) => (
                      <div
                        key={ep.id}
                        className="flex items-center justify-between border-t px-4 py-3 text-sm"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <div>
                          <p style={{ color: "var(--text)" }}>
                            E{ep.number} · {ep.title || "Untitled"}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                            {ep.runtimeMin ? `${ep.runtimeMin}m` : "—"} {ep.airDate ? `· ${ep.airDate}` : ""}{" "}
                            {ep.videoFileName ? `· ${ep.videoFileName}` : "· No video uploaded"}
                          </p>
                        </div>
                        <div className="flex gap-3 text-xs font-semibold">
                          <button onClick={() => setEpisodeTarget({ seasonId: season.id, episode: ep })} style={{ color: "var(--accent)" }}>
                            Edit
                          </button>
                          <button onClick={() => deleteEpisode(ep.id)} style={{ color: "var(--danger)" }}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {season.episodes.length === 0 && (
                      <p className="border-t px-4 py-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
                        No episodes yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {show.seasons.length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              No seasons yet. Add one to start uploading episodes.
            </p>
          )}
        </div>
      </div>

      {editShow && (
        <ShowFormModal
          show={show}
          onSave={async (s, files) => {
            try {
              await api.updateShow(show.id, s);
              if (files.poster) await api.uploadShowPoster(show.id, files.poster);
              if (files.backdrop) await api.uploadShowBackdrop(show.id, files.backdrop);
              await refreshShows();
              await load();
              setEditShow(false);
            } catch (err) {
              alert(`Failed to save show: ${err instanceof Error ? err.message : String(err)}`);
            }
          }}
          onClose={() => setEditShow(false)}
        />
      )}

      {episodeTarget && (
        <EpisodeFormModal
          seriesTitle={show.title}
          seasonNumber={show.seasons.find((s) => s.id === episodeTarget.seasonId)?.number ?? 1}
          episode={episodeTarget.episode}
          nextNumber={
            (show.seasons.find((s) => s.id === episodeTarget.seasonId)?.episodes.length ?? 0) + 1
          }
          onSave={(e, files) => saveEpisode(episodeTarget.seasonId, episodeTarget.episode === null, e, files)}
          onClose={() => setEpisodeTarget(null)}
        />
      )}
    </div>
  );
}
