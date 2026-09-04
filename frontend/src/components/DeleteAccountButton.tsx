import { useState } from "react";
import { useAuth } from "../state/AuthContext";
import Modal from "./Modal";

/**
 * Self-contained trigger + confirmation modal for deleting the logged-in
 * user's account. `variant="card"` is the full red-bordered block used in
 * admin Settings; `variant="link"` is a bare text trigger for tight spaces
 * like the public nav.
 */
export default function DeleteAccountButton({ variant = "card" }: { variant?: "card" | "link" }) {
  const { session, deleteAccount } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;

  const openConfirm = () => {
    setError(null);
    setConfirming(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      // deleteAccount() clears the session; AuthGate swaps back to the login
      // screen on its own from here.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  };

  return (
    <>
      {variant === "card" ? (
        <div className="mt-4 rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--danger)" }}>
          <p className="mb-1 text-sm font-bold" style={{ color: "var(--danger)" }}>
            Delete Account
          </p>
          <p className="mb-4 text-xs" style={{ color: "var(--text-dim)" }}>
            Permanently deletes <strong style={{ color: "var(--text-muted)" }}>{session.email}</strong> — its watchlist,
            playback history, and login credentials. This can't be undone.
          </p>
          <button
            onClick={openConfirm}
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--danger)", color: "white" }}
          >
            Delete Account
          </button>
          {error && (
            <p className="mt-2 text-xs font-semibold" style={{ color: "var(--danger)" }}>
              Failed to delete: {error}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={openConfirm}
          className="rounded-full px-3 py-1.5 text-xs font-medium"
          style={{ color: "var(--danger)" }}
        >
          Delete account
        </button>
      )}

      {confirming && (
        <Modal title="Delete account?" onClose={() => (deleting ? undefined : setConfirming(false))} width="max-w-md">
          <p className="mb-5 text-sm" style={{ color: "var(--text-muted)" }}>
            This permanently deletes <strong style={{ color: "var(--text)" }}>{session.email}</strong> and everything
            tied to it — watchlist, playback progress, and the account itself. There's no undo.
          </p>
          {error && variant === "link" && (
            <p className="mb-3 text-xs font-semibold" style={{ color: "var(--danger)" }}>
              Failed to delete: {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirming(false)}
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
              {deleting ? "Deleting…" : "Delete Account"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
