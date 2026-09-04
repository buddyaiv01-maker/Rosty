import { useState } from "react";
import Modal from "./Modal";
import { Field, TextInput, TextArea, Select, ChipInput, FilePicker } from "./FormField";
import OmdbTitleField from "./OmdbTitleField";
import { AGE_RATINGS, GENRE_OPTIONS, nextId } from "../data/mock";
import * as api from "../lib/api";
import type { TVShow } from "../data/types";

// Downloads a poster from its remote (OMDb) URL so the file lives locally
// (self-hosted, no external calls at playback time). Routed through the
// backend proxy rather than fetched directly — OMDb's poster CDN has
// inconsistent CORS support, the backend isn't subject to it at all. Labeled
// so a failure here is distinguishable from a failure in the actual save.
async function downloadAsFile(step: string, url: string, filename: string): Promise<File> {
  try {
    const blob = await api.fetchProxiedImage(url);
    return new File([blob], filename, { type: blob.type || "image/jpeg" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${step}: ${msg}`);
  }
}

const emptyShow = (): TVShow => ({
  id: nextId(),
  title: "",
  synopsis: "",
  releaseYear: new Date().getFullYear(),
  genres: [],
  language: "English",
  creator: "",
  cast: [],
  ageRating: "TV-14",
  seasons: [],
  dateAdded: new Date().toISOString().slice(0, 10),
});

export default function ShowFormModal({
  show,
  onSave,
  onClose,
}: {
  show: TVShow | null;
  onSave: (s: TVShow, files: { poster?: File; backdrop?: File }) => void | Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<TVShow>(show ?? emptyShow());
  const [posterFile, setPosterFile] = useState<File | undefined>();
  const [backdropFile, setBackdropFile] = useState<File | undefined>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const set = <K extends keyof TVShow>(key: K, value: TVShow[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal title={show ? "Edit TV Show" : "Create TV Show"} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <OmdbTitleField
            title={form.title}
            onTitleChange={(v) => set("title", v)}
            type="series"
            placeholder="Show title"
            onPick={(d) =>
              setForm((f) => ({
                ...f,
                title: d.title || f.title,
                releaseYear: d.year ? Number(d.year) : f.releaseYear,
                genres: d.genres.length ? d.genres : f.genres,
                language: d.language || f.language,
                creator: d.director || f.creator,
                ageRating: d.rated || f.ageRating,
                synopsis: d.synopsis || f.synopsis,
                posterUrl: d.posterUrl || f.posterUrl,
              }))
            }
          />
        </div>

        <Field label="Release Year">
          <TextInput type="number" value={form.releaseYear} onChange={(e) => set("releaseYear", Number(e.target.value))} />
        </Field>
        <Field label="Age Rating">
          <Select value={form.ageRating} onChange={(e) => set("ageRating", e.target.value)}>
            {AGE_RATINGS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Poster">
          <div className="flex items-center gap-3">
            {(posterFile || form.posterUrl) && (
              <img
                src={posterFile ? URL.createObjectURL(posterFile) : form.posterUrl}
                alt=""
                className="h-14 w-10 shrink-0 rounded object-cover"
                style={{ border: "1px solid var(--border)" }}
              />
            )}
            <FilePicker
              label="Choose poster image"
              fileName={posterFile?.name ?? (form.posterUrl?.startsWith("http") ? "From OMDb (click to override)" : undefined)}
              onPick={setPosterFile}
              accept="image/*"
            />
          </div>
        </Field>
        <Field label="Backdrop">
          <FilePicker label="Choose backdrop image" fileName={backdropFile?.name} onPick={setBackdropFile} accept="image/*" />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Synopsis">
            <TextArea value={form.synopsis} onChange={(e) => set("synopsis", e.target.value)} placeholder="Short description…" />
          </Field>
        </div>

        <Field label="Language">
          <TextInput value={form.language} onChange={(e) => set("language", e.target.value)} />
        </Field>
        <Field label="Creator / Director">
          <TextInput value={form.creator} onChange={(e) => set("creator", e.target.value)} />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Genres">
            <ChipInput values={form.genres} onChange={(v) => set("genres", v)} options={GENRE_OPTIONS} placeholder="Add genre…" />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
        {saveError && (
          <p className="mr-auto text-xs font-semibold" style={{ color: "var(--danger)" }}>
            Failed to save: {saveError}
          </p>
        )}
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
          Cancel
        </button>
        <button
          onClick={async () => {
            setSaving(true);
            setSaveError(null);
            try {
              let poster = posterFile;
              // Poster came from OMDb as a remote URL and wasn't overridden — fetch it once
              // so the file lives locally (self-hosted, no external calls at playback time).
              if (!poster && form.posterUrl?.startsWith("http") && form.posterUrl !== show?.posterUrl) {
                poster = await downloadAsFile("Downloading poster from OMDb", form.posterUrl, "poster.jpg");
              }
              await onSave(form, { poster, backdrop: backdropFile });
            } catch (err) {
              setSaveError(err instanceof Error ? err.message : String(err));
            } finally {
              setSaving(false);
            }
          }}
          disabled={!form.title.trim() || saving}
          className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {saving ? "Saving…" : show ? "Save Changes" : "Create Show"}
        </button>
      </div>
    </Modal>
  );
}
