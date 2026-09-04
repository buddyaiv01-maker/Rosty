import { useState } from "react";
import Modal from "./Modal";
import { Field, TextInput, TextArea, Select, ChipInput, FilePicker } from "./FormField";
import { IconClose } from "./Icons";
import OmdbTitleField from "./OmdbTitleField";
import { AGE_RATINGS, GENRE_OPTIONS, nextId } from "../data/mock";
import * as api from "../lib/api";
import type { Movie, Subtitle } from "../data/types";

type PendingSubtitle = { tempId: string; language: string; file?: File };

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

const emptyMovie = (): Movie => ({
  id: nextId(),
  title: "",
  synopsis: "",
  releaseYear: new Date().getFullYear(),
  runtimeMin: 0,
  genres: [],
  language: "English",
  director: "",
  cast: [],
  ageRating: "PG-13",
  subtitles: [],
  dateAdded: new Date().toISOString().slice(0, 10),
});

export default function MovieFormModal({
  movie,
  onSave,
  onClose,
}: {
  movie: Movie | null;
  onSave: (
    m: Movie,
    files: { poster?: File; backdrop?: File; video?: File; subtitles: { language: string; file: File }[] },
  ) => void | Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Movie>(movie ?? emptyMovie());
  const [existingSubtitles, setExistingSubtitles] = useState<Subtitle[]>(movie?.subtitles ?? []);
  const [pendingSubtitles, setPendingSubtitles] = useState<PendingSubtitle[]>([]);
  const [posterFile, setPosterFile] = useState<File | undefined>();
  const [backdropFile, setBackdropFile] = useState<File | undefined>();
  const [videoFile, setVideoFile] = useState<File | undefined>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const set = <K extends keyof Movie>(key: K, value: Movie[K]) => setForm((f) => ({ ...f, [key]: value }));

  const addPendingSubtitle = () => setPendingSubtitles((prev) => [...prev, { tempId: nextId(), language: "" }]);
  const updatePendingSubtitle = (tempId: string, patch: Partial<PendingSubtitle>) =>
    setPendingSubtitles((prev) => prev.map((s) => (s.tempId === tempId ? { ...s, ...patch } : s)));
  const removePendingSubtitle = (tempId: string) => setPendingSubtitles((prev) => prev.filter((s) => s.tempId !== tempId));
  const deleteExistingSubtitle = async (id: string) => {
    await api.deleteSubtitle(id);
    setExistingSubtitles((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <Modal title={movie ? "Edit Movie" : "Add Movie"} onClose={onClose} width="max-w-3xl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <OmdbTitleField
            title={form.title}
            onTitleChange={(v) => set("title", v)}
            type="movie"
            placeholder="Movie title"
            onPick={(d) =>
              setForm((f) => ({
                ...f,
                title: d.title || f.title,
                releaseYear: d.year ? Number(d.year) : f.releaseYear,
                runtimeMin: d.runtimeMin || f.runtimeMin,
                genres: d.genres.length ? d.genres : f.genres,
                language: d.language || f.language,
                director: d.director || f.director,
                cast: d.cast.length ? d.cast : f.cast,
                ageRating: d.rated || f.ageRating,
                synopsis: d.synopsis || f.synopsis,
                posterUrl: d.posterUrl || f.posterUrl,
              }))
            }
          />
        </div>

        <Field label="Release Year">
          <TextInput
            type="number"
            value={form.releaseYear}
            onChange={(e) => set("releaseYear", Number(e.target.value))}
          />
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

        <Field label="Runtime (minutes)">
          <TextInput type="number" value={form.runtimeMin} onChange={(e) => set("runtimeMin", Number(e.target.value))} />
        </Field>
        <Field label="Language">
          <TextInput value={form.language} onChange={(e) => set("language", e.target.value)} />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Director">
            <TextInput value={form.director} onChange={(e) => set("director", e.target.value)} />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Genres">
            <ChipInput values={form.genres} onChange={(v) => set("genres", v)} options={GENRE_OPTIONS} placeholder="Add genre…" />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Cast">
            <ChipInput values={form.cast} onChange={(v) => set("cast", v)} placeholder="Type a name, press Enter" />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Video File">
            <FilePicker label="Choose video file" fileName={videoFile?.name ?? form.videoFileName} onPick={setVideoFile} accept="video/*" />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Subtitles
            </span>
            <button onClick={addPendingSubtitle} className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
              + Add subtitle track
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {existingSubtitles.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-alt)" }}>
                <span>
                  {s.language} <span style={{ color: "var(--text-dim)" }}>· .{s.format} · {s.fileName}</span>
                </span>
                <button onClick={() => deleteExistingSubtitle(s.id)} aria-label={`Remove ${s.language} subtitle`} style={{ color: "var(--danger)" }}>
                  <IconClose size={14} />
                </button>
              </div>
            ))}
            {pendingSubtitles.map((s) => (
              <div key={s.tempId} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <TextInput
                  placeholder="Language (e.g. Tamil)"
                  value={s.language}
                  onChange={(e) => updatePendingSubtitle(s.tempId, { language: e.target.value })}
                />
                <FilePicker
                  label="Choose file"
                  fileName={s.file?.name}
                  onPick={(f) => updatePendingSubtitle(s.tempId, { file: f })}
                  accept=".srt,.vtt"
                />
                <button onClick={() => removePendingSubtitle(s.tempId)} aria-label="Remove subtitle track" style={{ color: "var(--danger)" }}>
                  <IconClose size={14} />
                </button>
              </div>
            ))}
            {existingSubtitles.length === 0 && pendingSubtitles.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                No subtitle tracks yet.
              </p>
            )}
          </div>
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
              if (!poster && form.posterUrl?.startsWith("http") && form.posterUrl !== movie?.posterUrl) {
                poster = await downloadAsFile("Downloading poster from OMDb", form.posterUrl, "poster.jpg");
              }
              const subtitles = pendingSubtitles
                .filter((s): s is PendingSubtitle & { file: File } => !!s.file && !!s.language.trim())
                .map((s) => ({ language: s.language.trim(), file: s.file }));
              await onSave(form, { poster, backdrop: backdropFile, video: videoFile, subtitles });
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
          {saving ? "Saving…" : movie ? "Save Changes" : "Add Movie"}
        </button>
      </div>
    </Modal>
  );
}
