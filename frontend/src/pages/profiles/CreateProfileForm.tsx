import { useState } from "react";
import { AvatarDropdown, PROFILE_AVATARS } from "../../components/ProfileAvatars";
import { TextInput } from "../../components/FormField";
import { useProfiles, type Profile } from "../../state/ProfileContext";

const MAX_PROFILES = 5;

export function CreateProfileForm({
  onCreated,
  submitLabel = "Create Profile",
}: {
  onCreated: (profile: Profile) => void;
  submitLabel?: string;
}) {
  const { profiles, createProfile } = useProfiles();
  const [name, setName] = useState("");
  const [avatarKey, setAvatarKey] = useState(PROFILE_AVATARS[0].key);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const atLimit = profiles.length >= MAX_PROFILES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give this profile a name.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const created = await createProfile(name.trim(), avatarKey);
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (atLimit) {
    return (
      <p className="text-xs" style={{ color: "var(--text-dim)" }}>
        You've reached the {MAX_PROFILES}-profile limit for this account. Delete one to add another.
      </p>
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
      <TextInput
        placeholder="Profile name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        maxLength={40}
      />
      <AvatarDropdown value={avatarKey} onChange={setAvatarKey} />

      {error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        {submitting ? "Creating…" : submitLabel}
      </button>
    </form>
  );
}
