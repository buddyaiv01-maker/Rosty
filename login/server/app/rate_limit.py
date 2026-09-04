"""In-memory per-IP rate limiting for auth endpoints, with admin-editable
thresholds.

The hit-counting itself is deliberately not backed by Redis or any external
store — this is a single process serving one household's LAN, so an
in-memory dict is enough and resetting on restart is a non-issue. This is a
coarse IP-based throttle on top of the existing per-email OTP resend
cooldown (see auth.py's _issue_otp): that cooldown stops spamming one email
address, this stops one device from hammering the endpoint with many
different emails/passwords.

The thresholds themselves ARE DB-backed (see Setting in models.py) so an
admin can change them live from Rosty's Settings page without a restart —
see app/routers/internal.py for the endpoint that edits them.
"""

import time
from collections import defaultdict

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import Setting

_hits: dict[str, list[float]] = defaultdict(list)

DEFAULTS = {
    "login": (10, 900),  # 10 attempts / 15 min
    "register": (5, 3600),  # 5 attempts / 1 hour
}


def get_rate_limit_config(db: Session, key_prefix: str) -> tuple[int, int]:
    default_max, default_window = DEFAULTS[key_prefix]
    max_row = db.get(Setting, f"rate_limit.{key_prefix}.max_requests")
    window_row = db.get(Setting, f"rate_limit.{key_prefix}.window_seconds")
    max_requests = int(max_row.value) if max_row and max_row.value else default_max
    window_seconds = int(window_row.value) if window_row and window_row.value else default_window
    return max_requests, window_seconds


def set_rate_limit_config(db: Session, key_prefix: str, max_requests: int, window_seconds: int) -> None:
    for key, value in (
        (f"rate_limit.{key_prefix}.max_requests", str(max_requests)),
        (f"rate_limit.{key_prefix}.window_seconds", str(window_seconds)),
    ):
        row = db.get(Setting, key)
        if row is None:
            db.add(Setting(key=key, value=value))
        else:
            row.value = value
    db.commit()


def rate_limit(key_prefix: str):
    """Returns a FastAPI dependency that 429s once the configured max
    requests have been seen from the same client IP within the configured
    window (sliding window). Reads the current threshold from the DB on
    every call, so an admin's change takes effect immediately."""

    def dependency(request: Request, db: Session = Depends(get_db)) -> None:
        max_requests, window_seconds = get_rate_limit_config(db, key_prefix)
        client_ip = request.client.host if request.client else "unknown"
        key = f"{key_prefix}:{client_ip}"
        now = time.monotonic()
        hits = _hits[key]
        cutoff = now - window_seconds
        while hits and hits[0] < cutoff:
            hits.pop(0)
        if len(hits) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait a bit and try again.",
            )
        hits.append(now)

    return dependency
