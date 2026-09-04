import { useState } from "react";
import { login, registerAccount } from "../api.js";

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function Hero({ onNeedsVerification, onLoggedIn, onForgotPassword }) {
  const [mode, setMode] = useState("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      setError("Enter a valid email to continue.");
      return;
    }
    if (!isRegister && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      if (isRegister) {
        await registerAccount(trimmedEmail);
        onNeedsVerification(trimmedEmail);
      } else {
        const result = await login(trimmedEmail, password);
        onLoggedIn(result.access_token, trimmedEmail);
      }
    } catch (err) {
      if (isRegister && /already have an account/i.test(err.message)) {
        setMode("login");
        setError(err.message);
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hero">
      <img src="/rosty-logo.png" alt="Rosty" className="hero-brand-logo" />

      <main className="hero-main">
        <h1 className="hero-title">
          All of cinema,
          <br />
          in one place
        </h1>
        <p className="hero-price">The cinema you deserve.</p>
        <p className="hero-sub">
          {isRegister
            ? "Ready to begin? Enter your email to get a verification code."
            : "Welcome back. Sign in to keep watching."}
        </p>

        <form className="hero-form-stack glass-strip" onSubmit={handleSubmit} noValidate>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email address"
            autoComplete="email"
          />
          {!isRegister && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Password"
              autoComplete="current-password"
            />
          )}

          {error && <p className="hero-error">{error}</p>}

          <button type="submit" className="cta hero-cta-full" disabled={submitting}>
            <span className="cta-label">
              {submitting ? "Please wait…" : isRegister ? "Get Started" : "Sign In"}
            </span>
            <span className="cta-icon">&rarr;</span>
          </button>

          <div className="hero-form-links">
            {!isRegister && (
              <button type="button" className="link-btn" onClick={() => onForgotPassword(email.trim())}>
                Forgot password?
              </button>
            )}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setMode(isRegister ? "login" : "register");
                setError("");
              }}
            >
              {isRegister ? "Already have an account? Sign in" : "New here? Create account"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
