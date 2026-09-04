const BASE_URL = "http://localhost:8001";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = data?.detail;
    let message = "Something went wrong. Please try again.";

    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail) && detail.length > 0) {
      // FastAPI/Pydantic validation errors: [{ loc, msg, type }, ...]
      message = detail.map((e) => e.msg).join(" ");
    }

    throw new Error(message);
  }

  return data;
}

export function registerAccount(email) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function setPassword(token, newPassword) {
  return request("/auth/set-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ new_password: newPassword }),
  });
}

export function verifyEmail(email, code) {
  return request("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export function resendOtp(email) {
  return request("/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function forgotPassword(email) {
  return request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function verifyResetCode(email, code) {
  return request("/auth/verify-reset-code", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export function resetPassword(resetToken, newPassword) {
  return request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }),
  });
}

export function fetchMe(token) {
  return request("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function logout(token) {
  return request("/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function deleteAccount(token) {
  return request("/auth/me", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
