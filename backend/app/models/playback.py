from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, utcnow


class PlaybackProgress(Base):
    __tablename__ = "playback_progress"
    __table_args__ = (
        CheckConstraint(
            "(movie_id IS NOT NULL AND episode_id IS NULL) OR (movie_id IS NULL AND episode_id IS NOT NULL)",
            name="ck_progress_exactly_one_parent",
        ),
        UniqueConstraint("profile_id", "movie_id", "episode_id", name="uq_progress_profile_content"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    movie_id: Mapped[int | None] = mapped_column(ForeignKey("movies.id", ondelete="CASCADE"))
    episode_id: Mapped[int | None] = mapped_column(ForeignKey("episodes.id", ondelete="CASCADE"))
    position_sec: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_sec: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    movie: Mapped["Movie | None"] = relationship()  # noqa: F821
    episode: Mapped["Episode | None"] = relationship()  # noqa: F821
