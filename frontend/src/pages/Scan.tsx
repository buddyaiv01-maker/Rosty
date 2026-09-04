import { useState } from "react";
import PageHeader from "../components/PageHeader";
import { Select, TextInput } from "../components/FormField";
import { IconScan } from "../components/Icons";
import { useLibrary } from "../state/LibraryContext";
import * as api from "../lib/api";
import { lookupOmdb, lookupOmdbEpisode } from "../lib/omdb";
import type { MovieCandidate, EpisodeCandidate } from "../lib/api";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function MovieCandidateRow({ candidate, onImported }: { candidate: MovieCandidate; onImported: () => void }) {
  const { refreshMovies } = useLibrary();
  const [title, setTitle] = useState(candidate.guessedTitle);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleImport = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const omdb = await lookupOmdb(title, "movie");
      const meta = omdb.status === "found" ? omdb.data : null;
      const saved = await api.importScannedMovie({
        relativePath: candidate.relativePath,
        title: meta?.title || title,
        synopsis: meta?.synopsis,
        releaseYear: meta?.year ? Number(meta.year) : undefined,
        runtimeMin: meta?.runtimeMin,
        language: meta?.language,
        director: meta?.director,
        ageRating: meta?.rated,
        genres: meta?.genres,
        cast: meta?.cast,
      });
      if (meta?.posterUrl) {
        const res = await fetch(meta.posterUrl);
        const blob = await res.blob();
        await api.uploadMoviePoster(saved.id, new File([blob], "poster.jpg", { type: blob.type || "image/jpeg" }));
      }
      await refreshMovies();
      setStatus(meta ? "Imported with OMDb metadata." : "Imported — no OMDb match, edit details in Movies.");
      onImported();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs" style={{ color: "var(--text-dim)" }}>
          {candidate.relativePath} · {formatSize(candidate.sizeBytes)}
        </p>
        <div className="mt-1">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Movie title" />
        </div>
        {status && <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{status}</p>}
      </div>
      <button
        onClick={handleImport}
        disabled={busy || !title.trim()}
        className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
        style={{ background: "var(--accent)", color: "white" }}
      >
        {busy ? "Importing…" : "Import"}
      </button>
    </div>
  );
}

function EpisodeCandidateRow({ candidate, onImported }: { candidate: EpisodeCandidate; onImported: () => void }) {
  const { shows, refreshShows } = useLibrary();
  const bestMatch = shows.find((s) => s.title.toLowerCase() === candidate.guessedShowTitle.toLowerCase());
  const [showId, setShowId] = useState(bestMatch?.id ?? shows[0]?.id ?? "");
  const [season, setSeason] = useState(candidate.guessedSeason ?? 1);
  const [episodeNum, setEpisodeNum] = useState(candidate.guessedEpisode ?? 1);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleImport = async () => {
    if (!showId) {
      setStatus("No TV show selected — create the show first, then re-scan.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const show = shows.find((s) => s.id === showId);
      const omdb = show ? await lookupOmdbEpisode(show.title, season, episodeNum) : { status: "not_found" as const };
      const meta = omdb.status === "found" ? omdb.data : null;
      const saved = await api.importScannedEpisode({
        relativePath: candidate.relativePath,
        showId,
        seasonNumber: season,
        episodeNumber: episodeNum,
        title: meta?.title,
        synopsis: meta?.synopsis,
        runtimeMin: meta?.runtimeMin,
        airDate: meta?.airDate,
      });
      if (meta?.thumbnailUrl) {
        const res = await fetch(meta.thumbnailUrl);
        const blob = await res.blob();
        await api.uploadEpisodeThumbnail(saved.id, new File([blob], "thumb.jpg", { type: blob.type || "image/jpeg" }));
      }
      await refreshShows();
      setStatus(meta ? "Imported with OMDb metadata." : "Imported — no OMDb match, edit details on the show page.");
      onImported();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs" style={{ color: "var(--text-dim)" }}>
          {candidate.relativePath} · {formatSize(candidate.sizeBytes)}
        </p>
        <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select value={showId} onChange={(e) => setShowId(e.target.value)}>
            {shows.length === 0 && <option value="">No TV shows yet</option>}
            {shows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
          <TextInput type="number" value={season} onChange={(e) => setSeason(Number(e.target.value))} placeholder="Season" />
          <TextInput type="number" value={episodeNum} onChange={(e) => setEpisodeNum(Number(e.target.value))} placeholder="Episode" />
        </div>
        {status && <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{status}</p>}
      </div>
      <button
        onClick={handleImport}
        disabled={busy || !showId}
        className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
        style={{ background: "var(--accent)", color: "white" }}
      >
        {busy ? "Importing…" : "Import"}
      </button>
    </div>
  );
}

export default function Scan() {
  const [movies, setMovies] = useState<MovieCandidate[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeCandidate[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const result = await api.scanLibrary();
      setMovies(result.movies);
      setEpisodes(result.episodes);
      setScanned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Scan Library"
        subtitle="Find video files under Movies/ and TV Shows/ that aren't in the library yet"
        action={
          <button
            onClick={runScan}
            disabled={scanning}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
            style={{ background: "var(--accent)", color: "white" }}
          >
            <IconScan size={16} />
            {scanning ? "Scanning…" : "Scan Now"}
          </button>
        }
      />

      <div className="p-8">
        {error && (
          <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        {!scanned && !error && (
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            Click "Scan Now" to look for files on disk that haven't been imported into the library.
          </p>
        )}

        {scanned && (
          <>
            <div className="mb-8">
              <h2 className="mb-3 text-sm font-bold">Movies ({movies.length})</h2>
              <div className="flex flex-col gap-2">
                {movies.map((c) => (
                  <MovieCandidateRow key={c.relativePath} candidate={c} onImported={() => setMovies((prev) => prev.filter((m) => m.relativePath !== c.relativePath))} />
                ))}
                {movies.length === 0 && (
                  <p className="text-sm" style={{ color: "var(--text-dim)" }}>
                    Nothing new under Movies/.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-bold">TV Episodes ({episodes.length})</h2>
              <div className="flex flex-col gap-2">
                {episodes.map((c) => (
                  <EpisodeCandidateRow key={c.relativePath} candidate={c} onImported={() => setEpisodes((prev) => prev.filter((e) => e.relativePath !== c.relativePath))} />
                ))}
                {episodes.length === 0 && (
                  <p className="text-sm" style={{ color: "var(--text-dim)" }}>
                    Nothing new under TV Shows/.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
