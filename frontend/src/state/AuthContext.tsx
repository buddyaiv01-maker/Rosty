import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ROSTY_ACTIVE_PROFILE_KEY, deleteAccount as deleteRostyAccount, getAccount } from "../lib/api";
import { ROSTY_TOKEN_KEY, deleteAccount as deleteAuthAccount, fetchMe, logout as apiLogout } from "../lib/authApi";

type Session = { token: string; email: string; role: "admin" | "user" } | null;

type AuthContextValue = {
  session: Session;
  checkingSession: boolean;
  enterSession: (token: string, email: string) => void;
  logout: () => void;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(ROSTY_TOKEN_KEY);
    if (!token) {
      setCheckingSession(false);
      return;
    }
    fetchMe(token)
      // getAccount() hits Rosty's own backend, which JIT-provisions the
      // local user row (and decides its role) on first contact — this is
      // that first contact for a freshly verified Auth session.
      .then((user) => getAccount().then((account) => setSession({ token, email: user.email, role: account.role })))
      .catch(() => localStorage.removeItem(ROSTY_TOKEN_KEY))
      .finally(() => setCheckingSession(false));
  }, []);

  const enterSession = (token: string, email: string) => {
    localStorage.setItem(ROSTY_TOKEN_KEY, token);
    getAccount()
      .then((account) => setSession({ token, email, role: account.role }))
      .catch(() => setSession({ token, email, role: "user" }));
  };

  const logout = () => {
    const token = session?.token;
    localStorage.removeItem(ROSTY_TOKEN_KEY);
    localStorage.removeItem(ROSTY_ACTIVE_PROFILE_KEY);
    setSession(null);
    if (token) apiLogout(token).catch(() => {});
  };

  const deleteAccount = async () => {
    const token = session?.token;
    if (!token) return;
    // Rosty row first (needs the token to still resolve to a user there);
    // Auth's own record second. If the first throws, the caller sees the
    // error and nothing is deleted from either side.
    await deleteRostyAccount();
    await deleteAuthAccount(token).catch(() => {});
    localStorage.removeItem(ROSTY_TOKEN_KEY);
    localStorage.removeItem(ROSTY_ACTIVE_PROFILE_KEY);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, checkingSession, enterSession, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
