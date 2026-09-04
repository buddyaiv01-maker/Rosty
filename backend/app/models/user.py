from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, utcnow

# Auth (Phase 2) is deliberately deferred — this app is a single-household LAN
# appliance with no login flow. Playback progress still needs a user_id FK, so
# everything attributes to this one bootstrapped local user until real auth exists.
DEFAULT_USER_ID = 1


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="user")  # 'admin' | 'user'
    # Auth (the bundled auth service, see login/) issues JWTs whose `sub` claim is
    # its own string user id. This links that id to a local user row the first time
    # someone with that Auth account is seen here — see app/auth/deps.py.
    auth_subject: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    # Fetched from Auth once at JIT-provisioning time (not on every request —
    # see app/auth/deps.py) so role can be decided against ADMIN_EMAILS.
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
