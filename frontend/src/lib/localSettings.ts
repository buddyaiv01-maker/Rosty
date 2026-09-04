// Frontend-only persistence until the backend Settings/DB layer exists (Phase 1/6).
// Once real endpoints land, these get replaced by calls to /api/settings.

const OMDB_KEYS_STORAGE = "rosty.omdbApiKeys";
const OMDB_KEY_STORAGE_LEGACY = "rosty.omdbApiKey";
const OMDB_KEY_INDEX_STORAGE = "rosty.omdbApiKeyIndex";

export const MAX_OMDB_KEYS = 5;

export function getOmdbApiKeys(): string[] {
  const raw = localStorage.getItem(OMDB_KEYS_STORAGE);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((k): k is string => typeof k === "string" && k.trim() !== "");
    } catch {
      // fall through to legacy single-key storage below
    }
  }
  const legacy = localStorage.getItem(OMDB_KEY_STORAGE_LEGACY);
  return legacy ? [legacy] : [];
}

export function setOmdbApiKeys(keys: string[]) {
  localStorage.setItem(OMDB_KEYS_STORAGE, JSON.stringify(keys.map((k) => k.trim()).filter(Boolean).slice(0, MAX_OMDB_KEYS)));
  localStorage.removeItem(OMDB_KEY_STORAGE_LEGACY);
  localStorage.removeItem(OMDB_KEY_INDEX_STORAGE);
}

/** Index of the key to try first — advanced past any key that reports OMDb's
 * daily quota exceeded, so a session doesn't keep retrying a dead key on every lookup. */
export function getOmdbKeyRotationIndex(): number {
  return Number.parseInt(localStorage.getItem(OMDB_KEY_INDEX_STORAGE) ?? "0", 10) || 0;
}

export function setOmdbKeyRotationIndex(index: number) {
  localStorage.setItem(OMDB_KEY_INDEX_STORAGE, String(index));
}
