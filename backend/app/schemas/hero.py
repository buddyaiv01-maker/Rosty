from typing import Literal

from pydantic import BaseModel


class HeroItemRead(BaseModel):
    id: int  # hero_items.id — used for delete/reorder
    kind: Literal["movie", "show"]
    content_id: int  # the underlying movie_id or show_id
    title: str
    synopsis: str | None
    poster_path: str | None
    backdrop_path: str | None
    release_year: int | None
    # Shows aren't directly playable — only episodes are — so a hero slide's
    # Play button needs somewhere concrete to send a show viewer. Null if the
    # show has no episodes yet (Play then falls back to Details).
    play_episode_id: int | None = None


class HeroItemCreate(BaseModel):
    kind: Literal["movie", "show"]
    content_id: int


class HeroReorderRequest(BaseModel):
    ordered_ids: list[int]  # hero_items.id, in the desired display order
