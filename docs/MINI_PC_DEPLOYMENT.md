# Migrating Rosty to a Mini PC (Phase 12)

Moves the exact same codebase you've been running in dev onto a dedicated
always-on Linux box. Nothing about the app changes — same three services, same
SQLite databases (or migrate to Postgres later via the same Alembic
migrations, see the end of this doc), only paths and env values differ.

## 1. Prerequisites on the Mini PC

```bash
sudo apt update
sudo apt install -y python3.12 python3.12-venv git ffmpeg nodejs npm
```

Confirm versions:

```bash
python3.12 --version   # 3.12+
node --version         # 18+
ffmpeg -version         # any recent build
```

## 2. Directory layout

Matches what PHASES.md's Phase 12 entry calls for:

```
/opt/rosty/               # the cloned repo (code)
/mnt/media/              # external HDD/DAS — your actual movie/TV files
```

`/opt/rosty` holds the code and the app's own database/cache (small,
fast, must always be available). `/mnt/media` is the large media library —
can be a separate physical drive.

## 3. Get the code onto the box

Once you have this repo on GitHub (see the version-control section below),
on the Mini PC:

```bash
sudo mkdir -p /opt/rosty
sudo chown $USER:$USER /opt/rosty
git clone <your-repo-url> /opt/rosty
cd /opt/rosty
```

If you're not using git yet, `scp`/`rsync` the project folder over instead —
just make sure you exclude `.venv/`, `node_modules/`, `data/`, and `media/`
(same as `.gitignore`) since those are either regenerated or too large to
copy wholesale.

## 4. Mount the external drive persistently

The drive must survive a reboot without you manually remounting it — find
its UUID and add an `/etc/fstab` entry rather than mounting by device name
(device names like `/dev/sdb1` can shift between boots):

```bash
sudo blkid   # find the UUID of your media drive's partition
sudo mkdir -p /mnt/media
```

Add a line to `/etc/fstab` (edit with `sudo nano /etc/fstab`):

```
UUID=<your-drive-uuid>  /mnt/media  ext4  defaults,nofail  0  2
```

`nofail` is important — without it, a missing/unplugged drive at boot can
stop the whole machine from booting. Then:

```bash
sudo mount -a   # mounts everything in fstab now, without rebooting
df -h /mnt/media   # confirm it's actually mounted
```

Reboot once and re-check `df -h /mnt/media` to confirm the mount really does
survive a restart before moving on.

## 5. Copy your existing library over (skip if starting fresh)

From your current Windows machine, copy:

- `backend/data/` → will become the new box's `backend/data/` (databases,
  cache, thumbnails — your movie/show catalog, accounts, watch history)
- `backend/media/` (or wherever your actual files live) → `/mnt/media/`
- `login/server/auth.db` → the new box's `login/server/auth.db` (real
  accounts — skip this if you'd rather everyone re-register fresh)

Any reasonably fast transfer method works (external USB drive, `rsync` over
the LAN, etc.) — this is likely the slowest step if your media library is
large.

## 6. Set up the Auth service

```bash
cd /opt/rosty/login/server
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` with real values — **reuse the same `JWT_SECRET`** you're using
today if you copied `auth.db` over (existing sessions/tokens only stay
valid if the secret matches; a new random one invalidates every account's
old address, though they can still just log in again). Also reuse the same
SMTP credentials so email OTP keeps working.

## 7. Set up the Rosty backend

```bash
cd /opt/rosty/backend
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`:

- `AUTH_JWT_SECRET` — **must exactly match** `JWT_SECRET` from step 6
- `ROSTY_MEDIA_ROOT=/mnt/media`
- `ROSTY_APP_DATA_ROOT=/opt/rosty/backend/data` (or leave the
  default `./data` if you'll always run from `/opt/rosty/backend`)
- `ADMIN_EMAILS` — same admin allow-list as before

First run applies migrations automatically:

```bash
.venv/bin/python run.py
```

Confirm `curl http://localhost:8080/api/health` returns `{"status":"ok",...}`,
then `Ctrl+C` — you'll run it as a service below instead of in the foreground.

## 8. Build the frontend

Dev mode isn't what you want on an always-on box — build it once and serve
the static output:

```bash
cd /opt/rosty/frontend
npm install
npm run build   # outputs to frontend/dist/
```

Serve `dist/` with any static file server. Simplest option, `serve`:

```bash
sudo npm install -g serve
serve -s dist -l 5185
```

The built frontend still expects `/api` to be reachable and Auth at
`window.location.hostname:8001` — same assumptions as dev, just now backed
by real running services instead of Vite's proxy.

## 9. Run all three as systemd services

So they start on boot and restart if they crash. Create three unit files:

`/etc/systemd/system/rosty-auth.service`:

```ini
[Unit]
Description=Rosty - Auth service
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/rosty/login/server
ExecStart=/opt/rosty/login/server/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001
Restart=on-failure
User=%i

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/rosty-backend.service`:

```ini
[Unit]
Description=Rosty backend
After=network.target rosty-auth.service

[Service]
Type=simple
WorkingDirectory=/opt/rosty/backend
ExecStart=/opt/rosty/backend/.venv/bin/python run.py
Restart=on-failure
User=%i

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/rosty-frontend.service`:

```ini
[Unit]
Description=Rosty frontend (static)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/rosty/frontend
ExecStart=/usr/bin/serve -s dist -l 5185
Restart=on-failure
User=%i

[Install]
WantedBy=multi-user.target
```

Replace `%i` with your actual Linux username (or set `User=` directly), then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now rosty-auth rosty-backend rosty-frontend
sudo systemctl status rosty-backend   # confirm it's active (running)
```

## 10. Firewall

If `ufw` (or similar) is active, open the three ports to the LAN:

```bash
sudo ufw allow 5185/tcp   # frontend
sudo ufw allow 8080/tcp   # backend API
sudo ufw allow 8001/tcp   # Auth service
```

## 11. Verify from another device

From a phone or laptop on the same network (not the Mini PC itself):

```
http://<mini-pc-lan-ip>:5185
```

Confirm: login works, the library shows your existing movies/shows (if you
copied `data/` over), and playing something actually streams — this is the
real test, since it's the one thing that can't be checked from `localhost`
on the box itself.

## 12. Optional — migrating SQLite to Postgres later

Not required for the move itself. If you outgrow SQLite later, both
`backend/alembic` and `login/server`'s migrations are database-agnostic —
point `DATABASE_URL` (Auth) / the backend's DB URL at a Postgres instance
instead and re-run the same migration commands against it. Data itself
doesn't migrate automatically; you'd need a one-off export/import pass
(e.g. `pgloader` for a SQLite → Postgres copy) if moving an existing library
rather than starting fresh on Postgres.
