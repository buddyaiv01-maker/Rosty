from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.deps import get_current_user, require_admin
from app.config import StorageConfig
from app.database import SessionLocal
from app.models import DEFAULT_USER_ID, User
from app.routers import account, events, hero, media, movies, playback, profiles, scan, streaming, subtitles, system, tv_shows, watchlist


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


app = FastAPI(title="LANStream", lifespan=lifespan)

# LAN appliance, not a public service — any device on the local network may
# call the API from the CMS/player frontend, so origin is not restricted.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# system/streaming/media stay open: system is pre-login diagnostics (its one
# mutating route, PUT /settings, gets its own require_admin — see system.py),
# and streaming/media are hit directly by <video>/<img>/<track> tags which
# can't attach an Authorization header. Everything else requires a logged-in
# Rosty account (see app/auth/deps.py); movies/tv_shows also allow any logged-in
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
