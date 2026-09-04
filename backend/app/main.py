import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.auth.deps import get_current_user, require_admin
from app.config import StorageConfig
from app.database import SessionLocal
from app.models import DEFAULT_USER_ID, User
from app.routers import (
    account,
    events,
    hero,
    media,
    movies,
    playback,
    profiles,
    scan,
    streaming,
    subtitles,
    system,
    tv_shows,
    watchlist,
)


def _ensure_default_user(db) -> None:
    if db.get(User, DEFAULT_USER_ID) is None:
        db.add(User(id=DEFAULT_USER_ID, username="local", password_hash="", role="admin"))
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        StorageConfig(db).ensure_seeded()
        _ensure_default_user(db)
    finally:
        db.close()
    yield


logger = logging.getLogger("rosty")

app = FastAPI(title="Rosty", lifespan=lifespan)

# Matches http(s)://<private-LAN-address-or-localhost>[:port] — the actual
# LAN IP a device uses isn't known ahead of time (see ARCHITECTURE.md), so
# this can't be a fixed origin list, but it's still meaningfully tighter
# than a bare wildcard: an origin from a public IP (e.g. this app somehow
# reachable over the internet, against SECURITY.md's guidance) is rejected.
_LAN_ORIGIN_REGEX = (
    r"^https?://("
    r"localhost|127\.0\.0\.1|"
    r"10(\.\d{1,3}){3}|"
    r"172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|"
    r"192\.168(\.\d{1,3}){2}"
    r")(:\d+)?$"
)


# Catches anything that isn't already an HTTPException (FastAPI/Starlette
# handle those with their own more-specific handler, registered separately —
# this one only ever fires for genuinely unhandled errors) so a bug never
# leaks a raw traceback to the client; the real trace still goes to the logs.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


# LAN appliance, not a public service — any device on the local network may
# call the API from the CMS/player frontend, so origin can't be pinned to one
# value; allow_origin_regex reflects any private-LAN origin instead (see
# _LAN_ORIGIN_REGEX above) rather than accepting a bare wildcard.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=_LAN_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)

# system/streaming/media stay open: system is pre-login diagnostics (its one
# mutating route, PUT /settings, gets its own require_admin — see system.py),
# and streaming/media are hit directly by <video>/<img>/<track> tags which
# can't attach an Authorization header. Everything else requires a logged-in
# Auth account (see app/auth/deps.py); movies/tv_shows also allow any logged-in
# user to read but restrict writes to admins via require_admin on those routes.
app.include_router(system.router, prefix="/api")
app.include_router(streaming.router, prefix="/api")
app.include_router(media.router, prefix="/api")

auth_dep = [Depends(get_current_user)]
admin_dep = [Depends(require_admin)]
app.include_router(hero.router, prefix="/api", dependencies=auth_dep)
app.include_router(movies.router, prefix="/api", dependencies=auth_dep)
app.include_router(tv_shows.router, prefix="/api", dependencies=auth_dep)
app.include_router(subtitles.router, prefix="/api", dependencies=admin_dep)
app.include_router(scan.router, prefix="/api", dependencies=admin_dep)
# playback/watchlist/events also require login, but each endpoint injects
# get_active_profile itself (rather than as a router-level dependency) so it
# can read current_profile.id — see those routers.
app.include_router(playback.router, prefix="/api")
app.include_router(watchlist.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(account.router, prefix="/api", dependencies=auth_dep)
app.include_router(profiles.router, prefix="/api", dependencies=auth_dep)
