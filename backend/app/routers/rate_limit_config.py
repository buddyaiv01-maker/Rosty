"""Admin control over the Auth service's per-IP rate limits on /auth/login
and /auth/register.

The thresholds themselves live in the Auth service's own DB, not Rosty's —
this router just proxies an authenticated admin's read/write to Auth's
internal endpoint (see login/server/app/routers/internal.py), attaching the
shared secret that proves the call really came from this backend and not
some other LAN device. This is the one place outside JIT-provisioning where
Rosty and Auth talk to each other synchronously — see ARCHITECTURE.md.
"""

import json
import os
import urllib.error
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.deps import require_admin
from app.schemas.rate_limit import RateLimitConfigResponse, RateLimitConfigUpdate

router = APIRouter(prefix="/rate-limit-config", tags=["rate-limit-config"], dependencies=[Depends(require_admin)])


def _auth_base_url() -> str:
    return os.environ.get("AUTH_BASE_URL", "http://localhost:8001")


def _internal_secret() -> str:
    return os.environ.get("AUTH_JWT_SECRET", "")


def _call_auth(method: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{_auth_base_url()}/internal/rate-limit-config",
        data=data,
        method=method,
        headers={"Content-Type": "application/json", "X-Internal-Secret": _internal_secret()},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        detail = json.load(e).get("detail", "Auth service rejected the request") if e.fp else "Auth service rejected the request"
        raise HTTPException(status_code=e.code, detail=detail) from e
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        raise HTTPException(status_code=503, detail="Couldn't reach the Auth service") from e


@router.get("", response_model=RateLimitConfigResponse)
def get_rate_limit_config() -> RateLimitConfigResponse:
    return RateLimitConfigResponse(**_call_auth("GET"))


@router.put("", response_model=RateLimitConfigResponse)
def update_rate_limit_config(payload: RateLimitConfigUpdate) -> RateLimitConfigResponse:
    return RateLimitConfigResponse(**_call_auth("PUT", payload.model_dump(exclude_none=True)))
