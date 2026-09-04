from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, utcnow


class HeroItem(Base):
    """Admin-curated, ordered list of titles shown in the public Home hero
    slider — separate from "recently added" so admins control what visitors
    see first rather than it just being whatever was imported last."""

    __tablename__ = "hero_items"
    __table_args__ = (
        CheckConstraint(
            "(movie_id IS NOT NULL AND show_id IS NULL) OR (movie_id IS NULL AND show_id IS NOT NULL)",
            name="ck_hero_exactly_one_parent",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    movie_id: Mapped[int | None] = mapped_column(ForeignKey("movies.id", ondelete="CASCADE"))
    show_id: Mapped[int | None] = mapped_column(ForeignKey("tv_shows.id", ondelete="CASCADE"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    movie: Mapped["Movie | None"] = relationship()  # noqa: F821
    show: Mapped["TVShow | None"] = relationship()  # noqa: F821
