import { useState } from "react";
import { TextInput } from "../../components/FormField";
import { forgotPassword, resetPassword, verifyResetCode } from "../../lib/authApi";
import { AuthButton, AuthCard, AuthError, AuthInfo, AuthLink } from "./AuthCard";

type Step = "request" | "verify" | "reset";

const TITLES: Record<Step, string> = {
  request: "Reset password",
  verify: "Check your email",
  reset: "Choose a new password",
};

export function ForgotPassword({
  initialEmail,
  onDone,
  onBack,
}: {
  initialEmail: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState(initialEmail || "");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const subtitle =
    step === "request"
      ? "Enter your email to receive a reset code"
      : step === "verify"
        ? `Enter the 6-digit code sent to ${email}`
        : "Code verified. Set a new password to finish.";

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setInfo("If an account exists for this email, a reset code has been sent.");
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
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
      setError(err instanceof Error ? err.message : "Something went wrong.");
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
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setResending(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
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
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title={TITLES[step]} subtitle={subtitle} onBack={onBack}>
      {step === "request" && (
        <form className="flex flex-col gap-3" onSubmit={handleRequest} noValidate>
          <TextInput
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
          />
          <AuthError>{error}</AuthError>
          <AuthButton type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send code"}
          </AuthButton>
        </form>
      )}

      {step === "verify" && (
        <form className="flex flex-col gap-3" onSubmit={handleVerifyCode} noValidate>
          <TextInput
            type="text"
            inputMode="numeric"
            placeholder="Verification code"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          <AuthError>{error}</AuthError>
          {!error && <AuthInfo>{info}</AuthInfo>}
          <AuthButton type="submit" disabled={submitting}>
            {submitting ? "Verifying…" : "Verify code"}
          </AuthButton>
          <p className="mt-1 text-center text-xs" style={{ color: "var(--text-dim)" }}>
            Didn't get it?{" "}
            <AuthLink onClick={handleResend} disabled={resending}>
              {resending ? "Sending…" : "Resend code"}
            </AuthLink>
          </p>
        </form>
      )}

      {step === "reset" && (
        <form className="flex flex-col gap-3" onSubmit={handleReset} noValidate>
          <TextInput
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
          <TextInput
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <AuthError>{error}</AuthError>
          <AuthButton type="submit" disabled={submitting}>
            {submitting ? "Updating…" : "Set new password"}
          </AuthButton>
        </form>
      )}
    </AuthCard>
  );
}
