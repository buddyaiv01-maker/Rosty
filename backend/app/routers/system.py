import shutil
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import require_admin
from app.config import StorageConfig, app_data_root, database_path
from app.database import get_db
from app.schemas.system import (
    DiskUsageResponse,
    DriveUsage,
    HealthResponse,
    SettingsResponse,
    SettingsUpdate,
)

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        app_data_root=str(app_data_root()),
        database_path=str(database_path()),
    )


@router.get("/settings", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db)) -> SettingsResponse:
    cfg = StorageConfig(db)
    return SettingsResponse(
        media_root=str(cfg.media_root),
        server_host=cfg.server_host,
        server_port=cfg.server_port,
    )


def _drive_usage(path: Path) -> DriveUsage:
    # media_root may point at a drive that isn't mounted yet (see config.py) —
    # probe the nearest existing ancestor instead of failing outright.
    probe = path
    while not probe.exists():
        parent = probe.parent
        if parent == probe:
            break
        probe = parent
    total, used, free = shutil.disk_usage(probe)
    return DriveUsage(path=str(path), total_bytes=total, used_bytes=used, free_bytes=free)


@router.get("/disk-usage", response_model=DiskUsageResponse)
def disk_usage(db: Session = Depends(get_db)) -> DiskUsageResponse:
    cfg = StorageConfig(db)
    return DiskUsageResponse(
        media=_drive_usage(cfg.media_root),
        app_data=_drive_usage(app_data_root()),
    )


@router.put("/settings", response_model=SettingsResponse, dependencies=[Depends(require_admin)])
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)) -> SettingsResponse:
    cfg = StorageConfig(db)
    if payload.media_root is not None:
        cfg.set("media_root", payload.media_root)
    if payload.server_host is not None:
        cfg.set("server_host", payload.server_host)
    if payload.server_port is not None:
        cfg.set("server_port", str(payload.server_port))
    return SettingsResponse(
        media_root=str(cfg.media_root),
        server_host=cfg.server_host,
        server_port=cfg.server_port,
    )
