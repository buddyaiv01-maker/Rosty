from pydantic import BaseModel


class MovieCandidate(BaseModel):
    relative_path: str
    filename: str
    size_bytes: int
    guessed_title: str


class EpisodeCandidate(BaseModel):
    relative_path: str
    filename: str
    size_bytes: int
    guessed_show_title: str
    guessed_season: int | None
    guessed_episode: int | None


class ScanResult(BaseModel):
    scanned_at: str
    movies: list[MovieCandidate]
    episodes: list[EpisodeCandidate]


class ImportMovie(BaseModel):
    relative_path: str
    title: str
    synopsis: str | None = None
    release_year: int | None = None
    runtime_min: int | None = None
    language: str | None = None
    director: str | None = None
    age_rating: str | None = None
    genres: list[str] = []
    cast: list[str] = []


class ImportEpisode(BaseModel):
    relative_path: str
    show_id: int
    season_number: int
    episode_number: int
    title: str | None = None
    synopsis: str | None = None
    runtime_min: int | None = None
    air_date: str | None = None
