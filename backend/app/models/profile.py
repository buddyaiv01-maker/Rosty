from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, utcnow

# Up to 5 per user_id — enforced in app/routers/profiles.py, not here.
MAX_PROFILES_PER_USER = 5


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    # References an entry in frontend/src/components/ProfileAvatars.tsx's fixed
    # catalog — the backend just stores the key, not the SVG itself.
    avatar_key: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
