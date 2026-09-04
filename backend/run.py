"""Entry point: `python run.py` -> http://localhost:<port> (and LAN IP:<port>).

Creates the app-data directories, runs pending Alembic migrations, then
starts uvicorn bound to the configured host/port.
"""

from pathlib import Path

import uvicorn
from alembic import command
from alembic.config import Config as AlembicConfig

from app.config import StorageConfig, ensure_data_dirs
from app.database import SessionLocal

BACKEND_DIR = Path(__file__).parent


def run_migrations() -> None:
    cfg = AlembicConfig(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")


def main() -> None:
    ensure_data_dirs()
    run_migrations()

    db = SessionLocal()
    try:
        storage = StorageConfig(db)
        storage.ensure_seeded()
        host, port = storage.server_host, storage.server_port
    finally:
        db.close()

    print(f"LANStream starting on http://{host}:{port}  (local: http://localhost:{port})")
    uvicorn.run("app.main:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
