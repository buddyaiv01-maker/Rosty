from typing import Literal

from pydantic import BaseModel


class ProgressUpdate(BaseModel):
    position_sec: int
    duration_sec: int
    session_id: str | None = None


class ProgressRead(BaseModel):
    position_sec: int
    duration_sec: int
    completed: bool


class ContinueWatchingItem(BaseModel):
    kind: Literal["movie", "episode"]
    id: int
    title: str
    poster_path: str | None
    backdrop_path: str | None
    position_sec: int
    duration_sec: int
    show_id: int | None = None
    show_title: str | None = None
    season_number: int | None = None
    episode_number: int | None = None
