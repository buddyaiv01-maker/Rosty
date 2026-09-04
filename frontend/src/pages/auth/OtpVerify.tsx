import { useState } from "react";
import { TextInput } from "../../components/FormField";
import { resendOtp, verifyEmail } from "../../lib/authApi";
import { AuthButton, AuthCard, AuthError, AuthInfo, AuthLink } from "./AuthCard";

export function OtpVerify({
  email,
  onVerified,
  onBack,
}: {
  email: string;
  onVerified: (token: string, email: string) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
      await resendOtp(email);
      setInfo("A new code is on its way.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthCard
      title="Check your email"
      subtitle={
        <>
          Enter the 6-digit code sent to <strong style={{ color: "var(--text)" }}>{email}</strong>
        </>
      }
      onBack={onBack}
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
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
          {submitting ? "Verifying…" : "Verify"}
        </AuthButton>

        <p className="mt-1 text-center text-xs" style={{ color: "var(--text-dim)" }}>
          Didn't get it?{" "}
          <AuthLink onClick={handleResend} disabled={resending}>
            {resending ? "Sending…" : "Resend code"}
          </AuthLink>
        </p>
      </form>
    </AuthCard>
  );
}
