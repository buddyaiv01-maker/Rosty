"""Thin helper for appending to interaction_events from other routers.

Kept deliberately dumb: callers build the row, this just adds it to the current
session so it's flushed in the same commit as the write that triggered it. See
RECOMMENDATIONS.md for what this table is for and what's still missing.
"""

import json

from sqlalchemy.orm import Session

from app.models import InteractionEvent


def log_event(
    db: Session,
    event_type: str,
    *,
    profile_id: int,
    movie_id: int | None = None,
    episode_id: int | None = None,
    show_id: int | None = None,
    position_sec: int | None = None,
    duration_sec: int | None = None,
    session_id: str | None = None,
    metadata: dict | str | None = None,
) -> None:
    db.add(
        InteractionEvent(
            profile_id=profile_id,
            movie_id=movie_id,
            episode_id=episode_id,
            show_id=show_id,
            event_type=event_type,
            position_sec=position_sec,
            duration_sec=duration_sec,
            session_id=session_id,
            event_metadata=json.dumps(metadata) if isinstance(metadata, dict) else metadata,
        )
    )
