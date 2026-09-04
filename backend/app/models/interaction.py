from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, utcnow

# Raw, append-only event log — the "gold mine" for a future recommendation system.
# Deliberately lenient (no CHECK constraint tying it to exactly one content item):
# some event types are content-less (e.g. a search query), so movie_id/episode_id
# are allowed to both be null, unlike playback_progress/watchlist_items.


class InteractionEvent(Base):
    __tablename__ = "interaction_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    movie_id: Mapped[int | None] = mapped_column(ForeignKey("movies.id", ondelete="CASCADE"))
    episode_id: Mapped[int | None] = mapped_column(ForeignKey("episodes.id", ondelete="CASCADE"))
    # Show-level events (e.g. watchlisting a whole series) attach here instead of
    # movie/episode — a show itself has no video_path to "watch", only its episodes do.
    show_id: Mapped[int | None] = mapped_column(ForeignKey("tv_shows.id", ondelete="CASCADE"))
    event_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    position_sec: Mapped[int | None] = mapped_column(Integer)
    duration_sec: Mapped[int | None] = mapped_column(Integer)
    session_id: Mapped[str | None] = mapped_column(String(64), index=True)
    # Free-form JSON string for event-specific extras (search query text, device
    # info, etc.) — kept schemaless so new event types don't need a migration.
    event_metadata: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False, index=True)

    movie: Mapped["Movie | None"] = relationship()  # noqa: F821
    episode: Mapped["Episode | None"] = relationship()  # noqa: F821
    show: Mapped["TVShow | None"] = relationship()  # noqa: F821
