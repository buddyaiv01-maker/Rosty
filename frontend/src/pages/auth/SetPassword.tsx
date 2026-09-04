import { useState } from "react";
import { TextInput } from "../../components/FormField";
import { setPassword as setPasswordApi } from "../../lib/authApi";
import { AuthButton, AuthCard, AuthError } from "./AuthCard";

export function SetPassword({
  token,
  email,
  onDone,
}: {
  token: string;
  email: string;
  onDone: (token: string, email: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Set your password"
      subtitle={
        <>
          Email verified for <strong style={{ color: "var(--text)" }}>{email}</strong>. Choose a password to finish.
        </>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
        <TextInput
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          autoFocus
        />
        <TextInput
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />

        <AuthError>{error}</AuthError>

        <AuthButton type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Finish"}
        </AuthButton>
      </form>
    </AuthCard>
  );
}
