from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    app_data_root: str
    database_path: str


class SettingsResponse(BaseModel):
    media_root: str
    server_host: str
    server_port: int


class SettingsUpdate(BaseModel):
    media_root: str | None = None
    server_host: str | None = None
    server_port: int | None = None


class DriveUsage(BaseModel):
    path: str
    total_bytes: int
    used_bytes: int
    free_bytes: int


class DiskUsageResponse(BaseModel):
    media: DriveUsage
    app_data: DriveUsage


class ServiceStatusResponse(BaseModel):
    backend: bool
    auth_service: bool
    # Shown by the frontend when auth_service is down — dev vs. systemd
    # deployments restart it differently, see docs/MINI_PC_DEPLOYMENT.md.
    auth_restart_hint_dev: str
    auth_restart_hint_systemd: str
