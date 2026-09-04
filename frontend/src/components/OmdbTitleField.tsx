import { useEffect, useRef, useState } from "react";
import { Field, TextInput } from "./FormField";
import { IconSearch } from "./Icons";
import { lookupOmdb, lookupOmdbById, searchOmdb, type OmdbResult, type OmdbSearchResult } from "../lib/omdb";

type FetchStatus = { kind: "idle" } | { kind: "loading" } | { kind: "found"; cached: boolean } | { kind: "not_found" } | { kind: "error"; message: string };

export default function OmdbTitleField({
  title,
  onTitleChange,
  type,
  placeholder,
  onPick,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  type: "movie" | "series";
  placeholder: string;
  onPick: (d: OmdbResult) => void;
}) {
  const [results, setResults] = useState<OmdbSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>({ kind: "idle" });
  const requestId = useRef(0);
  // Set right before onTitleChange() in pickResult, so the title update that
  // follows a pick doesn't get treated as the user typing a new query and
  // re-trigger search-as-you-type below (which was reopening the dropdown
  // ~350ms after the user had just picked something and closed it).
  const suppressNextSearch = useRef(false);

  useEffect(() => {
    if (suppressNextSearch.current) {
      suppressNextSearch.current = false;
      return;
    }
    const query = title.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      const outcome = await searchOmdb(query, type);
      if (requestId.current !== id) return; // a newer keystroke already fired — drop this stale response
      setResults(outcome.status === "ok" ? outcome.results : []);
      setOpen(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [title, type]);

  const pickResult = async (r: OmdbSearchResult) => {
    setOpen(false);
    setResults([]);
    suppressNextSearch.current = true;
    onTitleChange(r.title);
    setFetchStatus({ kind: "loading" });
    const result = await lookupOmdbById(r.imdbID);
    if (result.status === "not_found") {
      setFetchStatus({ kind: "not_found" });
      return;
    }
    if (result.status === "error") {
      setFetchStatus({ kind: "error", message: result.message });
      return;
    }
    onPick(result.data);
    setFetchStatus({ kind: "found", cached: result.fromCache });
  };

  const fetchExact = async () => {
    if (!title.trim()) return;
    setOpen(false);
    setFetchStatus({ kind: "loading" });
    const result = await lookupOmdb(title, type);
    if (result.status === "not_found") {
      setFetchStatus({ kind: "not_found" });
      return;
    }
    if (result.status === "error") {
      setFetchStatus({ kind: "error", message: result.message });
      return;
    }
    onPick(result.data);
    setFetchStatus({ kind: "found", cached: result.fromCache });
  };

  return (
    <Field label="Title" hint="Type a few letters and pick a match, or press Enter to fetch the exact title">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <TextInput
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), fetchExact())}
            placeholder={placeholder}
          />
          {open && results.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg shadow-lg"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {results.map((r) => (
                <button
                  key={r.imdbID}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickResult(r);
                  }}
                  className="flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-black/10"
                  style={{ borderColor: "var(--border)" }}
                >
                  {r.posterUrl ? (
                    <img src={r.posterUrl} alt="" className="h-10 w-7 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-7 shrink-0 rounded" style={{ background: "var(--surface-alt)" }} />
                  )}
                  <span>
                    {r.title} <span style={{ color: "var(--text-dim)" }}>({r.year})</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={fetchExact}
          disabled={!title.trim() || fetchStatus.kind === "loading"}
          className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40"
          style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }}
        >
          <IconSearch size={14} />
          {fetchStatus.kind === "loading" ? "Fetching…" : "Fetch from OMDb"}
        </button>
      </div>
      {fetchStatus.kind === "found" && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--success)" }}>
          Filled from OMDb{fetchStatus.cached ? " (cached)" : ""}. Review before saving.
        </p>
      )}
      {fetchStatus.kind === "not_found" && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--warning)" }}>
          No match on OMDb for that title — enter details manually.
        </p>
      )}
      {fetchStatus.kind === "error" && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--danger)" }}>
          {fetchStatus.message}
        </p>
      )}
    </Field>
  );
}
