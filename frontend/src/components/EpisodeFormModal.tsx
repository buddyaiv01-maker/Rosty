import { useState } from "react";
import Modal from "./Modal";
import { Field, TextInput, TextArea, FilePicker } from "./FormField";
import { IconClose, IconSearch } from "./Icons";
import { nextId } from "../data/mock";
import { lookupOmdbEpisode } from "../lib/omdb";
import * as api from "../lib/api";
import type { Episode, Subtitle } from "../data/types";

type PendingSubtitle = { tempId: string; language: string; file?: File };

const emptyEpisode = (number: number): Episode => ({
  id: nextId(),
  number,
  title: "",
  synopsis: "",
  runtimeMin: 0,
  subtitles: [],
});

type FetchStatus = { kind: "idle" } | { kind: "loading" } | { kind: "found"; cached: boolean } | { kind: "not_found" } | { kind: "error"; message: string };

export default function EpisodeFormModal({
  seriesTitle,
  seasonNumber,
  episode,
  nextNumber,
  onSave,
  onClose,
}: {
  seriesTitle: string;
  seasonNumber: number;
  episode: Episode | null;
  nextNumber: number;
  onSave: (
    e: Episode,
    files: { thumbnail?: File; video?: File; subtitles: { language: string; file: File }[] },
  ) => void | Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Episode>(episode ?? emptyEpisode(nextNumber));
  const [existingSubtitles, setExistingSubtitles] = useState<Subtitle[]>(episode?.subtitles ?? []);
  const [pendingSubtitles, setPendingSubtitles] = useState<PendingSubtitle[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | undefined>();
  const [videoFile, setVideoFile] = useState<File | undefined>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>({ kind: "idle" });
  const set = <K extends keyof Episode>(key: K, value: Episode[K]) => setForm((f) => ({ ...f, [key]: value }));

  const addPendingSubtitle = () => setPendingSubtitles((prev) => [...prev, { tempId: nextId(), language: "" }]);
  const updatePendingSubtitle = (tempId: string, patch: Partial<PendingSubtitle>) =>
    setPendingSubtitles((prev) => prev.map((s) => (s.tempId === tempId ? { ...s, ...patch } : s)));
  const removePendingSubtitle = (tempId: string) => setPendingSubtitles((prev) => prev.filter((s) => s.tempId !== tempId));
  const deleteExistingSubtitle = async (id: string) => {
    await api.deleteSubtitle(id);
    setExistingSubtitles((prev) => prev.filter((s) => s.id !== id));
  };

  const handleFetchFromOmdb = async () => {
    setFetchStatus({ kind: "loading" });
    const result = await lookupOmdbEpisode(seriesTitle, seasonNumber, form.number);
    if (result.status === "not_found") {
      setFetchStatus({ kind: "not_found" });
      return;
    }
    if (result.status === "error") {
      setFetchStatus({ kind: "error", message: result.message });
      return;
    }
    const d = result.data;
    setForm((f) => ({
      ...f,
      title: d.title || f.title,
      synopsis: d.synopsis || f.synopsis,
      runtimeMin: d.runtimeMin || f.runtimeMin,
      airDate: d.airDate || f.airDate,
      thumbnailUrl: d.thumbnailUrl || f.thumbnailUrl,
    }));
    setFetchStatus({ kind: "found", cached: result.fromCache });
  };

  return (
    <Modal title={episode ? "Edit Episode" : "Add Episode"} width="max-w-xl" onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Episode Number">
          <TextInput type="number" value={form.number} onChange={(e) => set("number", Number(e.target.value))} />
        </Field>
        <Field label="Air Date">
          <TextInput type="date" value={form.airDate ?? ""} onChange={(e) => set("airDate", e.target.value)} />
        </Field>

        <div className="sm:col-span-2">
          <Field label={`Episode Title`} hint={`Set the episode number above, then fetch S${seasonNumber}E${form.number} details from OMDb`}>
            <div className="flex gap-2">
              <div className="flex-1">
                <TextInput value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Episode title" />
              </div>
              <button
                onClick={handleFetchFromOmdb}
                disabled={fetchStatus.kind === "loading"}
                className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40"
                style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }}
              >
                <IconSearch size={14} />
                {fetchStatus.kind === "loading" ? "Fetching…" : "Fetch from OMDb"}
              </button>
            </div>
          </Field>
          {fetchStatus.kind === "found" && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--success)" }}>
              Filled from OMDb{fetchStatus.cached ? " (cached)" : ""}. Review before saving.
            </p>
          )}
          {fetchStatus.kind === "not_found" && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--warning)" }}>
              No match on OMDb for S{seasonNumber}E{form.number} of "{seriesTitle}" — enter details manually.
            </p>
          )}
          {fetchStatus.kind === "error" && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--danger)" }}>
              {fetchStatus.message}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <Field label="Synopsis">
            <TextArea value={form.synopsis} onChange={(e) => set("synopsis", e.target.value)} />
          </Field>
        </div>

        <Field label="Runtime (minutes)">
          <TextInput type="number" value={form.runtimeMin} onChange={(e) => set("runtimeMin", Number(e.target.value))} />
        </Field>
        <Field label="Thumbnail">
          <div className="flex items-center gap-3">
            {(thumbnailFile || form.thumbnailUrl) && (
              <img
                src={thumbnailFile ? URL.createObjectURL(thumbnailFile) : form.thumbnailUrl}
                alt=""
                className="h-10 w-14 shrink-0 rounded object-cover"
                style={{ border: "1px solid var(--border)" }}
              />
            )}
            <FilePicker
              label="Choose thumbnail"
              fileName={thumbnailFile?.name ?? (form.thumbnailUrl?.startsWith("http") ? "From OMDb (click to override)" : undefined)}
              onPick={setThumbnailFile}
              accept="image/*"
            />
          </div>
        </Field>

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
              let thumbnail = thumbnailFile;
              // Thumbnail came from OMDb as a remote URL and wasn't overridden — fetch it once
              // so the file lives locally (self-hosted, no external calls at playback time).
              if (!thumbnail && form.thumbnailUrl?.startsWith("http") && form.thumbnailUrl !== episode?.thumbnailUrl) {
                const res = await fetch(form.thumbnailUrl);
                const blob = await res.blob();
                thumbnail = new File([blob], "thumb.jpg", { type: blob.type || "image/jpeg" });
              }
              const subtitles = pendingSubtitles
                .filter((s): s is PendingSubtitle & { file: File } => !!s.file && !!s.language.trim())
                .map((s) => ({ language: s.language.trim(), file: s.file }));
              await onSave(form, { thumbnail, video: videoFile, subtitles });
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
          {saving ? "Saving…" : episode ? "Save Changes" : "Add Episode"}
        </button>
      </div>
    </Modal>
  );
}
