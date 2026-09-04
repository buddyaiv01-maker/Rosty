import { useState } from "react";
import { forgotPassword, resendOtp, resetPassword, verifyResetCode } from "../api.js";

export default function ForgotPassword({ initialEmail, onDone, onBack }) {
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState(initialEmail || "");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setInfo("If an account exists for this email, a reset code has been sent.");
      setStep("verify");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (code.trim().length < 4) {
      setError("Enter the code from your email.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const result = await verifyResetCode(email.trim(), code.trim());
      setResetToken(result.reset_token);
      setInfo("");
      setStep("reset");
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
      await forgotPassword(email.trim());
      setInfo("A new code is on its way.");
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await resetPassword(resetToken, newPassword);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const titles = {
    request: "Reset password",
    verify: "Check your email",
    reset: "Choose a new password",
  };

  const subtitles = {
    request: "Enter your email to receive a reset code",
    verify: `Enter the 6-digit code sent to ${email}`,
    reset: "Code verified. Set a new password to finish.",
  };

  return (
    <div className="stage-content">
      <section className="glass-card">
        <div className="glass-sheen" />

        <button type="button" className="back-btn" onClick={onBack} aria-label="Go back">
          &larr;
        </button>

        <div className="brand">
          <div className="brand-mark">
            <img src="/loginlogo.png" alt="" />
          </div>
          <h1>{titles[step]}</h1>
          <p className="subtitle">{subtitles[step]}</p>
        </div>

        {step === "request" && (
          <form onSubmit={handleRequest} noValidate>
            <div className="field">
              <input
                type="email"
                id="fp-email"
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <label htmlFor="fp-email">Email address</label>
              <span className="field-glow" />
            </div>

            <p className="error-msg" aria-live="polite">
              {error}
            </p>

            <button type="submit" className="cta" disabled={submitting}>
              <span className="cta-label">{submitting ? "Sending…" : "Send code"}</span>
              <span className="cta-icon">&rarr;</span>
            </button>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={handleVerifyCode} noValidate>
            <div className="field">
              <input
                type="text"
                inputMode="numeric"
                id="fp-code"
                placeholder=" "
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
              <label htmlFor="fp-code">Verification code</label>
              <span className="field-glow" />
            </div>

            <p className="error-msg" aria-live="polite">
              {error || info}
            </p>

            <button type="submit" className="cta" disabled={submitting}>
              <span className="cta-label">{submitting ? "Verifying…" : "Verify code"}</span>
              <span className="cta-icon">&rarr;</span>
            </button>

            <p className="footnote">
              Didn't get it?{" "}
              <button type="button" className="link-btn inline" onClick={handleResend} disabled={resending}>
                {resending ? "Sending…" : "Resend code"}
              </button>
            </p>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={handleReset} noValidate>
            <div className="field">
              <input
                type="password"
                id="fp-password"
                placeholder=" "
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <label htmlFor="fp-password">New password</label>
              <span className="field-glow" />
            </div>

            <div className="field">
              <input
                type="password"
                id="fp-confirm"
                placeholder=" "
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <label htmlFor="fp-confirm">Confirm new password</label>
              <span className="field-glow" />
            </div>

            <p className="error-msg" aria-live="polite">
              {error}
            </p>

            <button type="submit" className="cta" disabled={submitting}>
              <span className="cta-label">{submitting ? "Updating…" : "Set new password"}</span>
              <span className="cta-icon">&rarr;</span>
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
