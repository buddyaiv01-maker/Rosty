import type { Episode, Movie, Season, Subtitle, TVShow } from "../data/types";
import { ROSTY_TOKEN_KEY } from "./authApi";
import { getSessionId } from "./session";

// Shadows the global `fetch` for the rest of this module only, so every one of
// the ~40 bare `fetch("/api/...")` calls below picks up the logged-in user's
// bearer token without having to be touched individually.
const nativeFetch = window.fetch.bind(window);

// Set by state/ProfileContext.tsx whenever the active profile changes.
let activeProfileId: number | null = null;
export function setActiveProfileId(id: number | null): void {
  activeProfileId = id;
}

// Remembers which profile was active across page reloads (state/ProfileContext.tsx
// restores it on load) — cleared on Switch Profile, logout, and account deletion,
// at which point the picker is shown again.
export const ROSTY_ACTIVE_PROFILE_KEY = "rosty_active_profile_id";

function fetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(ROSTY_TOKEN_KEY);
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (activeProfileId != null) headers["X-Profile-Id"] = String(activeProfileId);
  return nativeFetch(input, { ...init, headers });
}

type SubtitleDTO = {
  id: number;
  language: string;
  format: string;
  file_path: string;
};

type MovieDTO = {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  synopsis: string | null;
  release_year: number | null;
  runtime_min: number | null;
  language: string | null;
  director: string | null;
  age_rating: string | null;
  video_path: string | null;
  date_added: string;
  genres: string[];
  cast: string[];
  subtitles: SubtitleDTO[];
};

function subtitleFromDTO(dto: SubtitleDTO): Subtitle {
  return {
    id: String(dto.id),
    language: dto.language,
    format: dto.format === "srt" ? "srt" : "vtt",
    fileName: dto.file_path.split(/[\\/]/).pop() ?? "",
    url: mediaUrl(dto.file_path),
  };
}

function mediaUrl(relPath: string | null): string | undefined {
  return relPath ? `/api/media/${relPath.split("\\").join("/")}` : undefined;
}

/** Downloads a poster image via the backend instead of straight from OMDb —
 * same-origin, so it never hits the CORS gaps that CDN intermittently has
 * when fetched directly from the browser. */
export async function fetchProxiedImage(url: string): Promise<Blob> {
  const res = await fetch(`/api/media/proxy-image?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Failed to fetch image (${res.status})`);
  }
  return res.blob();
}

function fromDTO(dto: MovieDTO): Movie {
  return {
    id: String(dto.id),
    posterUrl: mediaUrl(dto.poster_path),
    backdropUrl: mediaUrl(dto.backdrop_path),
    title: dto.title,
    synopsis: dto.synopsis ?? "",
    releaseYear: dto.release_year ?? 0,
    runtimeMin: dto.runtime_min ?? 0,
    genres: dto.genres,
    language: dto.language ?? "",
    director: dto.director ?? "",
    cast: dto.cast,
    ageRating: dto.age_rating ?? "",
    videoFileName: dto.video_path ? dto.video_path.split(/[\\/]/).pop() : undefined,
    subtitles: dto.subtitles.map(subtitleFromDTO),
    dateAdded: dto.date_added,
  };
}

function toPayload(m: Movie) {
  return {
    title: m.title,
    synopsis: m.synopsis || null,
    release_year: m.releaseYear || null,
    runtime_min: m.runtimeMin || null,
    language: m.language || null,
    director: m.director || null,
    age_rating: m.ageRating || null,
    genres: m.genres,
    cast: m.cast,
  };
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function listMovies(): Promise<Movie[]> {
  const res = await fetch("/api/movies");
  const dtos = await json<MovieDTO[]>(res);
  return dtos.map(fromDTO);
}

export async function createMovie(m: Movie): Promise<Movie> {
  const res = await fetch("/api/movies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toPayload(m)),
  });
  return fromDTO(await json<MovieDTO>(res));
}

export async function updateMovie(id: string, m: Movie): Promise<Movie> {
  const res = await fetch(`/api/movies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toPayload(m)),
  });
  return fromDTO(await json<MovieDTO>(res));
}

export async function deleteMovie(id: string): Promise<void> {
  const res = await fetch(`/api/movies/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

async function uploadMovieFile(id: string, kind: "poster" | "backdrop" | "video", file: File): Promise<Movie> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/movies/${id}/${kind}`, { method: "POST", body: form });
  return fromDTO(await json<MovieDTO>(res));
}

export const uploadMoviePoster = (id: string, file: File) => uploadMovieFile(id, "poster", file);
export const uploadMovieBackdrop = (id: string, file: File) => uploadMovieFile(id, "backdrop", file);
export const uploadMovieVideo = (id: string, file: File) => uploadMovieFile(id, "video", file);

// ---- Subtitles ----

export async function uploadMovieSubtitle(movieId: string, language: string, file: File): Promise<Subtitle> {
  const form = new FormData();
  form.append("file", file);
  form.append("language", language);
  const res = await fetch(`/api/movies/${movieId}/subtitles`, { method: "POST", body: form });
  return subtitleFromDTO(await json<SubtitleDTO>(res));
}

export async function uploadEpisodeSubtitle(episodeId: string, language: string, file: File): Promise<Subtitle> {
  const form = new FormData();
  form.append("file", file);
  form.append("language", language);
  const res = await fetch(`/api/episodes/${episodeId}/subtitles`, { method: "POST", body: form });
  return subtitleFromDTO(await json<SubtitleDTO>(res));
}

export async function deleteSubtitle(subtitleId: string): Promise<void> {
  const res = await fetch(`/api/subtitles/${subtitleId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

// ---- TV Shows ----

type EpisodeDTO = {
  id: number;
  season_id: number;
  episode_number: number;
  title: string | null;
  synopsis: string | null;
  thumbnail_path: string | null;
  runtime_min: number | null;
  video_path: string | null;
  air_date: string | null;
  subtitles: SubtitleDTO[];
};

type SeasonDTO = {
  id: number;
  show_id: number;
  season_number: number;
  episodes: EpisodeDTO[];
};

type ShowDTO = {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  synopsis: string | null;
  release_year: number | null;
  language: string | null;
  creator: string | null;
  age_rating: string | null;
  date_added: string;
  genres: string[];
  cast: string[];
  seasons: SeasonDTO[];
};

type ShowSummaryDTO = {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_year: number | null;
  age_rating: string | null;
  date_added: string;
  genres: string[];
  season_count: number;
  episode_count: number;
};

function episodeFromDTO(dto: EpisodeDTO): Episode {
  return {
    id: String(dto.id),
    number: dto.episode_number,
    title: dto.title ?? "",
    synopsis: dto.synopsis ?? "",
    thumbnailUrl: mediaUrl(dto.thumbnail_path),
    runtimeMin: dto.runtime_min ?? 0,
    videoFileName: dto.video_path ? dto.video_path.split(/[\\/]/).pop() : undefined,
    airDate: dto.air_date ?? undefined,
    subtitles: dto.subtitles.map(subtitleFromDTO),
  };
}

function seasonFromDTO(dto: SeasonDTO): Season {
  return {
    id: String(dto.id),
    number: dto.season_number,
    episodes: dto.episodes.map(episodeFromDTO).sort((a, b) => a.number - b.number),
  };
}

function showFromDTO(dto: ShowDTO): TVShow {
  return {
    id: String(dto.id),
    title: dto.title,
    posterUrl: mediaUrl(dto.poster_path),
    backdropUrl: mediaUrl(dto.backdrop_path),
    synopsis: dto.synopsis ?? "",
    releaseYear: dto.release_year ?? 0,
    genres: dto.genres,
    language: dto.language ?? "",
    creator: dto.creator ?? "",
    cast: dto.cast,
    ageRating: dto.age_rating ?? "",
    seasons: dto.seasons.map(seasonFromDTO).sort((a, b) => a.number - b.number),
    dateAdded: dto.date_added,
  };
}

function showSummaryFromDTO(dto: ShowSummaryDTO): TVShow {
  return {
    id: String(dto.id),
    title: dto.title,
    posterUrl: mediaUrl(dto.poster_path),
    backdropUrl: mediaUrl(dto.backdrop_path),
    synopsis: "",
    releaseYear: dto.release_year ?? 0,
    genres: dto.genres,
    language: "",
    creator: "",
    cast: [],
    ageRating: dto.age_rating ?? "",
    // List view is intentionally lightweight — real seasons/episodes are loaded per-show in ShowDetail.
    seasons: Array.from({ length: dto.season_count }, (_, i) => ({ id: `summary-${i}`, number: i + 1, episodes: [] })),
    dateAdded: dto.date_added,
  };
}

function showPayload(s: TVShow) {
  return {
    title: s.title,
    synopsis: s.synopsis || null,
    release_year: s.releaseYear || null,
    language: s.language || null,
    creator: s.creator || null,
    age_rating: s.ageRating || null,
    genres: s.genres,
    cast: s.cast,
  };
}

export async function listShows(): Promise<TVShow[]> {
  const res = await fetch("/api/shows");
  const dtos = await json<ShowSummaryDTO[]>(res);
  return dtos.map(showSummaryFromDTO);
}

export async function getShow(id: string): Promise<TVShow> {
  const res = await fetch(`/api/shows/${id}`);
  return showFromDTO(await json<ShowDTO>(res));
}

export async function createShow(s: TVShow): Promise<TVShow> {
  const res = await fetch("/api/shows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(showPayload(s)),
  });
  return showFromDTO(await json<ShowDTO>(res));
}

export async function updateShow(id: string, s: TVShow): Promise<TVShow> {
  const res = await fetch(`/api/shows/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(showPayload(s)),
  });
  return showFromDTO(await json<ShowDTO>(res));
}

export async function deleteShow(id: string): Promise<void> {
  const res = await fetch(`/api/shows/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

async function uploadShowFile(id: string, kind: "poster" | "backdrop", file: File): Promise<TVShow> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/shows/${id}/${kind}`, { method: "POST", body: form });
  return showFromDTO(await json<ShowDTO>(res));
}

export const uploadShowPoster = (id: string, file: File) => uploadShowFile(id, "poster", file);
export const uploadShowBackdrop = (id: string, file: File) => uploadShowFile(id, "backdrop", file);

export async function createSeason(showId: string, seasonNumber: number): Promise<Season> {
  const res = await fetch(`/api/shows/${showId}/seasons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ season_number: seasonNumber }),
  });
  return seasonFromDTO(await json<SeasonDTO>(res));
}

export async function deleteSeason(showId: string, seasonId: string): Promise<void> {
  const res = await fetch(`/api/shows/${showId}/seasons/${seasonId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

function episodePayload(e: Episode) {
  return {
    episode_number: e.number,
    title: e.title || null,
    synopsis: e.synopsis || null,
    runtime_min: e.runtimeMin || null,
    air_date: e.airDate || null,
  };
}

export async function createEpisode(showId: string, seasonId: string, e: Episode): Promise<Episode> {
  const res = await fetch(`/api/shows/${showId}/seasons/${seasonId}/episodes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(episodePayload(e)),
  });
  return episodeFromDTO(await json<EpisodeDTO>(res));
}

export type EpisodePlaybackInfo = {
  episode: Episode;
  showId: string;
  showTitle: string;
  seasonNumber: number;
};

export async function getEpisodePlaybackInfo(episodeId: string): Promise<EpisodePlaybackInfo> {
  const res = await fetch(`/api/episodes/${episodeId}`);
  const dto = await json<EpisodeDTO & { show_id: number; show_title: string; season_number: number }>(res);
  return {
    episode: episodeFromDTO(dto),
    showId: String(dto.show_id),
    showTitle: dto.show_title,
    seasonNumber: dto.season_number,
  };
}

export async function updateEpisode(episodeId: string, e: Episode): Promise<Episode> {
  const res = await fetch(`/api/episodes/${episodeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(episodePayload(e)),
  });
  return episodeFromDTO(await json<EpisodeDTO>(res));
}

export async function deleteEpisode(episodeId: string): Promise<void> {
  const res = await fetch(`/api/episodes/${episodeId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

async function uploadEpisodeFile(episodeId: string, kind: "thumbnail" | "video", file: File): Promise<Episode> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/episodes/${episodeId}/${kind}`, { method: "POST", body: form });
  return episodeFromDTO(await json<EpisodeDTO>(res));
}

export const uploadEpisodeThumbnail = (episodeId: string, file: File) => uploadEpisodeFile(episodeId, "thumbnail", file);
export const uploadEpisodeVideo = (episodeId: string, file: File) => uploadEpisodeFile(episodeId, "video", file);

// ---- Library scan ----

export type MovieCandidate = {
  relativePath: string;
  filename: string;
  sizeBytes: number;
  guessedTitle: string;
};

export type EpisodeCandidate = {
  relativePath: string;
  filename: string;
  sizeBytes: number;
  guessedShowTitle: string;
  guessedSeason: number | null;
  guessedEpisode: number | null;
};

type ScanResultDTO = {
  scanned_at: string;
  movies: { relative_path: string; filename: string; size_bytes: number; guessed_title: string }[];
  episodes: {
    relative_path: string;
    filename: string;
    size_bytes: number;
    guessed_show_title: string;
    guessed_season: number | null;
    guessed_episode: number | null;
  }[];
};

export async function scanLibrary(): Promise<{ movies: MovieCandidate[]; episodes: EpisodeCandidate[] }> {
  const res = await fetch("/api/scan");
  const dto = await json<ScanResultDTO>(res);
  return {
    movies: dto.movies.map((m) => ({ relativePath: m.relative_path, filename: m.filename, sizeBytes: m.size_bytes, guessedTitle: m.guessed_title })),
    episodes: dto.episodes.map((e) => ({
      relativePath: e.relative_path,
      filename: e.filename,
      sizeBytes: e.size_bytes,
      guessedShowTitle: e.guessed_show_title,
      guessedSeason: e.guessed_season,
      guessedEpisode: e.guessed_episode,
    })),
  };
}

export async function importScannedMovie(payload: {
  relativePath: string;
  title: string;
  synopsis?: string;
  releaseYear?: number;
  runtimeMin?: number;
  language?: string;
  director?: string;
  ageRating?: string;
  genres?: string[];
  cast?: string[];
}): Promise<Movie> {
  const res = await fetch("/api/scan/import-movie", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      relative_path: payload.relativePath,
      title: payload.title,
      synopsis: payload.synopsis || null,
      release_year: payload.releaseYear || null,
      runtime_min: payload.runtimeMin || null,
      language: payload.language || null,
      director: payload.director || null,
      age_rating: payload.ageRating || null,
      genres: payload.genres ?? [],
      cast: payload.cast ?? [],
    }),
  });
  return fromDTO(await json<MovieDTO>(res));
}

export async function importScannedEpisode(payload: {
  relativePath: string;
  showId: string;
  seasonNumber: number;
  episodeNumber: number;
  title?: string;
  synopsis?: string;
  runtimeMin?: number;
  airDate?: string;
}): Promise<Episode> {
  const res = await fetch("/api/scan/import-episode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      relative_path: payload.relativePath,
      show_id: Number(payload.showId),
      season_number: payload.seasonNumber,
      episode_number: payload.episodeNumber,
      title: payload.title || null,
      synopsis: payload.synopsis || null,
      runtime_min: payload.runtimeMin || null,
      air_date: payload.airDate || null,
    }),
  });
  return episodeFromDTO(await json<EpisodeDTO>(res));
}

// ---- Playback progress ----

export type Progress = { positionSec: number; durationSec: number; completed: boolean };

type ProgressDTO = { position_sec: number; duration_sec: number; completed: boolean };

async function getProgress(kind: "movies" | "episodes", id: string): Promise<Progress | null> {
  const res = await fetch(`/api/progress/${kind}/${id}`);
  if (res.status === 404) return null;
  const dto = await json<ProgressDTO>(res);
  return { positionSec: dto.position_sec, durationSec: dto.duration_sec, completed: dto.completed };
}

async function saveProgress(kind: "movies" | "episodes", id: string, positionSec: number, durationSec: number): Promise<void> {
  const res = await fetch(`/api/progress/${kind}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      position_sec: Math.floor(positionSec),
      duration_sec: Math.floor(durationSec),
      session_id: getSessionId(),
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

export const getMovieProgress = (movieId: string) => getProgress("movies", movieId);
export const getEpisodeProgress = (episodeId: string) => getProgress("episodes", episodeId);
export const saveMovieProgress = (movieId: string, positionSec: number, durationSec: number) => saveProgress("movies", movieId, positionSec, durationSec);
export const saveEpisodeProgress = (episodeId: string, positionSec: number, durationSec: number) =>
  saveProgress("episodes", episodeId, positionSec, durationSec);

export type ContinueWatchingItem = {
  kind: "movie" | "episode";
  id: string;
  title: string;
  posterUrl?: string;
  backdropUrl?: string;
  positionSec: number;
  durationSec: number;
  showId?: string;
  showTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
};

type ContinueWatchingDTO = {
  kind: "movie" | "episode";
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  position_sec: number;
  duration_sec: number;
  show_id: number | null;
  show_title: string | null;
  season_number: number | null;
  episode_number: number | null;
};

export async function getContinueWatching(): Promise<ContinueWatchingItem[]> {
  const res = await fetch("/api/progress/continue-watching");
  const dtos = await json<ContinueWatchingDTO[]>(res);
  return dtos.map((dto) => ({
    kind: dto.kind,
    id: String(dto.id),
    title: dto.title,
    posterUrl: mediaUrl(dto.poster_path),
    backdropUrl: mediaUrl(dto.backdrop_path),
    positionSec: dto.position_sec,
    durationSec: dto.duration_sec,
    showId: dto.show_id != null ? String(dto.show_id) : undefined,
    showTitle: dto.show_title ?? undefined,
    seasonNumber: dto.season_number ?? undefined,
    episodeNumber: dto.episode_number ?? undefined,
  }));
}

export async function removeMovieFromContinueWatching(movieId: string): Promise<void> {
  const res = await fetch(`/api/progress/movies/${movieId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

/** Removes the whole show's Continue Watching card — not just one episode, since
 * the card can point at either an in-progress or a just-finished episode and the
 * viewer has no way to know which (see backend/app/routers/playback.py). */
export async function removeShowFromContinueWatching(showId: string): Promise<void> {
  const res = await fetch(`/api/progress/shows/${showId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

// ---- Watchlist ----

async function watchlistStatus(kind: "movies" | "shows", id: string): Promise<boolean> {
  const res = await fetch(`/api/watchlist/${kind}/${id}/status`);
  const dto = await json<{ in_watchlist: boolean }>(res);
  return dto.in_watchlist;
}

async function addToWatchlist(kind: "movies" | "shows", id: string): Promise<void> {
  const res = await fetch(`/api/watchlist/${kind}/${id}`, { method: "POST" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

async function removeFromWatchlist(kind: "movies" | "shows", id: string): Promise<void> {
  const res = await fetch(`/api/watchlist/${kind}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

export const getMovieWatchlistStatus = (movieId: string) => watchlistStatus("movies", movieId);
export const getShowWatchlistStatus = (showId: string) => watchlistStatus("shows", showId);
export const addMovieToWatchlist = (movieId: string) => addToWatchlist("movies", movieId);
export const addShowToWatchlist = (showId: string) => addToWatchlist("shows", showId);
export const removeMovieFromWatchlist = (movieId: string) => removeFromWatchlist("movies", movieId);
export const removeShowFromWatchlist = (showId: string) => removeFromWatchlist("shows", showId);

export type WatchlistItem = {
  kind: "movie" | "show";
  id: string;
  title: string;
  posterUrl?: string;
  backdropUrl?: string;
  releaseYear: number;
  addedAt: string;
};

type WatchlistItemDTO = {
  kind: "movie" | "show";
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_year: number | null;
  added_at: string;
};

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const res = await fetch("/api/watchlist");
  const dtos = await json<WatchlistItemDTO[]>(res);
  return dtos.map((dto) => ({
    kind: dto.kind,
    id: String(dto.id),
    title: dto.title,
    posterUrl: mediaUrl(dto.poster_path),
    backdropUrl: mediaUrl(dto.backdrop_path),
    releaseYear: dto.release_year ?? 0,
    addedAt: dto.added_at,
  }));
}

// ---- Settings ----

export type Health = { status: string; appDataRoot: string; databasePath: string };

export async function getHealth(): Promise<Health> {
  const res = await fetch("/api/health");
  const dto = await json<{ status: string; app_data_root: string; database_path: string }>(res);
  return { status: dto.status, appDataRoot: dto.app_data_root, databasePath: dto.database_path };
}

export type Settings = { mediaRoot: string; serverHost: string; serverPort: number };

type SettingsDTO = { media_root: string; server_host: string; server_port: number };

export async function getSettings(): Promise<Settings> {
  const res = await fetch("/api/settings");
  const dto = await json<SettingsDTO>(res);
  return { mediaRoot: dto.media_root, serverHost: dto.server_host, serverPort: dto.server_port };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_root: patch.mediaRoot,
      server_host: patch.serverHost,
      server_port: patch.serverPort,
    }),
  });
  const dto = await json<SettingsDTO>(res);
  return { mediaRoot: dto.media_root, serverHost: dto.server_host, serverPort: dto.server_port };
}

// ---- Rate limiting ----

export type RateLimitThreshold = { maxRequests: number; windowSeconds: number };
export type RateLimitConfig = { login: RateLimitThreshold; registration: RateLimitThreshold };

type RateLimitThresholdDTO = { max_requests: number; window_seconds: number };
type RateLimitConfigDTO = { login: RateLimitThresholdDTO; registration: RateLimitThresholdDTO };

function rateLimitConfigFromDTO(dto: RateLimitConfigDTO): RateLimitConfig {
  return {
    login: { maxRequests: dto.login.max_requests, windowSeconds: dto.login.window_seconds },
    registration: { maxRequests: dto.registration.max_requests, windowSeconds: dto.registration.window_seconds },
  };
}

export async function getRateLimitConfig(): Promise<RateLimitConfig> {
  const res = await fetch("/api/rate-limit-config");
  return rateLimitConfigFromDTO(await json<RateLimitConfigDTO>(res));
}

export async function updateRateLimitConfig(patch: Partial<RateLimitConfig>): Promise<RateLimitConfig> {
  const body: Partial<RateLimitConfigDTO> = {};
  if (patch.login) body.login = { max_requests: patch.login.maxRequests, window_seconds: patch.login.windowSeconds };
  if (patch.registration) {
    body.registration = { max_requests: patch.registration.maxRequests, window_seconds: patch.registration.windowSeconds };
  }
  const res = await fetch("/api/rate-limit-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return rateLimitConfigFromDTO(await json<RateLimitConfigDTO>(res));
}

// ---- Service status ----

export type ServiceStatus = {
  backend: boolean;
  authService: boolean;
  authRestartHintDev: string;
  authRestartHintSystemd: string;
};

type ServiceStatusDTO = {
  backend: boolean;
  auth_service: boolean;
  auth_restart_hint_dev: string;
  auth_restart_hint_systemd: string;
};

export async function getServiceStatus(): Promise<ServiceStatus> {
  const res = await fetch("/api/service-status");
  const dto = await json<ServiceStatusDTO>(res);
  return {
    backend: dto.backend,
    authService: dto.auth_service,
    authRestartHintDev: dto.auth_restart_hint_dev,
    authRestartHintSystemd: dto.auth_restart_hint_systemd,
  };
}

// ---- Admin allowlist ----

export type AdminEmailStatus = "admin" | "pending";
export type AdminEmailEntry = { email: string; status: AdminEmailStatus };

type AdminEmailsDTO = { emails: AdminEmailEntry[] };

export type AdminEmailAction = "added_to_allowlist" | "promoted" | "already_admin" | "removed_from_allowlist" | "demoted";
export type AdminEmailActionResult = { action: AdminEmailAction; message: string; emails: AdminEmailEntry[] };

type AdminEmailActionDTO = { action: AdminEmailAction; message: string; emails: AdminEmailEntry[] };

export async function getAdminEmails(): Promise<AdminEmailEntry[]> {
  const res = await fetch("/api/admin-emails");
  return (await json<AdminEmailsDTO>(res)).emails;
}

export async function addAdminEmail(email: string): Promise<AdminEmailActionResult> {
  const res = await fetch("/api/admin-emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return json<AdminEmailActionDTO>(res);
}

export async function removeAdminEmail(email: string): Promise<AdminEmailActionResult> {
  const res = await fetch(`/api/admin-emails/${encodeURIComponent(email)}`, { method: "DELETE" });
  return json<AdminEmailActionDTO>(res);
}

export type DriveUsage = { path: string; totalBytes: number; usedBytes: number; freeBytes: number };
export type DiskUsage = { media: DriveUsage; appData: DriveUsage };

type DriveUsageDTO = { path: string; total_bytes: number; used_bytes: number; free_bytes: number };

function driveUsageFromDTO(dto: DriveUsageDTO): DriveUsage {
  return { path: dto.path, totalBytes: dto.total_bytes, usedBytes: dto.used_bytes, freeBytes: dto.free_bytes };
}

export async function getDiskUsage(): Promise<DiskUsage> {
  const res = await fetch("/api/disk-usage");
  const dto = await json<{ media: DriveUsageDTO; app_data: DriveUsageDTO }>(res);
  return { media: driveUsageFromDTO(dto.media), appData: driveUsageFromDTO(dto.app_data) };
}

// ---- Interaction events (see RECOMMENDATIONS.md) ----

export type InteractionEventType = "play" | "pause" | "stop" | "search" | "click" | "skip" | "rewatch" | "like" | "dislike";

export type InteractionEventInput = {
  movieId?: string;
  episodeId?: string;
  showId?: string;
  positionSec?: number;
  durationSec?: number;
  metadata?: Record<string, unknown>;
};

/** Fire-and-forget — a dropped analytics event is never worth surfacing to the viewer. */
export function logEvent(eventType: InteractionEventType, input: InteractionEventInput = {}): void {
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_type: eventType,
      movie_id: input.movieId ? Number(input.movieId) : null,
      episode_id: input.episodeId ? Number(input.episodeId) : null,
      show_id: input.showId ? Number(input.showId) : null,
      position_sec: input.positionSec !== undefined ? Math.floor(input.positionSec) : null,
      duration_sec: input.durationSec !== undefined ? Math.floor(input.durationSec) : null,
      session_id: getSessionId(),
      metadata: input.metadata ?? null,
    }),
  }).catch(() => {});
}

// ---- Profiles ----

export type ProfileDTO = { id: number; name: string; avatar_key: string };

export async function listProfiles(): Promise<ProfileDTO[]> {
  const res = await fetch("/api/profiles");
  return json<ProfileDTO[]>(res);
}

export async function createProfile(name: string, avatarKey: string): Promise<ProfileDTO> {
  const res = await fetch("/api/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, avatar_key: avatarKey }),
  });
  return json<ProfileDTO>(res);
}

export async function updateProfile(id: number, patch: { name?: string; avatarKey?: string }): Promise<ProfileDTO> {
  const res = await fetch(`/api/profiles/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: patch.name, avatar_key: patch.avatarKey }),
  });
  return json<ProfileDTO>(res);
}

export async function deleteProfile(id: number): Promise<void> {
  const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

export async function getAccount(): Promise<{ id: number; email: string | null; role: "admin" | "user" }> {
  const res = await fetch("/api/account");
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Deletes this user's Rosty row — watchlist/progress/interaction history cascade with it. */
export async function deleteAccount(): Promise<void> {
  const res = await fetch("/api/account", { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

// ---- Hero banner (admin-curated Home slider) ----

export type HeroItem = {
  id: string; // hero_items.id, distinct from contentId — used for remove/reorder
  kind: "movie" | "show";
  contentId: string;
  title: string;
  synopsis: string;
  posterUrl?: string;
  backdropUrl?: string;
  releaseYear: number;
  // Shows aren't directly playable — only episodes are — so this is what a
  // show slide's Play button actually links to. Undefined if the show has no
  // episodes yet.
  playEpisodeId?: string;
};

type HeroItemDTO = {
  id: number;
  kind: "movie" | "show";
  content_id: number;
  title: string;
  synopsis: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_year: number | null;
  play_episode_id: number | null;
};

function heroItemFromDTO(dto: HeroItemDTO): HeroItem {
  return {
    id: String(dto.id),
    kind: dto.kind,
    contentId: String(dto.content_id),
    title: dto.title,
    synopsis: dto.synopsis ?? "",
    posterUrl: mediaUrl(dto.poster_path),
    backdropUrl: mediaUrl(dto.backdrop_path),
    releaseYear: dto.release_year ?? 0,
    playEpisodeId: dto.play_episode_id != null ? String(dto.play_episode_id) : undefined,
  };
}

export async function getHeroItems(): Promise<HeroItem[]> {
  const res = await fetch("/api/hero");
  const dtos = await json<HeroItemDTO[]>(res);
  return dtos.map(heroItemFromDTO);
}

export async function addHeroItem(kind: "movie" | "show", contentId: string): Promise<HeroItem> {
  const res = await fetch("/api/hero", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, content_id: Number(contentId) }),
  });
  return heroItemFromDTO(await json<HeroItemDTO>(res));
}

export async function removeHeroItem(id: string): Promise<void> {
  const res = await fetch(`/api/hero/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}

export async function reorderHeroItems(orderedIds: string[]): Promise<void> {
  const res = await fetch("/api/hero/reorder", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ordered_ids: orderedIds.map(Number) }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
}
