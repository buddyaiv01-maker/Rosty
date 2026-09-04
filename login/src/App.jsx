import { useEffect, useState } from "react";
import AuroraBackground from "./components/AuroraBackground.jsx";
import Hero from "./components/Hero.jsx";
import OtpVerify from "./components/OtpVerify.jsx";
import SetPassword from "./components/SetPassword.jsx";
import ForgotPassword from "./components/ForgotPassword.jsx";
import Account from "./components/Account.jsx";
import WelcomeOverlay from "./components/WelcomeOverlay.jsx";
import { fetchMe, logout as apiLogout } from "./api.js";
import "./App.css";

const TOKEN_KEY = "rosty_token";

export default function App() {
  const [step, setStep] = useState("hero");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [session, setSession] = useState(null);
  const [welcomeEmail, setWelcomeEmail] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setCheckingSession(false);
      return;
    }
    fetchMe(token)
      .then((user) => {
        setSession({ token, email: user.email });
        setStep("account");
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  const enterAccount = (token, email) => {
    localStorage.setItem(TOKEN_KEY, token);
    setSession({ token, email });
    setWelcomeEmail(email);
    setStep("account");
    setTimeout(() => setWelcomeEmail(null), 2200);
  };

  const handleNeedsVerification = (email) => {
    setPendingEmail(email);
    setStep("verify");
  };

  const handleVerified = (token, email) => {
    setPendingToken(token);
    setPendingEmail(email);
    setStep("set-password");
  };

  const handlePasswordSet = (token, email) => {
    enterAccount(token, email);
  };

  const handleLoggedIn = (token, email) => {
    enterAccount(token, email);
  };

  const handleForgotPassword = (email) => {
    setPendingEmail(email);
    setStep("forgot");
  };

  const handleResetDone = () => {
    setStep("hero");
  };

  const handleLogout = async () => {
    if (session?.token) {
      try {
        await apiLogout(session.token);
      } catch {
        // token already invalid/expired — proceed to clear locally regardless
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    setSession(null);
    setStep("hero");
  };

  const handleAccountDeleted = () => {
    localStorage.removeItem(TOKEN_KEY);
    setSession(null);
    setStep("hero");
  };

  if (checkingSession) {
    return (
      <div className="stage">
        <AuroraBackground />
      </div>
    );
  }

  return (
    <div className="stage">
      <AuroraBackground />

      {step === "hero" && (
        <Hero
          onNeedsVerification={handleNeedsVerification}
          onLoggedIn={handleLoggedIn}
          onForgotPassword={handleForgotPassword}
        />
      )}

      {step === "verify" && (
        <OtpVerify email={pendingEmail} onVerified={handleVerified} onBack={() => setStep("hero")} />
      )}

      {step === "set-password" && (
        <SetPassword token={pendingToken} email={pendingEmail} onDone={handlePasswordSet} />
      )}

      {step === "forgot" && (
        <ForgotPassword initialEmail={pendingEmail} onDone={handleResetDone} onBack={() => setStep("hero")} />
      )}

      {step === "account" && session && (
        <Account
          email={session.email}
          token={session.token}
          onLogout={handleLogout}
          onAccountDeleted={handleAccountDeleted}
        />
      )}

      {welcomeEmail && <WelcomeOverlay name={welcomeEmail} />}
    </div>
  );
}
