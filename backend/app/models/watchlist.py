from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, utcnow


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    __table_args__ = (
        CheckConstraint(
            "(movie_id IS NOT NULL AND show_id IS NULL) OR (movie_id IS NULL AND show_id IS NOT NULL)",
            name="ck_watchlist_exactly_one_parent",
        ),
        UniqueConstraint("profile_id", "movie_id", "show_id", name="uq_watchlist_profile_content"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    movie_id: Mapped[int | None] = mapped_column(ForeignKey("movies.id", ondelete="CASCADE"))
    show_id: Mapped[int | None] = mapped_column(ForeignKey("tv_shows.id", ondelete="CASCADE"))
    added_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    movie: Mapped["Movie | None"] = relationship()  # noqa: F821
    show: Mapped["TVShow | None"] = relationship()  # noqa: F821
