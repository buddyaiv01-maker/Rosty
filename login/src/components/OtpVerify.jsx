import { useState } from "react";
import { resendOtp, verifyEmail } from "../api.js";

export default function OtpVerify({ email, onVerified, onBack }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (code.trim().length < 4) {
      setError("Enter the code from your email.");
      return;
    }

    setError("");
    setInfo("");
    setSubmitting(true);

    try {
      const result = await verifyEmail(email, code.trim());
      onVerified(result.access_token, email);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setInfo("");
    setResending(true);
    try {
      await resendOtp(email);
      setInfo("A new code is on its way.");
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="stage-content">
      <section className="glass-card">
        <div className="glass-sheen" />

        {onBack && (
          <button type="button" className="back-btn" onClick={onBack} aria-label="Go back">
            &larr;
          </button>
        )}

        <div className="brand">
          <div className="brand-mark">
            <img src="/loginlogo.png" alt="" />
          </div>
          <h1>Check your email</h1>
          <p className="subtitle">
            Enter the 6-digit code sent to <strong>{email}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <input
              type="text"
              inputMode="numeric"
              id="otp"
              name="otp"
              placeholder=" "
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <label htmlFor="otp">Verification code</label>
            <span className="field-glow" />
          </div>

          <p className="error-msg" aria-live="polite">
            {error || info}
          </p>

          <button type="submit" className="cta" disabled={submitting}>
            <span className="cta-label">{submitting ? "Verifying…" : "Verify"}</span>
            <span className="cta-icon">&rarr;</span>
          </button>
        </form>

        <p className="footnote">
          Didn't get it?{" "}
          <button type="button" className="link-btn inline" onClick={handleResend} disabled={resending}>
            {resending ? "Sending…" : "Resend code"}
          </button>
        </p>
      </section>
    </div>
  );
}
