from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, utcnow


class Movie(Base, TimestampMixin):
    __tablename__ = "movies"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    poster_path: Mapped[str | None] = mapped_column(String(1024))
    backdrop_path: Mapped[str | None] = mapped_column(String(1024))
    synopsis: Mapped[str | None] = mapped_column(Text)
    release_year: Mapped[int | None] = mapped_column(Integer)
    runtime_min: Mapped[int | None] = mapped_column(Integer)
    language: Mapped[str | None] = mapped_column(String(64))
    director: Mapped[str | None] = mapped_column(String(255))
    age_rating: Mapped[str | None] = mapped_column(String(16))
    video_path: Mapped[str | None] = mapped_column(String(1024))
    date_added: Mapped[date] = mapped_column(Date, default=lambda: utcnow().date(), nullable=False)

    genres: Mapped[list["MovieGenre"]] = relationship(back_populates="movie", cascade="all, delete-orphan")
    cast: Mapped[list["MovieCast"]] = relationship(back_populates="movie", cascade="all, delete-orphan", order_by="MovieCast.role_order")
    subtitles: Mapped[list["Subtitle"]] = relationship(back_populates="movie", cascade="all, delete-orphan")  # noqa: F821


class MovieGenre(Base):
    __tablename__ = "movie_genres"

    movie_id: Mapped[int] = mapped_column(ForeignKey("movies.id", ondelete="CASCADE"), primary_key=True)
    genre_id: Mapped[int] = mapped_column(ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True)

    movie: Mapped["Movie"] = relationship(back_populates="genres")
    genre: Mapped["Genre"] = relationship()  # noqa: F821


class MovieCast(Base):
    __tablename__ = "movie_cast"

    movie_id: Mapped[int] = mapped_column(ForeignKey("movies.id", ondelete="CASCADE"), primary_key=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id", ondelete="CASCADE"), primary_key=True)
    role_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    movie: Mapped["Movie"] = relationship(back_populates="cast")
    person: Mapped["Person"] = relationship()  # noqa: F821
