// Client for the bundled Rosty auth service (../../login), which issues the
// JWTs LANStream's own backend verifies (see backend/app/auth). Mirrors
// login/src/api.js one-to-one — kept separate from lib/api.ts because it talks
// to a different origin/port.

// Same host the frontend itself was loaded from (localhost when you're on the
// server machine, the server's LAN IP when another device on the network
// loaded it that way) — a hardcoded "localhost" would resolve to the other
// device itself and never reach this server's Rosty instance.
const ROSTY_BASE_URL = `http://${window.location.hostname}:8001`;

export const LANSTREAM_TOKEN_KEY = "lanstream_token";

export type RostyUser = { id: string; email: string; email_verified: boolean };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ROSTY_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = data?.detail;
    let message = "Something went wrong. Please try again.";
    if (typeof detail === "string") message = detail;
    else if (Array.isArray(detail) && detail.length > 0) message = detail.map((e: any) => e.msg).join(" ");
    throw new Error(message);
  }

  return data as T;
}

export function registerAccount(email: string) {
  return request<{ message: string }>("/auth/register", { method: "POST", body: JSON.stringify({ email }) });
}

export function verifyEmail(email: string, code: string) {
  return request<{ access_token: string }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ email, code }) });
}

export function resendOtp(email: string) {
  return request<{ message: string }>("/auth/resend-otp", { method: "POST", body: JSON.stringify({ email }) });
}

export function setPassword(token: string, newPassword: string) {
  return request<{ access_token: string }>("/auth/set-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ new_password: newPassword }),
  });
}

export function login(email: string, password: string) {
  return request<{ access_token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function forgotPassword(email: string) {
  return request<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

export function verifyResetCode(email: string, code: string) {
  return request<{ reset_token: string }>("/auth/verify-reset-code", { method: "POST", body: JSON.stringify({ email, code }) });
}

export function resetPassword(resetToken: string, newPassword: string) {
  return request<{ access_token: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }),
  });
}

export function fetchMe(token: string) {
  return request<RostyUser>("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
}

export function logout(token: string) {
  return request<{ message: string }>("/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
}

export function deleteAccount(token: string) {
  return request<{ message: string }>("/auth/me", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
}
