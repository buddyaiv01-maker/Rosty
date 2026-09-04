from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, utcnow


class TVShow(Base, TimestampMixin):
    __tablename__ = "tv_shows"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    poster_path: Mapped[str | None] = mapped_column(String(1024))
    backdrop_path: Mapped[str | None] = mapped_column(String(1024))
    synopsis: Mapped[str | None] = mapped_column(Text)
    release_year: Mapped[int | None] = mapped_column(Integer)
    language: Mapped[str | None] = mapped_column(String(64))
    age_rating: Mapped[str | None] = mapped_column(String(16))
    creator: Mapped[str | None] = mapped_column(String(255))
    date_added: Mapped[date] = mapped_column(Date, default=lambda: utcnow().date(), nullable=False)

    genres: Mapped[list["ShowGenre"]] = relationship(back_populates="show", cascade="all, delete-orphan")
    cast: Mapped[list["ShowCast"]] = relationship(back_populates="show", cascade="all, delete-orphan", order_by="ShowCast.role_order")
    seasons: Mapped[list["Season"]] = relationship(back_populates="show", cascade="all, delete-orphan", order_by="Season.season_number")


class ShowGenre(Base):
    __tablename__ = "show_genres"

    show_id: Mapped[int] = mapped_column(ForeignKey("tv_shows.id", ondelete="CASCADE"), primary_key=True)
    genre_id: Mapped[int] = mapped_column(ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True)

    show: Mapped["TVShow"] = relationship(back_populates="genres")
    genre: Mapped["Genre"] = relationship()  # noqa: F821


class ShowCast(Base):
    __tablename__ = "show_cast"

    show_id: Mapped[int] = mapped_column(ForeignKey("tv_shows.id", ondelete="CASCADE"), primary_key=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id", ondelete="CASCADE"), primary_key=True)
    role_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    show: Mapped["TVShow"] = relationship(back_populates="cast")
    person: Mapped["Person"] = relationship()  # noqa: F821


class Season(Base):
    __tablename__ = "seasons"
    __table_args__ = (UniqueConstraint("show_id", "season_number", name="uq_season_show_number"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    show_id: Mapped[int] = mapped_column(ForeignKey("tv_shows.id", ondelete="CASCADE"), nullable=False)
    season_number: Mapped[int] = mapped_column(Integer, nullable=False)

    show: Mapped["TVShow"] = relationship(back_populates="seasons")
    episodes: Mapped[list["Episode"]] = relationship(back_populates="season", cascade="all, delete-orphan", order_by="Episode.episode_number")


class Episode(Base, TimestampMixin):
    __tablename__ = "episodes"
    __table_args__ = (UniqueConstraint("season_id", "episode_number", name="uq_episode_season_number"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id", ondelete="CASCADE"), nullable=False)
    episode_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    synopsis: Mapped[str | None] = mapped_column(Text)
    thumbnail_path: Mapped[str | None] = mapped_column(String(1024))
    runtime_min: Mapped[int | None] = mapped_column(Integer)
    video_path: Mapped[str | None] = mapped_column(String(1024))
    air_date: Mapped[date | None] = mapped_column(Date)

    season: Mapped["Season"] = relationship(back_populates="episodes")
    subtitles: Mapped[list["Subtitle"]] = relationship(back_populates="episode", cascade="all, delete-orphan")  # noqa: F821
