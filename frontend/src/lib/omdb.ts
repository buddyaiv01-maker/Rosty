// Client-side OMDb lookup with a localStorage cache, standing in for the real
// backend metadata_provider + DB cache table planned for Phase 6. Once that
// endpoint exists, swap this for a call to /api/metadata/lookup and delete
// the localStorage bits — the shape of OmdbResult stays the same.

import { getOmdbApiKeys, getOmdbKeyRotationIndex, setOmdbKeyRotationIndex } from "./localSettings";

const CACHE_PREFIX = "lanstream.omdbCache.v1.";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type OmdbResult = {
  title: string;
  year: string;
  rated: string;
  runtimeMin: number;
  genres: string[];
  director: string;
  cast: string[];
  language: string;
  synopsis: string;
  posterUrl?: string;
  totalSeasons?: number;
};

function cacheKey(title: string, type: "movie" | "series") {
  return `${CACHE_PREFIX}${type}.${title.trim().toLowerCase()}`;
}

// Generic — used for OmdbResult detail lookups and, further below, OMDb search results.
// Every successful OMDb response gets cached so re-fetching (re-opening an edit form,
// retyping a search) never spends another day's request quota on the same answer.
function readCache<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { savedAt: number; data: T };
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
}

/** Tries each configured OMDb key in turn, starting from the last-known-good
 * rotation index. Advances (and persists) past any key that reports OMDb's
 * daily quota exceeded, so a burst of lookups only pays the "try a dead key"
 * cost once per key, not once per request. */
async function omdbFetch(params: Record<string, string>): Promise<{ status: "ok"; json: Record<string, string> } | { status: "error"; message: string }> {
  const keys = getOmdbApiKeys();
  if (keys.length === 0) return { status: "error", message: "No OMDb API key set. Add one in Settings." };

  const startIndex = Math.min(getOmdbKeyRotationIndex(), keys.length - 1);
  let networkFailed = false;

  for (let offset = 0; offset < keys.length; offset++) {
    const index = (startIndex + offset) % keys.length;
    const qs = new URLSearchParams({ ...params, apikey: keys[index] });
    let json: Record<string, string>;
    try {
      const res = await fetch(`https://www.omdbapi.com/?${qs.toString()}`);
      json = await res.json();
    } catch {
      networkFailed = true;
      continue;
    }

    const isQuotaError = json.Response === "False" && /request limit reached/i.test(json.Error ?? "");
    if (isQuotaError) continue;

    if (index !== startIndex) setOmdbKeyRotationIndex(index);
    return { status: "ok", json };
  }

  if (networkFailed) return { status: "error", message: "Could not reach OMDb (check your internet connection)." };
  return {
    status: "error",
    message: keys.length > 1 ? `All ${keys.length} OMDb keys have hit today's request limit.` : "This OMDb key has hit today's request limit.",
  };
}

export type OmdbEpisodeResult = {
  title: string;
  synopsis: string;
  runtimeMin: number;
  airDate?: string;
  thumbnailUrl?: string;
};

function episodeCacheKey(seriesTitle: string, season: number, episode: number) {
  return `${CACHE_PREFIX}episode.${seriesTitle.trim().toLowerCase()}.s${season}e${episode}`;
}

// OMDb gives dates as "12 Jan 2008" — episode forms use <input type=date> which needs YYYY-MM-DD.
function toIsoDate(omdbDate: string | undefined): string | undefined {
  if (!omdbDate || omdbDate === "N/A") return undefined;
  const parsed = new Date(omdbDate);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

export type OmdbEpisodeLookupOutcome =
  | { status: "found"; data: OmdbEpisodeResult; fromCache: boolean }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function lookupOmdbEpisode(seriesTitle: string, seasonNumber: number, episodeNumber: number): Promise<OmdbEpisodeLookupOutcome> {
  const key = episodeCacheKey(seriesTitle, seasonNumber, episodeNumber);
  const cached = readCache(key) as unknown as OmdbEpisodeResult | null;
  if (cached) return { status: "found", data: cached, fromCache: true };

  const fetched = await omdbFetch({ t: seriesTitle, Season: String(seasonNumber), Episode: String(episodeNumber), plot: "full" });
  if (fetched.status === "error") return fetched;
  if (fetched.json.Response === "False") return { status: "not_found" };

  const data: OmdbEpisodeResult = {
    title: fetched.json.Title && fetched.json.Title !== "N/A" ? fetched.json.Title : "",
    synopsis: fetched.json.Plot && fetched.json.Plot !== "N/A" ? fetched.json.Plot : "",
    runtimeMin: Number.parseInt(fetched.json.Runtime ?? "", 10) || 0,
    airDate: toIsoDate(fetched.json.Released),
    thumbnailUrl: fetched.json.Poster && fetched.json.Poster !== "N/A" ? fetched.json.Poster : undefined,
  };

  writeCache(key, data as unknown as OmdbResult);
  return { status: "found", data, fromCache: false };
}

export type OmdbLookupOutcome = { status: "found"; data: OmdbResult; fromCache: boolean } | { status: "not_found" } | { status: "error"; message: string };

function parseOmdbResult(json: Record<string, string>): OmdbResult {
  return {
    title: json.Title,
    year: (json.Year ?? "").replace(/[–-].*/, ""),
    rated: json.Rated && json.Rated !== "N/A" ? json.Rated : "",
    runtimeMin: Number.parseInt(json.Runtime ?? "", 10) || 0,
    genres: (json.Genre ?? "").split(",").map((g) => g.trim()).filter(Boolean),
    director: json.Director && json.Director !== "N/A" ? json.Director : "",
    cast: (json.Actors ?? "").split(",").map((a) => a.trim()).filter(Boolean),
    language: (json.Language ?? "").split(",")[0]?.trim() || "English",
    synopsis: json.Plot && json.Plot !== "N/A" ? json.Plot : "",
    posterUrl: json.Poster && json.Poster !== "N/A" ? json.Poster : undefined,
    totalSeasons: json.totalSeasons ? Number.parseInt(json.totalSeasons, 10) : undefined,
  };
}

export async function lookupOmdb(title: string, type: "movie" | "series" = "movie"): Promise<OmdbLookupOutcome> {
  const key = cacheKey(title, type);
  const cached = readCache<OmdbResult>(key);
  if (cached) return { status: "found", data: cached, fromCache: true };

  const fetched = await omdbFetch({ t: title, type, plot: "full" });
  if (fetched.status === "error") return fetched;
  if (fetched.json.Response === "False") return { status: "not_found" };

  const data = parseOmdbResult(fetched.json);
  writeCache(key, data);
  return { status: "found", data, fromCache: false };
}

/** Exact lookup by IMDb ID — used after the user picks a specific title from the
 * search dropdown, so the fetched details always match what they clicked rather
 * than whatever OMDb's `t=` fuzzy title match happens to resolve to. */
export async function lookupOmdbById(imdbId: string): Promise<OmdbLookupOutcome> {
  const key = `${CACHE_PREFIX}id.${imdbId}`;
  const cached = readCache<OmdbResult>(key);
  if (cached) return { status: "found", data: cached, fromCache: true };

  const fetched = await omdbFetch({ i: imdbId, plot: "full" });
  if (fetched.status === "error") return fetched;
  if (fetched.json.Response === "False") return { status: "not_found" };

  const data = parseOmdbResult(fetched.json);
  writeCache(key, data);
  return { status: "found", data, fromCache: false };
}

export type OmdbSearchResult = {
  imdbID: string;
  title: string;
  year: string;
  posterUrl?: string;
};

export type OmdbSearchOutcome = { status: "ok"; results: OmdbSearchResult[] } | { status: "error"; message: string };

function searchCacheKey(query: string, type: "movie" | "series") {
  return `${CACHE_PREFIX}search.${type}.${query.trim().toLowerCase()}`;
}

export async function searchOmdb(query: string, type: "movie" | "series"): Promise<OmdbSearchOutcome> {
  if (!query.trim()) return { status: "ok", results: [] };

  const key = searchCacheKey(query, type);
  const cached = readCache<OmdbSearchResult[]>(key);
  if (cached) return { status: "ok", results: cached };

  const fetched = await omdbFetch({ s: query, type });
  if (fetched.status === "error") return fetched;
  const search = (fetched.json as unknown as { Search?: Record<string, string>[] }).Search;
  if (fetched.json.Response === "False" || !Array.isArray(search)) {
    writeCache(key, []);
    return { status: "ok", results: [] };
  }

  const results = search.map((r) => ({
    imdbID: r.imdbID,
    title: r.Title,
    year: r.Year,
    posterUrl: r.Poster && r.Poster !== "N/A" ? r.Poster : undefined,
  }));
  writeCache(key, results);
  return { status: "ok", results };
}
