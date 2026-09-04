import { useState } from "react";
import { setPassword as setPasswordApi } from "../api.js";

export default function SetPassword({ token, email, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const result = await setPasswordApi(token, password);
      onDone(result.access_token, email);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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
          <h1>Set your password</h1>
          <p className="subtitle">
            Email verified for <strong>{email}</strong>. Choose a password to finish.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <input
              type="password"
              id="new-password"
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <label htmlFor="new-password">Password</label>
            <span className="field-glow" />
          </div>

          <div className="field">
            <input
              type="password"
              id="confirm-password"
              placeholder=" "
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
            <label htmlFor="confirm-password">Confirm password</label>
            <span className="field-glow" />
          </div>

          <p className="error-msg" aria-live="polite">
            {error}
          </p>

          <button type="submit" className="cta" disabled={submitting}>
            <span className="cta-label">{submitting ? "Saving…" : "Finish"}</span>
            <span className="cta-icon">&rarr;</span>
          </button>
        </form>
      </section>
    </div>
  );
}
