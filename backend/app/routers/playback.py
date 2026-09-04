from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth.deps import get_active_profile
from app.database import get_db
from app.interaction_log import log_event
from app.models import Episode, PlaybackProgress, Profile, Season
from app.schemas.playback import ContinueWatchingItem, ProgressRead, ProgressUpdate

router = APIRouter(prefix="/progress", tags=["playback"])

# Below this, treat the play as "just started" rather than real progress — delete
# any existing row instead of saving, so restarting a title clears it from
# Continue Watching instead of leaving it stuck near 0%.
RESUME_FLOOR_SEC = 15
# At/above this fraction watched, count the title as finished and drop it from
# Continue Watching (credits typically eat the last few percent of runtime).
COMPLETED_FRACTION = 0.95


def _get_progress(
    db: Session, profile_id: int, *, movie_id: int | None = None, episode_id: int | None = None
) -> PlaybackProgress | None:
    return db.scalar(
        select(PlaybackProgress).where(
            PlaybackProgress.profile_id == profile_id,
            PlaybackProgress.movie_id == movie_id,
            PlaybackProgress.episode_id == episode_id,
        )
    )


def _upsert(
    db: Session, profile_id: int, payload: ProgressUpdate, *, movie_id: int | None = None, episode_id: int | None = None
) -> None:
    existing = _get_progress(db, profile_id, movie_id=movie_id, episode_id=episode_id)
    if payload.position_sec < RESUME_FLOOR_SEC:
        if existing is not None:
            db.delete(existing)
            db.commit()
        return

    completed = payload.duration_sec > 0 and payload.position_sec / payload.duration_sec >= COMPLETED_FRACTION
    was_completed = existing.completed if existing else False
    if existing is None:
        existing = PlaybackProgress(profile_id=profile_id, movie_id=movie_id, episode_id=episode_id)
        db.add(existing)
    existing.position_sec = payload.position_sec
    existing.duration_sec = payload.duration_sec
    existing.completed = completed

    log_event(
        db, "watch_progress", profile_id=profile_id, movie_id=movie_id, episode_id=episode_id,
        position_sec=payload.position_sec, duration_sec=payload.duration_sec, session_id=payload.session_id,
    )
    if completed and not was_completed:
        log_event(
            db, "complete", profile_id=profile_id, movie_id=movie_id, episode_id=episode_id,
            position_sec=payload.position_sec, duration_sec=payload.duration_sec, session_id=payload.session_id,
        )
    db.commit()


def _read_or_404(row: PlaybackProgress | None) -> ProgressRead:
    if row is None:
        raise HTTPException(status_code=404, detail="No saved progress")
    return ProgressRead(position_sec=row.position_sec, duration_sec=row.duration_sec, completed=row.completed)


@router.put("/movies/{movie_id}", status_code=204)
def save_movie_progress(
    movie_id: int, payload: ProgressUpdate, db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)
) -> None:
    _upsert(db, current_profile.id, payload, movie_id=movie_id)


@router.get("/movies/{movie_id}", response_model=ProgressRead)
def get_movie_progress(
    movie_id: int, db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)
) -> ProgressRead:
    return _read_or_404(_get_progress(db, current_profile.id, movie_id=movie_id))


@router.delete("/movies/{movie_id}", status_code=204)
def remove_movie_progress(
    movie_id: int, db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)
) -> None:
    """Explicit "Remove from Continue Watching" — idempotent if nothing's saved."""
    existing = _get_progress(db, current_profile.id, movie_id=movie_id)
    if existing is not None:
        db.delete(existing)
        db.commit()


@router.put("/episodes/{episode_id}", status_code=204)
def save_episode_progress(
    episode_id: int, payload: ProgressUpdate, db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)
) -> None:
    _upsert(db, current_profile.id, payload, episode_id=episode_id)


@router.get("/episodes/{episode_id}", response_model=ProgressRead)
def get_episode_progress(
    episode_id: int, db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)
) -> ProgressRead:
    return _read_or_404(_get_progress(db, current_profile.id, episode_id=episode_id))


@router.delete("/shows/{show_id}", status_code=204)
def remove_show_progress(
    show_id: int, db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)
) -> None:
    """Explicit "Remove from Continue Watching" for a show — wipes all of this
    profile's episode progress for it. A show's card in the row can be driven
    by either an in-progress episode or a completed one (see continue_watching
    below, which then points at the *next* episode) — the viewer has no way to
    know which, so removal just clears the whole show's state rather than
    requiring them to target one specific episode.
    """
    rows = db.scalars(
        select(PlaybackProgress)
        .join(Episode, PlaybackProgress.episode_id == Episode.id)
        .join(Season, Episode.season_id == Season.id)
        .where(PlaybackProgress.profile_id == current_profile.id, Season.show_id == show_id)
    ).all()
    for row in rows:
        db.delete(row)
    db.commit()


def _next_episode(show, after: Episode) -> Episode | None:
    """show.seasons is relationship-ordered by season_number, and each season's
    .episodes by episode_number (see app/models/tv_show.py) — flattening in
    that order and stepping one past `after` is exactly "the next episode"."""
    all_episodes = [ep for season in show.seasons for ep in season.episodes]
    try:
        idx = next(i for i, ep in enumerate(all_episodes) if ep.id == after.id)
    except StopIteration:
        return None
    return all_episodes[idx + 1] if idx + 1 < len(all_episodes) else None


@router.get("/continue-watching", response_model=list[ContinueWatchingItem])
def continue_watching(db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)) -> list[ContinueWatchingItem]:
    movie_rows = db.scalars(
        select(PlaybackProgress)
        .where(
            PlaybackProgress.profile_id == current_profile.id,
            PlaybackProgress.movie_id.is_not(None),
            PlaybackProgress.completed.is_(False),
            PlaybackProgress.position_sec >= RESUME_FLOOR_SEC,
        )
        .order_by(PlaybackProgress.updated_at.desc())
        .options(selectinload(PlaybackProgress.movie))
    ).all()

    # All episode progress (completed or not) — a completed row still means the
    # *show* belongs in the row, just pointing at whatever comes next, matching
    # how Netflix keeps a series in Continue Watching after you finish an episode.
    episode_rows = db.scalars(
        select(PlaybackProgress)
        .where(PlaybackProgress.profile_id == current_profile.id, PlaybackProgress.episode_id.is_not(None))
        .order_by(PlaybackProgress.updated_at.desc())
        .options(selectinload(PlaybackProgress.episode).selectinload(Episode.season).selectinload(Season.show))
    ).all()
    # _next_episode() below reaches into show.seasons / season.episodes, which
    # aren't eager-loaded above — left as ordinary lazy loads (a couple of extra
    # small queries per show) rather than a four-level selectinload chain here.

    # One card per show — first (most recent) row wins.
    latest_per_show: dict[int, PlaybackProgress] = {}
    for row in episode_rows:
        if row.episode is None:
            continue  # orphaned row (e.g. FK cascade race) — skip rather than error
        show_id = row.episode.season.show_id
        latest_per_show.setdefault(show_id, row)

    entries: list[tuple[ContinueWatchingItem, datetime]] = []

    for row in movie_rows:
        m = row.movie
        if m is None:
            continue
        entries.append(
            (
                ContinueWatchingItem(
                    kind="movie",
                    id=m.id,
                    title=m.title,
                    poster_path=m.poster_path,
                    backdrop_path=m.backdrop_path,
                    position_sec=row.position_sec,
                    duration_sec=row.duration_sec,
                ),
                row.updated_at,
            )
        )

    for row in latest_per_show.values():
        ep = row.episode
        show = ep.season.show

        if row.completed:
            ep = _next_episode(show, ep)
            if ep is None:
                continue  # finished the whole series — drop it, like Netflix does
            position_sec, duration_sec = 0, 0
        elif row.position_sec < RESUME_FLOOR_SEC:
            continue
        else:
            position_sec, duration_sec = row.position_sec, row.duration_sec

        entries.append(
            (
                ContinueWatchingItem(
                    kind="episode",
                    id=ep.id,
                    title=f"{show.title} · S{ep.season.season_number}E{ep.episode_number}" + (f" · {ep.title}" if ep.title else ""),
                    poster_path=show.poster_path,
                    backdrop_path=show.backdrop_path,
                    position_sec=position_sec,
                    duration_sec=duration_sec,
                    show_id=show.id,
                    show_title=show.title,
                    season_number=ep.season.season_number,
                    episode_number=ep.episode_number,
                ),
                row.updated_at,
            )
        )

    entries.sort(key=lambda pair: pair[1], reverse=True)
    return [item for item, _ in entries[:20]]
