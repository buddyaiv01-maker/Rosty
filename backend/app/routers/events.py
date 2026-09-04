from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import get_active_profile
from app.database import get_db
from app.interaction_log import log_event
from app.models import Profile
from app.schemas.events import EventCreate

router = APIRouter(prefix="/events", tags=["events"])

# Client-postable event types only — watch_progress/complete/add_to_watchlist/
# remove_from_watchlist are logged server-side from the routers that already
# know about those writes (see RECOMMENDATIONS.md), not from this generic endpoint.
ALLOWED_EVENT_TYPES = {"play", "pause", "stop", "search", "click", "skip", "rewatch", "like", "dislike"}


@router.post("", status_code=204)
def create_event(payload: EventCreate, db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)) -> None:
    if payload.event_type not in ALLOWED_EVENT_TYPES:
        raise HTTPException(status_code=422, detail=f"Unknown event_type. Expected one of {sorted(ALLOWED_EVENT_TYPES)}")
    log_event(
        db,
        payload.event_type,
        profile_id=current_profile.id,
        movie_id=payload.movie_id,
        episode_id=payload.episode_id,
        show_id=payload.show_id,
        position_sec=payload.position_sec,
        duration_sec=payload.duration_sec,
        session_id=payload.session_id,
        metadata=payload.metadata,
    )
    db.commit()
