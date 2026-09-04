from datetime import date

from pydantic import BaseModel, ConfigDict

from app.schemas.subtitle import SubtitleRead


class MovieCreate(BaseModel):
    title: str
    synopsis: str | None = None
    release_year: int | None = None
    runtime_min: int | None = None
    language: str | None = None
    director: str | None = None
    age_rating: str | None = None
    genres: list[str] = []
    cast: list[str] = []


class MovieUpdate(MovieCreate):
    pass


class MovieRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    poster_path: str | None
    backdrop_path: str | None
    synopsis: str | None
    release_year: int | None
    runtime_min: int | None
    language: str | None
    director: str | None
    age_rating: str | None
    video_path: str | None
    date_added: date
    genres: list[str]
    cast: list[str]
    subtitles: list[SubtitleRead]
