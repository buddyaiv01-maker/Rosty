from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Subtitle(Base):
    __tablename__ = "subtitles"
    __table_args__ = (
        CheckConstraint(
            "(movie_id IS NOT NULL AND episode_id IS NULL) OR (movie_id IS NULL AND episode_id IS NOT NULL)",
            name="ck_subtitle_exactly_one_parent",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    movie_id: Mapped[int | None] = mapped_column(ForeignKey("movies.id", ondelete="CASCADE"))
    episode_id: Mapped[int | None] = mapped_column(ForeignKey("episodes.id", ondelete="CASCADE"))
    language: Mapped[str] = mapped_column(String(64), nullable=False)  # free text, not an enum
    format: Mapped[str] = mapped_column(String(8), nullable=False)  # 'srt' | 'vtt'
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)

    movie: Mapped["Movie | None"] = relationship(back_populates="subtitles")  # noqa: F821
    episode: Mapped["Episode | None"] = relationship(back_populates="subtitles")  # noqa: F821
