# Rosty — Security Model

This app is a **self-hosted, LAN-only media appliance for one household**,
not a public-facing service. Several choices that would be red flags for
an internet-facing app are deliberate here, because the actual threat model
is different. This doc makes that reasoning explicit so it reads as a
decision, not an oversight.

## Threat model

- **In scope**: other devices on the same LAN reaching the app's ports;
  a compromised/malicious page in a LAN device's browser trying to abuse
  the API; a malformed or malicious media file being scanned/served; a
  malicious image URL being proxied through `/api/media/proxy-image`.
- **Out of scope (by design, not oversight)**: internet-based attackers.
  This app assumes it is **never directly exposed to the internet** — no
  port-forwarding it to a router's WAN side. If you want access away from
  home, put a VPN (Tailscale, WireGuard) in front of it instead of opening
  ports; that keeps the app itself unaware of and unaffected by that
  decision, and keeps this threat model intact.

## Why CORS is `allow_origins=["*"]` on both services

Both `backend/app/main.py` and `login/server/app/main.py` set a wildcard
CORS origin. This is safe *specifically because* of one other fact: auth
uses a **Bearer token in an `Authorization` header, not a cookie**, and
`allow_credentials` is deliberately never set. A wildcard CORS origin
combined with `allow_credentials: true` would be a real vulnerability
(any site could ride a logged-in user's cookie); combined with
Bearer-token auth and no credentialed requests, a malicious page still
can't do anything a normal `fetch()` without a token couldn't already do,
because it has no way to obtain the token itself. The alternative —
pinning to a specific origin — isn't practical here anyway: the LAN IP a
given device uses to reach the app isn't known ahead of time (see
`ARCHITECTURE.md`).

## What's actively defended

- **Path traversal**: media file serving (`backend/app/routers/media.py`,
  `streaming.py`) resolves the requested path and checks it's still under
  `media_root` before serving — a request like `../../etc/passwd` gets
  rejected rather than escaping the media directory.
- **SSRF**: `/api/media/proxy-image` (used to fetch OMDb poster images
  same-origin) checks the target host against an explicit allowlist
  (`ALLOWED_PROXY_HOSTS`) before making the request — it can't be used to
  probe internal network addresses.
- **SQL injection**: not applicable — every database access goes through
  SQLAlchemy's ORM/Core query builder, never raw string-interpolated SQL.
- **Secrets**: `JWT_SECRET`/`AUTH_JWT_SECRET`, SMTP credentials, and
  `ADMIN_EMAILS` all live in `.env` files, which are gitignored (see
  `.gitignore`) and never committed. `.env.example` files document what
  each key does without holding real values.
- **Unhandled errors**: both FastAPI apps register a catch-all exception
  handler (`backend/app/main.py`, `login/server/app/main.py`) so a bug
  never leaks a raw Python traceback to a client — it logs server-side and
  returns a generic `{"detail": "Internal server error."}`.

## Known gaps (tracked, not hidden)

- **Rate limiting**: `/auth/login` and `/auth/register` have no rate limit
  beyond the existing per-email OTP resend cooldown — a slow-drip
  credential-stuffing attempt from a single LAN device isn't currently
  throttled. Worth adding if this app is ever used somewhere with less
  trusted devices on the LAN than a home network.
- **No HTTPS by default**: both services and the frontend serve plain
  HTTP. Fine on a trusted home LAN; if that assumption changes, put Caddy
  or Nginx in front (see `docs/MINI_PC_DEPLOYMENT.md`) — the app is
  already structured so a reverse proxy can be dropped in without touching
  application code.
- **No automated security testing**: no dependency-vulnerability scanning
  or SAST currently wired into CI (there is no CI yet at all — see the
  test-coverage gap tracked separately).

## Reporting

Since this is a personal single-household project rather than a
maintained public package, there's no formal disclosure process — if you
find something, just flag it directly to whoever's running the instance.
