import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import DeleteAccountButton from "../components/DeleteAccountButton";
import { Field, TextInput } from "../components/FormField";
import { IconCheck, IconClose } from "../components/Icons";
import Modal from "../components/Modal";
import { MAX_OMDB_KEYS, getOmdbApiKeys, setOmdbApiKeys } from "../lib/localSettings";
import * as api from "../lib/api";
import { useAuth } from "../state/AuthContext";

export default function Settings() {
  const { session } = useAuth();
  const [mediaRoot, setMediaRoot] = useState("");
  const [appDataRoot, setAppDataRoot] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [omdbKeys, setOmdbKeys] = useState<string[]>([""]);
  const [adminEmails, setAdminEmails] = useState<api.AdminEmailEntry[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdminEmail, setAddingAdminEmail] = useState(false);
  const [adminEmailError, setAdminEmailError] = useState<string | null>(null);
  const [adminEmailMessage, setAdminEmailMessage] = useState<string | null>(null);
  const [removeConfirmEntry, setRemoveConfirmEntry] = useState<api.AdminEmailEntry | null>(null);
  const [removingAdminEmail, setRemovingAdminEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = getOmdbApiKeys();
    setOmdbKeys(stored.length > 0 ? stored : [""]);

    Promise.all([api.getSettings(), api.getHealth(), api.getAdminEmails()])
      .then(([settings, health, emails]) => {
        setMediaRoot(settings.mediaRoot);
        setHost(settings.serverHost);
        setPort(String(settings.serverPort));
        setAppDataRoot(health.appDataRoot);
        setAdminEmails(emails);
        setLoadError(null);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const handleAddAdminEmail = async () => {
    const email = newAdminEmail.trim();
    if (!email) return;
    setAddingAdminEmail(true);
    setAdminEmailError(null);
    setAdminEmailMessage(null);
    try {
      const result = await api.addAdminEmail(email);
      setAdminEmails(result.emails);
      setAdminEmailMessage(result.message);
      setNewAdminEmail("");
    } catch (err) {
      setAdminEmailError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingAdminEmail(false);
    }
  };

  const confirmRemoveAdminEmail = async () => {
    const entry = removeConfirmEntry;
    if (!entry) return;
    setRemovingAdminEmail(true);
    setAdminEmailError(null);
    setAdminEmailMessage(null);
    try {
      const result = await api.removeAdminEmail(entry.email);
      setAdminEmails(result.emails);
      setAdminEmailMessage(result.message);
      setRemoveConfirmEntry(null);
    } catch (err) {
      setAdminEmailError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemovingAdminEmail(false);
    }
  };

  const updateOmdbKey = (index: number, value: string) => setOmdbKeys((keys) => keys.map((k, i) => (i === index ? value : k)));
  const removeOmdbKey = (index: number) => setOmdbKeys((keys) => keys.filter((_, i) => i !== index));
  const addOmdbKey = () => setOmdbKeys((keys) => [...keys, ""]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const portNum = Number(port);
      await api.updateSettings({ mediaRoot, serverHost: host, serverPort: Number.isFinite(portNum) && portNum > 0 ? portNum : undefined });
      setOmdbApiKeys(omdbKeys);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Storage locations and server configuration" />

      <div className="max-w-2xl p-4 sm:p-8">
        {loadError && (
          <div className="mb-4 rounded-lg p-3 text-xs" style={{ background: "var(--danger-bg, rgba(239,68,68,0.1))", color: "var(--danger)" }}>
            Couldn't load current settings: {loadError}
          </div>
        )}

        <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="mb-1 text-sm font-bold">Storage</p>
          <p className="mb-4 text-xs" style={{ color: "var(--text-dim)" }}>
            The app database, cache, and thumbnails live on the app drive. Movies and TV shows live
            on the media drive — these can be different physical disks.
          </p>

          <div className="flex flex-col gap-4">
            <Field label="Application Data Root" hint="Database, cache, thumbnails, logs — set via ROSTY_APP_DATA_ROOT before first boot, not editable here">
              <TextInput value={loading ? "Loading…" : appDataRoot} disabled />
            </Field>
            <Field label="Media Root" hint="Contains Movies/ and TV Shows/ subfolders">
              <TextInput value={mediaRoot} onChange={(e) => setMediaRoot(e.target.value)} disabled={loading} />
            </Field>
          </div>
        </div>

        <div className="mt-4 rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="mb-1 text-sm font-bold">Network</p>
          <p className="mb-4 text-xs" style={{ color: "var(--text-dim)" }}>
            The address other devices on your LAN use to reach this server. Changes take effect after
            restarting the server.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Bind Host" hint="0.0.0.0 = all network interfaces">
              <TextInput value={host} onChange={(e) => setHost(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Port">
              <TextInput value={port} onChange={(e) => setPort(e.target.value)} disabled={loading} />
            </Field>
          </div>

          <div className="mt-4 rounded-lg p-3 font-mono text-xs" style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}>
            Accessible at: http://&lt;this-PC's-LAN-IP&gt;:{port || "8080"}
          </div>
        </div>

        <div className="mt-4 rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="mb-1 text-sm font-bold">Metadata Lookup</p>
          <p className="mb-4 text-xs" style={{ color: "var(--text-dim)" }}>
            Used by "Fetch from OMDb" in the Movie/TV Show forms to auto-fill poster, synopsis, cast,
            and other metadata from a title. Get free keys at omdbapi.com/apikey.aspx — the free tier
            caps out at 1,000 requests/day, so add up to {MAX_OMDB_KEYS} keys and lookups will
            automatically move to the next one once a key hits that limit. Every successful lookup is
            also cached locally so the same title is never fetched twice.
          </p>
          <div className="flex flex-col gap-2">
            {omdbKeys.map((key, i) => (
              <Field key={i} label={`OMDb API Key ${omdbKeys.length > 1 ? i + 1 : ""}`.trim()}>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <TextInput value={key} onChange={(e) => updateOmdbKey(i, e.target.value)} placeholder="e.g. a1b2c3d4" />
                  </div>
                  {omdbKeys.length > 1 && (
                    <button
                      onClick={() => removeOmdbKey(i)}
                      className="shrink-0 rounded-lg px-3"
                      style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--danger)" }}
                      aria-label={`Remove OMDb API key ${i + 1}`}
                    >
                      <IconClose size={14} />
                    </button>
                  )}
                </div>
              </Field>
            ))}
          </div>
          {omdbKeys.length < MAX_OMDB_KEYS && (
            <button onClick={addOmdbKey} className="mt-2 text-xs font-semibold" style={{ color: "var(--accent)" }}>
              + Add another key
            </button>
          )}
        </div>

        <div className="mt-4 rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="mb-1 text-sm font-bold">Admin Access</p>
          <p className="mb-4 text-xs" style={{ color: "var(--text-dim)" }}>
            Add an email to grant admin access. If that email hasn't registered yet, it becomes
            admin the first time it registers and verifies. If it already has an account, adding it
            here promotes that account to admin immediately — and removing it here revokes admin
            access immediately, turning it back into a regular account.
          </p>

          <div className="flex flex-col gap-2">
            {adminEmails.map((entry) => {
              const isSelf = session?.email?.toLowerCase() === entry.email.toLowerCase();
              return (
                <div
                  key={entry.email}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                  style={{ background: "var(--surface-alt)" }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm">{entry.email}</span>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={
                        entry.status === "admin"
                          ? { background: "color-mix(in srgb, var(--success) 20%, transparent)", color: "var(--success)" }
                          : { background: "var(--surface)", color: "var(--text-dim)" }
                      }
                    >
                      {entry.status === "admin" ? "Admin" : "Pending"}
                    </span>
                    {isSelf && (
                      <span className="shrink-0 text-[10px]" style={{ color: "var(--text-dim)" }}>
                        (you)
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setRemoveConfirmEntry(entry)}
                    disabled={isSelf}
                    className="shrink-0 rounded-lg p-1.5 disabled:cursor-not-allowed disabled:opacity-30"
                    style={{ color: "var(--danger)" }}
                    aria-label={isSelf ? "You can't remove your own admin access" : `Remove ${entry.email} from admin access`}
                    title={isSelf ? "You can't remove your own admin access" : undefined}
                  >
                    <IconClose size={14} />
                  </button>
                </div>
              );
            })}
            {adminEmails.length === 0 && !loading && (
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                No one has admin access yet.
              </p>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <div className="flex-1">
              <TextInput
                type="email"
                placeholder="someone@example.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddAdminEmail()}
                disabled={loading || addingAdminEmail}
              />
            </div>
            <button
              onClick={handleAddAdminEmail}
              disabled={loading || addingAdminEmail || !newAdminEmail.trim()}
              className="shrink-0 rounded-lg px-4 text-sm font-semibold disabled:opacity-40"
              style={{ background: "var(--accent)", color: "white" }}
            >
              {addingAdminEmail ? "Adding…" : "Add"}
            </button>
          </div>
          {adminEmailMessage && (
            <p className="mt-2 text-xs font-semibold" style={{ color: "var(--success)" }}>
              {adminEmailMessage}
            </p>
          )}
          {adminEmailError && (
            <p className="mt-2 text-xs font-semibold" style={{ color: "var(--danger)" }}>
              {adminEmailError}
            </p>
          )}

          {removeConfirmEntry && (
            <Modal
              title={removeConfirmEntry.status === "admin" ? "Revoke admin access?" : "Remove from admin list?"}
              onClose={() => (removingAdminEmail ? undefined : setRemoveConfirmEntry(null))}
              width="max-w-md"
            >
              <p className="mb-5 text-sm" style={{ color: "var(--text-muted)" }}>
                {removeConfirmEntry.status === "admin" ? (
                  <>
                    <strong style={{ color: "var(--text)" }}>{removeConfirmEntry.email}</strong> currently has admin
                    access. Removing them revokes it immediately — they become a regular account
                    (browse/watch only). Their account itself is not deleted.
                  </>
                ) : (
                  <>
                    <strong style={{ color: "var(--text)" }}>{removeConfirmEntry.email}</strong> hasn't registered
                    yet. Removing them just takes them off this list — they won't get admin access when they
                    eventually do register.
                  </>
                )}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setRemoveConfirmEntry(null)}
                  disabled={removingAdminEmail}
                  className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  style={{ background: "var(--surface-alt)", color: "var(--text)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveAdminEmail}
                  disabled={removingAdminEmail}
                  className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  style={{ background: "var(--danger)", color: "white" }}
                >
                  {removingAdminEmail ? "Removing…" : removeConfirmEntry.status === "admin" ? "Revoke Access" : "Remove"}
                </button>
              </div>
            </Modal>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            disabled={loading || saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
            style={{ background: "var(--accent)", color: "white" }}
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--success)" }}>
              <IconCheck size={13} /> Saved
            </span>
          )}
          {saveError && (
            <span className="text-xs font-semibold" style={{ color: "var(--danger)" }}>
              Failed to save: {saveError}
            </span>
          )}
        </div>

        <DeleteAccountButton variant="card" />
      </div>
    </div>
  );
}
