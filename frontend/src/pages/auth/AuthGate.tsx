import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../../state/AuthContext";
import { ForgotPassword } from "./ForgotPassword";
import { Hero } from "./Hero";
import { OtpVerify } from "./OtpVerify";
import { SetPassword } from "./SetPassword";

type Step = "hero" | "verify" | "set-password" | "forgot";

/** Renders `children` once a Rosty session exists; otherwise runs the auth flow. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, checkingSession, enterSession } = useAuth();
  const [step, setStep] = useState<Step>("hero");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingToken, setPendingToken] = useState("");

  // AuthGate doesn't unmount across login/logout (children just render or
  // don't), so without this a logout would leave `step` wherever the flow was
  // last left instead of back at the hero screen.
  useEffect(() => {
    if (!session) setStep("hero");
  }, [session]);

  if (checkingSession) {
    return <div className="min-h-screen" style={{ background: "var(--bg)" }} />;
  }

  if (session) {
    return <>{children}</>;
  }

  if (step === "verify") {
    return (
      <OtpVerify
        email={pendingEmail}
        onVerified={(token, email) => {
          setPendingToken(token);
          setPendingEmail(email);
          setStep("set-password");
        }}
        onBack={() => setStep("hero")}
      />
    );
  }

  if (step === "set-password") {
    return <SetPassword token={pendingToken} email={pendingEmail} onDone={enterSession} />;
  }

  if (step === "forgot") {
    return (
      <ForgotPassword
        initialEmail={pendingEmail}
        onDone={() => setStep("hero")}
        onBack={() => setStep("hero")}
      />
    );
  }

  return (
    <Hero
      onNeedsVerification={(email) => {
        setPendingEmail(email);
        setStep("verify");
      }}
      onLoggedIn={enterSession}
      onForgotPassword={(email) => {
        setPendingEmail(email);
        setStep("forgot");
      }}
    />
  );
}
