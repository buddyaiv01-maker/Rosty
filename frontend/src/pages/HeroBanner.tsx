import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import { Field, Select, TextInput } from "../components/FormField";
import { IconChevronDown, IconClose } from "../components/Icons";
import { useLibrary } from "../state/LibraryContext";
import * as api from "../lib/api";
import type { HeroItem } from "../lib/api";

export default function HeroBanner() {
  const { movies, shows } = useLibrary();
  const [items, setItems] = useState<HeroItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addKind, setAddKind] = useState<"movie" | "show">("movie");
  const [addId, setAddId] = useState("");
  const [query, setQuery] = useState("");

  const refresh = () => api.getHeroItems().then(setItems).catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const usedIds = useMemo(() => new Set(items.filter((i) => i.kind === addKind).map((i) => i.contentId)), [items, addKind]);
  const candidates = useMemo(() => {
    const pool = addKind === "movie" ? movies : shows;
    return pool.filter((c) => !usedIds.has(c.id) && c.title.toLowerCase().includes(query.toLowerCase()));
  }, [addKind, movies, shows, usedIds, query]);

  const add = async () => {
    if (!addId) return;
    setBusy(true);
    try {
      await api.addHeroItem(addKind, addId);
      setAddId("");
      setQuery("");
      await refresh();
    } catch (err) {
      alert(`Failed to add: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await api.removeHeroItem(id);
      await refresh();
    } catch (err) {
      alert(`Failed to remove: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setItems(reordered); // optimistic — reflects instantly, refresh() below reconciles with the server
    setBusy(true);
    try {
      await api.reorderHeroItems(reordered.map((i) => i.id));
    } catch (err) {
      alert(`Failed to reorder: ${err instanceof Error ? err.message : String(err)}`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Hero Banner" subtitle="Curate what plays in the Home page slider, and the order it plays in" />

      <div className="max-w-3xl p-4 sm:p-8">
        {loadError && (
          <div className="mb-4 rounded-lg p-3 text-xs" style={{ background: "var(--danger-bg, rgba(239,68,68,0.1))", color: "var(--danger)" }}>
            Couldn't load hero list: {loadError}
          </div>
        )}

        <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="mb-1 text-sm font-bold">Add to Hero</p>
          <p className="mb-4 text-xs" style={{ color: "var(--text-dim)" }}>
            Picked titles slide automatically on Home. If this list is empty, Home falls back to
            showing whatever was added to the library most recently.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
            <Field label="Type">
              <Select
                value={addKind}
                onChange={(e) => {
                  setAddKind(e.target.value as "movie" | "show");
                  setAddId("");
                  setQuery("");
                }}
              >
                <option value="movie">Movie</option>
                <option value="show">TV Show</option>
              </Select>
            </Field>
            <Field label="Filter">
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type to narrow the list below…" />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Title">
              <Select value={addId} onChange={(e) => setAddId(e.target.value)}>
                <option value="">Choose a title…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} {c.releaseYear ? `(${c.releaseYear})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <button
                onClick={add}
                disabled={!addId || busy}
                className="w-full rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 sm:w-auto"
                style={{ background: "var(--accent)", color: "white" }}
              >
                + Add
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="mb-4 text-sm font-bold">Slider order</p>
          {loading && (
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Loading…
            </p>
          )}
          {!loading && items.length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Nothing curated yet — add a title above.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {items.map((item, i) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg p-2" style={{ background: "var(--surface-alt)" }}>
                {item.posterUrl ? (
                  <img src={item.posterUrl} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-14 w-10 shrink-0 rounded" style={{ background: "var(--surface)" }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                    {item.kind === "movie" ? "Movie" : "TV Show"} {item.releaseYear ? `· ${item.releaseYear}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || busy}
                    aria-label="Move up"
                    className="grid h-8 w-8 place-items-center rounded-lg disabled:opacity-30"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <IconChevronDown size={14} className="rotate-180" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1 || busy}
                    aria-label="Move down"
                    className="grid h-8 w-8 place-items-center rounded-lg disabled:opacity-30"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <IconChevronDown size={14} />
                  </button>
                  <button
                    onClick={() => remove(item.id)}
                    disabled={busy}
                    aria-label={`Remove ${item.title} from hero`}
                    className="grid h-8 w-8 place-items-center rounded-lg disabled:opacity-30"
                    style={{ color: "var(--danger)" }}
                  >
                    <IconClose size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
