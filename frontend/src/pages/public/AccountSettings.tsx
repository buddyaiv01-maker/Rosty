import { useRef, useState } from "react";
import Modal from "../../components/Modal";
import DeleteAccountButton from "../../components/DeleteAccountButton";
import { IconEdit, IconPlus } from "../../components/Icons";
import { ProfileAvatarIcon } from "../../components/ProfileAvatars";
import { useAuth } from "../../state/AuthContext";
import { useProfiles, type Profile } from "../../state/ProfileContext";
import { CreateProfileForm } from "../profiles/CreateProfileForm";

function ProfileRow({ profile, isCurrent, onDelete }: { profile: Profile; isCurrent: boolean; onDelete: () => void }) {
  const { updateProfile } = useProfiles();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === profile.name) {
      setName(profile.name);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateProfile(profile.id, { name: trimmed });
    } catch {
      setName(profile.name);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: "var(--r-surface-alt)" }}>
      <ProfileAvatarIcon avatarKey={profile.avatarKey} size={36} />

      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={name}
          maxLength={40}
          disabled={saving}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") inputRef.current?.blur();
            if (e.key === "Escape") {
              setName(profile.name);
              setEditing(false);
            }
          }}
          className="flex-1 rounded-md border bg-transparent px-2 py-1 text-sm font-medium outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--r-accent-2)] disabled:opacity-60"
          style={{ borderColor: "var(--r-border)", color: "var(--r-text)" }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Rename"
          className="group flex flex-1 items-center gap-2 truncate rounded-md px-2 py-1 text-left text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--r-accent-2)]"
          style={{ color: "var(--r-text)" }}
        >
          <span className="truncate">
            {profile.name}
            {isCurrent && (
              <span className="ml-2 text-xs font-normal" style={{ color: "var(--r-text-dim)" }}>
                (current)
              </span>
            )}
          </span>
          <IconEdit size={12} className="shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      )}

      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
        style={{ color: "var(--danger)" }}
      >
        Delete
      </button>
    </div>
  );
}

export default function AccountSettings() {
  const { session } = useAuth();
  const { profiles, activeProfile, deleteProfile } = useProfiles();
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const isAdmin = session?.role === "admin";
  const atLimit = profiles.length >= 5;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteProfile(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <h1 className="mb-1 text-xl font-bold" style={{ color: "var(--r-text)" }}>
        Settings
      </h1>
      <p className="mb-8 text-sm" style={{ color: "var(--r-text-muted)" }}>
        {session?.email}
      </p>

      {!isAdmin && (
        <div className="mb-6 rounded-xl border p-5" style={{ background: "var(--r-surface)", borderColor: "var(--r-border)" }}>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-bold" style={{ color: "var(--r-text)" }}>
              Profiles
            </p>
            {!atLimit && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                aria-label="Add profile"
                title="Add profile"
                className="grid h-7 w-7 place-items-center rounded-full"
                style={{ background: "var(--r-surface-alt)", color: "var(--r-accent)" }}
              >
                <IconPlus size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {profiles.map((p) => (
              <ProfileRow
                key={p.id}
                profile={p}
                isCurrent={activeProfile?.id === p.id}
                onDelete={() => {
                  setError(null);
                  setDeleteTarget(p);
                }}
              />
            ))}
          </div>
        </div>
      )}

      <DeleteAccountButton variant="card" />

      {addOpen && (
        <Modal title="Add profile" onClose={() => setAddOpen(false)} width="max-w-sm">
          <CreateProfileForm onCreated={() => setAddOpen(false)} />
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete profile?" onClose={() => (deleting ? undefined : setDeleteTarget(null))} width="max-w-md">
          <p className="mb-5 text-sm" style={{ color: "var(--text-muted)" }}>
            This permanently deletes the <strong style={{ color: "var(--text)" }}>{deleteTarget.name}</strong> profile and
            its watchlist and playback history. There's no undo.
          </p>
          {error && (
            <p className="mb-3 text-xs font-semibold" style={{ color: "var(--danger)" }}>
              Failed to delete: {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
              style={{ background: "var(--surface-alt)", color: "var(--text)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
              style={{ background: "var(--danger)", color: "white" }}
            >
              {deleting ? "Deleting…" : "Delete Profile"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
