# Rosty

Self-hosted, LAN-only media server. See [DESIGN.md](DESIGN.md) and [PHASES.md](PHASES.md) for the full design and build status.

## Running it

Auth is handled by the bundled Auth service in [`login/`](login) (a copy of the standalone `Login` project). Three processes run together in dev:

```bash
# 1. Auth service — issues the login/signup JWTs
cd login/server
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# 2. Rosty backend — verifies those JWTs, serves the API
cd backend
python run.py

# 3. Rosty frontend
cd frontend
npm run dev
```

First-time setup for each:

- `login/server`: needs its `.env` filled in (SMTP creds already present in the copy under `login/server/.env`; see `.env.example` for what each key does). **Must** be started with `--host 0.0.0.0`, not the bare default — otherwise it only listens on the server machine's loopback and other LAN devices can't reach it at all.
- `backend`: needs `AUTH_JWT_SECRET` in `backend/.env` to **exactly match** `JWT_SECRET` in `login/server/.env` — Rosty verifies Auth's tokens locally without calling out to it, so the shared secret is what makes that work. Run `python run.py` once to apply migrations. Already binds `0.0.0.0` by default.
- `frontend`: no login-specific setup; it resolves the Auth service at whatever host the page itself was loaded from (`window.location.hostname`) on port 8001, and talks to the Rosty backend through the existing `/api` Vite proxy. Vite's dev server already binds all interfaces (`host: true` in `vite.config.ts`).

### LAN access

Other devices on the network reach the whole thing through your server's LAN IP, e.g. `http://192.168.2.111:5185` — same as any other LAN-appliance access here, nothing device-specific to configure. Auth's CORS is wide open for the same reason Rosty's own backend CORS is (see `app/main.py` in each): the LAN IP a given device will use isn't known ahead of time, and auth uses a Bearer token rather than cookies, so an open CORS policy doesn't carry the usual credential-leak risk.

Until you log in through the app, `/api` routes other than `/api/health`, `/api/settings`, `/api/disk-usage`, `/api/stream/*`, and `/api/media/*` return 401 (see `backend/app/main.py`). The first person to register through Auth and open Rosty gets a local account auto-created on first request — there's no separate "create a Rosty account" step.
