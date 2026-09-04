from datetime import date

from pydantic import BaseModel, ConfigDict

from app.schemas.subtitle import SubtitleRead


class ShowCreate(BaseModel):
    title: str
    synopsis: str | None = None
    release_year: int | None = None
    language: str | None = None
    creator: str | None = None
    age_rating: str | None = None
    genres: list[str] = []
    cast: list[str] = []


class ShowUpdate(ShowCreate):
    pass


class EpisodeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    season_id: int
    episode_number: int
    title: str | None
    synopsis: str | None
    thumbnail_path: str | None
    runtime_min: int | None
    video_path: str | None
    air_date: date | None
    subtitles: list[SubtitleRead]


class EpisodeCreate(BaseModel):
    episode_number: int
    title: str | None = None
    synopsis: str | None = None
    runtime_min: int | None = None
    air_date: date | None = None


class EpisodeUpdate(EpisodeCreate):
    pass


class EpisodePlaybackInfo(EpisodeRead):
    """EpisodeRead plus enough show/season context for a player deep-linked by URL."""

    show_id: int
    show_title: str
    season_number: int


class SeasonRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    show_id: int
    season_number: int
    episodes: list[EpisodeRead]


class SeasonCreate(BaseModel):
    season_number: int


class ShowRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    poster_path: str | None
    backdrop_path: str | None
    synopsis: str | None
    release_year: int | None
    language: str | None
    creator: str | None
    age_rating: str | None
    date_added: date
    genres: list[str]
    cast: list[str]
    seasons: list[SeasonRead]


class ShowSummary(BaseModel):
    """Lighter payload for list views — no nested episodes."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    poster_path: str | None
    backdrop_path: str | None
    release_year: int | None
    age_rating: str | None
    date_added: date
    genres: list[str]
    season_count: int
    episode_count: int
