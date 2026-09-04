import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../../components/Modal";
import { ProfileAvatarIcon } from "../../components/ProfileAvatars";
import { useAuth } from "../../state/AuthContext";
import { useProfiles } from "../../state/ProfileContext";
import { AuthCard } from "../auth/AuthCard";
import { CreateProfileForm } from "./CreateProfileForm";

/** Renders `children` once a profile is active. Mirrors AuthGate's pattern:
 * admins skip the UI entirely, but still get a profile selected behind the
 * scenes (ProfileContext auto-selects for any single-profile account,
 * admin or not) — otherwise playback/watchlist calls would have no
 * X-Profile-Id to send. Everyone else creates/picks a profile first. */
export function ProfileGate({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { profiles, loading, activeProfile, selectProfile } = useProfiles();
  const navigate = useNavigate();

  if (loading) {
    return <div className="min-h-screen" style={{ background: "var(--bg)" }} />;
  }

  if (session?.role === "admin") {
    // Admins always have exactly one (hidden) profile, auto-selected by
    // ProfileContext — but that's still an async fetch. Rendering children
    // before it resolves would let the first request out (e.g. Home's
    // Continue Watching call) with no X-Profile-Id header yet, so this
    // waits on activeProfile the same as everyone else; it just never
    // shows a picker/creation screen once it's ready.
    if (!activeProfile) {
      return <div className="min-h-screen" style={{ background: "var(--bg)" }} />;
    }
    return <>{children}</>;
  }

  if (profiles.length === 0) {
    return (
      <AuthCard title="Create your first profile" subtitle="Pick a name and an avatar to start watching.">
        <CreateProfileForm
          submitLabel="Continue"
          onCreated={(p) => {
            selectProfile(p.id);
            navigate("/", { replace: true });
          }}
        />
      </AuthCard>
    );
  }

  if (activeProfile) {
    return <>{children}</>;
  }

  // profiles.length === 1 is handled by ProfileContext's auto-select (brief
  // blank frame while it fires); this only ever renders for 2+ profiles.
  return <WhoIsWatching />;
}

function WhoIsWatching() {
  const { profiles, selectProfile } = useProfiles();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  const pick = (id: number) => {
    selectProfile(id);
    // Always land on Home, regardless of whatever URL happened to be in the
    // address bar (e.g. left over from a previous /settings visit) — the
    // picker itself renders outside the routed app, so without this the
    // router would just pick up wherever the URL already was.
    navigate("/", { replace: true });
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-8 px-4"
      style={{
        background: "var(--bg)",
        backgroundImage:
          "radial-gradient(ellipse 70% 50% at center, color-mix(in srgb, var(--accent) 35%, transparent), transparent 70%)",
        backgroundSize: "220% 160%",
        backgroundPosition: "50% 0%",
        backgroundRepeat: "no-repeat",
        animation: "ambient-drift 14s ease-in-out infinite",
      }}
    >
      <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
        Who's watching?
      </h1>

      <div className="flex flex-wrap justify-center gap-5">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => pick(p.id)}
            className="flex flex-col items-center gap-2 rounded-xl p-3 transition-opacity hover:opacity-80"
          >
            <ProfileAvatarIcon avatarKey={p.avatarKey} size={88} />
            <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              {p.name}
            </span>
          </button>
        ))}

        {profiles.length < 5 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex flex-col items-center justify-center gap-2 rounded-xl p-3"
            style={{ color: "var(--text-dim)" }}
          >
            <div
              className="grid place-items-center rounded-full border-2 border-dashed text-2xl"
              style={{ width: 88, height: 88, borderColor: "var(--border)" }}
            >
              +
            </div>
            <span className="text-sm font-medium">Add Profile</span>
          </button>
        )}
      </div>

      {adding && (
        <Modal title="Add a profile" onClose={() => setAdding(false)} width="max-w-sm">
          <CreateProfileForm submitLabel="Add Profile" onCreated={(p) => pick(p.id)} />
        </Modal>
      )}
    </div>
  );
}
