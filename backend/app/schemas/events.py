from pydantic import BaseModel


class EventCreate(BaseModel):
    event_type: str
    movie_id: int | None = None
    episode_id: int | None = None
    show_id: int | None = None
    position_sec: int | None = None
    duration_sec: int | None = None
    session_id: str | None = None
    metadata: dict | str | None = None
