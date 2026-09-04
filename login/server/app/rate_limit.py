"""In-memory per-IP rate limiting for auth endpoints.

Deliberately not backed by Redis or any external store — this is a single
process serving one household's LAN, so an in-memory dict is enough and
resetting on restart is a non-issue. This is a coarse IP-based throttle on
top of the existing per-email OTP resend cooldown (see auth.py's
_issue_otp): that cooldown stops spamming one email address, this stops
one device from hammering the endpoint with many different emails/passwords.
"""

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

_hits: dict[str, list[float]] = defaultdict(list)


def rate_limit(key_prefix: str, max_requests: int, window_seconds: int):
    """Returns a FastAPI dependency that 429s once `max_requests` have been
    seen from the same client IP within `window_seconds` (sliding window)."""

    def dependency(request: Request) -> None:
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
