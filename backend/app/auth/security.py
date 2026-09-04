"""Verifies JWTs issued by the bundled Rosty auth service (see login/server).

LANStream never talks to Rosty over the network to check a token — it just
needs to hold the same JWT_SECRET Rosty signs with (set ROSTY_JWT_SECRET here
to match login/server/.env's JWT_SECRET) and decode locally. Mirrors the
scope-checked HS256 decode in login/server/app/security.py.
"""

import json
import os
import urllib.error
import urllib.request

import jwt


def decode_rosty_access_token(token: str) -> str | None:
    """Returns the Rosty user id (the token's `sub`), or None if invalid/expired.

    Reads ROSTY_JWT_SECRET at call time, not import time — it may be loaded
    from backend/.env by app.config, and import order isn't guaranteed to put
    that before this module.
    """
    secret = os.environ.get("ROSTY_JWT_SECRET", "")
    algorithm = os.environ.get("ROSTY_JWT_ALGORITHM", "HS256")
    try:
        payload = jwt.decode(token, secret, algorithms=[algorithm])
    except jwt.PyJWTError:
        return None
    if payload.get("scope") != "access":
        return None
    return payload.get("sub")


def fetch_rosty_email(token: str) -> str | None:
    """One-off call to Rosty's /auth/me, used only at JIT-provisioning time (see
    app/auth/deps.py) to learn the email behind a brand-new Rosty account —
    the JWT itself only carries the opaque Rosty user id, not the email
    ADMIN_EMAILS needs to match against. Not used on the hot path of ordinary
    requests, so it doesn't undermine verifying tokens locally otherwise.
    """
    base_url = os.environ.get("ROSTY_BASE_URL", "http://localhost:8001")
    req = urllib.request.Request(f"{base_url}/auth/me", headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return json.load(res).get("email")
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None
