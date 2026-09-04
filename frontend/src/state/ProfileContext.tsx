import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as api from "../lib/api";
import { LANSTREAM_ACTIVE_PROFILE_KEY, setActiveProfileId } from "../lib/api";
import { useAuth } from "./AuthContext";

export type Profile = { id: number; name: string; avatarKey: string };

type ProfileContextValue = {
  profiles: Profile[];
  loading: boolean;
  activeProfile: Profile | null;
  selectProfile: (id: number) => void;
  /** Clears the active profile so ProfileGate shows the picker again — used by the "Switch Profile" button. */
  switchProfile: () => void;
  createProfile: (name: string, avatarKey: string) => Promise<Profile>;
  updateProfile: (id: number, patch: { name?: string; avatarKey?: string }) => Promise<Profile>;
  deleteProfile: (id: number) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

function fromDTO(dto: api.ProfileDTO): Profile {
  return { id: dto.id, name: dto.name, avatarKey: dto.avatar_key };
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!session) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Fetched for every account, admins included — an admin always has
    // exactly one (auto-created/backfilled server-side), which the effect
    // below picks up automatically. ProfileGate is what keeps admins from
    // ever seeing this as a UI choice, not this fetch.
    api
      .listProfiles()
      .then((dtos) => setProfiles(dtos.map(fromDTO)))
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, [session]);

  const selectProfile = useCallback((id: number) => {
    setProfiles((current) => {
      const found = current.find((p) => p.id === id) ?? null;
      setActiveProfile(found);
      setActiveProfileId(found?.id ?? null);
      if (found) localStorage.setItem(LANSTREAM_ACTIVE_PROFILE_KEY, String(found.id));
      return current;
    });
  }, []);

  // Restore the profile picked last time (persists across refreshes), falling
  // back to auto-selecting when there's only one profile to begin with (every
  // admin, or a regular user who's only ever made one) — either way, the
  // picker is only ever shown when neither applies.
  useEffect(() => {
    if (loading || activeProfile || profiles.length === 0) return;
    const remembered = Number(localStorage.getItem(LANSTREAM_ACTIVE_PROFILE_KEY));
    if (remembered && profiles.some((p) => p.id === remembered)) {
      selectProfile(remembered);
    } else if (profiles.length === 1) {
      selectProfile(profiles[0].id);
    }
  }, [loading, profiles, activeProfile, selectProfile]);

  const switchProfile = useCallback(() => {
    setActiveProfile(null);
    setActiveProfileId(null);
    localStorage.removeItem(LANSTREAM_ACTIVE_PROFILE_KEY);
  }, []);

  const createProfile = useCallback(async (name: string, avatarKey: string) => {
    const created = fromDTO(await api.createProfile(name, avatarKey));
    setProfiles((current) => [...current, created]);
    return created;
  }, []);

  const updateProfile = useCallback(
    async (id: number, patch: { name?: string; avatarKey?: string }) => {
      const updated = fromDTO(await api.updateProfile(id, patch));
      setProfiles((current) => current.map((p) => (p.id === id ? updated : p)));
      setActiveProfile((current) => (current?.id === id ? updated : current));
      return updated;
    },
    [],
  );

  const deleteProfile = useCallback(
    async (id: number) => {
      await api.deleteProfile(id);
      setProfiles((current) => current.filter((p) => p.id !== id));
      if (activeProfile?.id === id) {
        setActiveProfile(null);
        setActiveProfileId(null);
        localStorage.removeItem(LANSTREAM_ACTIVE_PROFILE_KEY);
      }
    },
    [activeProfile],
  );

  return (
    <ProfileContext.Provider value={{ profiles, loading, activeProfile, selectProfile, switchProfile, createProfile, updateProfile, deleteProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfiles must be used within ProfileProvider");
  return ctx;
}
