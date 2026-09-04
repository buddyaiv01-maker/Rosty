"""Endpoints meant to be called only by the trusted Rosty backend, never
directly by a browser — see backend/app/routers/rate_limit_config.py, which
proxies admin requests here.

Auth has no concept of "admin" (role lives entirely in the backend's own
User table — see ARCHITECTURE.md), so these can't use a role check the way
the backend's require_admin does. Instead they check a shared secret: the
same JWT_SECRET/AUTH_JWT_SECRET already required to match between the two
services for token verification (see app/security.py), reused here as a
"this call really came from the backend" credential rather than inventing
and syncing a third secret across both .env files. /auth/register is
intentionally open to any LAN device; these endpoints are not — a LAN
device that could freely raise its own rate limits here would defeat the
whole point of rate limiting /auth/login.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..rate_limit import DEFAULTS, get_rate_limit_config, set_rate_limit_config
from ..schemas import RateLimitConfigResponse, RateLimitConfigUpdate, RateLimitThreshold

router = APIRouter(prefix="/internal", tags=["internal"])


def _verify_internal_secret(x_internal_secret: str = Header(...)) -> None:
    if x_internal_secret != settings.jwt_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")


# DEFAULTS' key_prefix ("register") doubles as the DB key prefix and the
# rate_limit() dependency name; RateLimitConfigResponse's field is named
# "registration" instead (a bare "register" collides with a BaseModel
# internal attribute) — this maps one to the other.
_FIELD_NAME = {"login": "login", "register": "registration"}


@router.get("/rate-limit-config", response_model=RateLimitConfigResponse, dependencies=[Depends(_verify_internal_secret)])
def get_config(db: Session = Depends(get_db)) -> RateLimitConfigResponse:
    thresholds = {}
    for key_prefix in DEFAULTS:
        max_requests, window_seconds = get_rate_limit_config(db, key_prefix)
        thresholds[_FIELD_NAME[key_prefix]] = RateLimitThreshold(max_requests=max_requests, window_seconds=window_seconds)
    return RateLimitConfigResponse(**thresholds)


@router.put("/rate-limit-config", response_model=RateLimitConfigResponse, dependencies=[Depends(_verify_internal_secret)])
def update_config(payload: RateLimitConfigUpdate, db: Session = Depends(get_db)) -> RateLimitConfigResponse:
    if payload.login is not None:
        set_rate_limit_config(db, "login", payload.login.max_requests, payload.login.window_seconds)
    if payload.registration is not None:
        set_rate_limit_config(db, "register", payload.registration.max_requests, payload.registration.window_seconds)
    return get_config(db)
