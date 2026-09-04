from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class WatchlistStatus(BaseModel):
    in_watchlist: bool


class WatchlistItemRead(BaseModel):
    kind: Literal["movie", "show"]
    id: int
    title: str
    poster_path: str | None
    backdrop_path: str | None
    release_year: int | None
    added_at: datetime
