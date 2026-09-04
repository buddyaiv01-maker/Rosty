import { useState } from "react";
import { TextInput } from "../../components/FormField";
import { login, registerAccount } from "../../lib/authApi";
import { AuthButton, AuthCard, AuthError, AuthLink } from "./AuthCard";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function Hero({
  onNeedsVerification,
  onLoggedIn,
  onForgotPassword,
}: {
  onNeedsVerification: (email: string) => void;
  onLoggedIn: (token: string, email: string) => void;
  onForgotPassword: (email: string) => void;
}) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorVariant, setErrorVariant] = useState<"error" | "info">("error");
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === "register";

  const handleSubmit = async (e: React.FormEvent) => {
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
      const message = err instanceof Error ? err.message : "Something went wrong.";
      const isExistingAccount = isRegister && /already have an account/i.test(message);
      if (isExistingAccount) {
        setMode("login");
      }
      setErrorVariant(isExistingAccount ? "info" : "error");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="All of cinema, in one place"
      subtitle={isRegister ? "Enter your email to get a verification code." : "Welcome back. Sign in to keep watching."}
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
        <TextInput
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
          autoComplete="email"
          autoFocus
        />
        {!isRegister && (
          <TextInput
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Password"
            autoComplete="current-password"
          />
        )}

        <AuthError variant={errorVariant}>{error}</AuthError>

        <AuthButton type="submit" disabled={submitting}>
          {submitting ? "Please wait…" : isRegister ? "Get Started" : "Sign In"}
        </AuthButton>

        <div className="mt-1 flex items-center justify-between">
          {!isRegister && <AuthLink onClick={() => onForgotPassword(email.trim())}>Forgot password?</AuthLink>}
          <AuthLink
            onClick={() => {
              setMode(isRegister ? "login" : "register");
              setError("");
            }}
          >
            {isRegister ? "Already have an account? Sign in" : "New here? Create account"}
          </AuthLink>
        </div>
      </form>
    </AuthCard>
  );
}
