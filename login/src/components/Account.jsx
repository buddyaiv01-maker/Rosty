import { useState } from "react";
import { deleteAccount } from "../api.js";

export default function Account({ email, token, onLogout, onAccountDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setError("");
    setDeleting(true);
    try {
      await deleteAccount(token);
      onAccountDeleted();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div className="stage-content">
      <section className="glass-card">
        <div className="glass-sheen" />

        <div className="brand">
          <div className="brand-mark">
            <img src="/loginlogo.png" alt="" />
          </div>
          <h1>You're in</h1>
          <p className="subtitle">
            Signed in as <strong>{email}</strong>
          </p>
        </div>

        <div className="dashboard-row">
          <span className="dashboard-label">Email</span>
          <span className="dashboard-value">{email}</span>
        </div>
        <div className="dashboard-row">
          <span className="dashboard-label">Status</span>
          <span className="dashboard-value dashboard-status">Verified</span>
        </div>

        <button type="button" className="cta" onClick={onLogout}>
          <span className="cta-label">Log out</span>
        </button>

        <div className="danger-zone">
          {!confirming ? (
            <button type="button" className="link-btn danger" onClick={() => setConfirming(true)}>
              Delete account
            </button>
          ) : (
            <div className="danger-confirm">
              <p className="danger-text">
                This permanently deletes your account and data. This can't be undone.
              </p>
              {error && <p className="error-msg">{error}</p>}
              <div className="danger-actions">
                <button type="button" className="link-btn" onClick={() => setConfirming(false)} disabled={deleting}>
                  Cancel
                </button>
                <button type="button" className="danger-btn" onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Yes, delete my account"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
