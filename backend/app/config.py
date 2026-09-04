"""Storage path resolution.

The one rule that shapes this whole module: media and app data can live on
different physical drives, and that mapping is config, not code.

app_data_root is a bootstrap value — it has to be known before the database
connection even exists (the DB file lives inside it), so it only ever comes
from an env var / default, never from a DB-backed setting.

media_root is different: it's read from the `settings` table so it can be
changed later from the Admin UI without redeploying. On first boot (no DB
row yet) it falls back to an env var, then a sane default, and that value
gets seeded into `settings` so it's the source of truth from then on.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.orm import Session

from app.models import Setting

# Loaded here (module import time, before anything else in the app reads
# os.environ) so a backend/.env file works the same as real process env vars —
# needed for ROSTY_JWT_SECRET, see app/auth/security.py.
load_dotenv()

DEFAULT_APP_DATA_ROOT = "./data"
DEFAULT_MEDIA_ROOT = "./media"
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = "8080"

_env_defaults = {
    "media_root": os.environ.get("LANSTREAM_MEDIA_ROOT", DEFAULT_MEDIA_ROOT),
    "server_host": os.environ.get("LANSTREAM_HOST", DEFAULT_HOST),
    "server_port": os.environ.get("LANSTREAM_PORT", DEFAULT_PORT),
}


def app_data_root() -> Path:
    """Bootstrap-only path. Never DB-backed — see module docstring."""
    return Path(os.environ.get("LANSTREAM_APP_DATA_ROOT", DEFAULT_APP_DATA_ROOT)).resolve()


def database_path() -> Path:
    return app_data_root() / "database" / "lanstream.db"


class StorageConfig:
    """DB-backed settings, with env-var bootstrap for first run.

    Construct with a session, call ensure_seeded() once at startup after
    migrations have run, then read the properties anywhere a request needs
    a resolved path.
    """

    def __init__(self, db: Session):
        self.db = db

    def get(self, key: str, default: str | None = None) -> str | None:
        row = self.db.get(Setting, key)
        if row is not None and row.value is not None:
            return row.value
        return _env_defaults.get(key, default)

    def set(self, key: str, value: str) -> None:
        row = self.db.get(Setting, key)
        if row is None:
            row = Setting(key=key, value=value)
            self.db.add(row)
        else:
            row.value = value
        self.db.commit()

    def ensure_seeded(self) -> None:
        """Write env-var/default values into `settings` if not already present."""
        for key, value in _env_defaults.items():
            if self.db.get(Setting, key) is None:
                self.db.add(Setting(key=key, value=value))
        self.db.commit()

    @property
    def media_root(self) -> Path:
        return Path(self.get("media_root", DEFAULT_MEDIA_ROOT)).resolve()

    @property
    def movies_root(self) -> Path:
        return self.media_root / "Movies"

    @property
    def tv_shows_root(self) -> Path:
        return self.media_root / "TV Shows"

    @property
    def cache_root(self) -> Path:
        return app_data_root() / "cache"

    @property
    def thumbnails_root(self) -> Path:
        return app_data_root() / "thumbnails"

    @property
    def logs_root(self) -> Path:
        return app_data_root() / "logs"

    @property
    def server_host(self) -> str:
        return self.get("server_host", DEFAULT_HOST) or DEFAULT_HOST

    @property
    def server_port(self) -> int:
        return int(self.get("server_port", DEFAULT_PORT) or DEFAULT_PORT)


def ensure_data_dirs() -> None:
    """Create the directories that must exist before the app can run.

    media_root itself is NOT created here — it may be an external drive that
    isn't mounted yet, and silently creating it would mask that problem.
    """
    for d in [app_data_root(), database_path().parent, app_data_root() / "cache", app_data_root() / "thumbnails", app_data_root() / "logs"]:
        d.mkdir(parents=True, exist_ok=True)
