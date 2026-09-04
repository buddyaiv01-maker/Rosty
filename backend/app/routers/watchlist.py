from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import get_active_profile
from app.database import get_db
from app.interaction_log import log_event
from app.models import Movie, Profile, TVShow, WatchlistItem
from app.schemas.watchlist import WatchlistItemRead, WatchlistStatus

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


def _get_item(db: Session, profile_id: int, *, movie_id: int | None = None, show_id: int | None = None) -> WatchlistItem | None:
    return db.scalar(
        select(WatchlistItem).where(
            WatchlistItem.profile_id == profile_id,
            WatchlistItem.movie_id == movie_id,
            WatchlistItem.show_id == show_id,
        )
    )


@router.post("/movies/{movie_id}", status_code=204)
def add_movie(movie_id: int, db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)) -> None:
    if db.get(Movie, movie_id) is None:
        raise HTTPException(status_code=404, detail="Movie not found")
    if _get_item(db, current_profile.id, movie_id=movie_id) is None:
        db.add(WatchlistItem(profile_id=current_profile.id, movie_id=movie_id))
        log_event(db, "add_to_watchlist", profile_id=current_profile.id, movie_id=movie_id)
        db.commit()


@router.delete("/movies/{movie_id}", status_code=204)
def remove_movie(movie_id: int, db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)) -> None:
    item = _get_item(db, current_profile.id, movie_id=movie_id)
    if item is not None:
        db.delete(item)
        log_event(db, "remove_from_watchlist", profile_id=current_profile.id, movie_id=movie_id)
        db.commit()


@router.get("/movies/{movie_id}/status", response_model=WatchlistStatus)
def movie_status(movie_id: int, db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)) -> WatchlistStatus:
    return WatchlistStatus(in_watchlist=_get_item(db, current_profile.id, movie_id=movie_id) is not None)


@router.post("/shows/{show_id}", status_code=204)
def add_show(show_id: int, db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)) -> None:
    if db.get(TVShow, show_id) is None:
        raise HTTPException(status_code=404, detail="TV show not found")
    if _get_item(db, current_profile.id, show_id=show_id) is None:
        db.add(WatchlistItem(profile_id=current_profile.id, show_id=show_id))
        log_event(db, "add_to_watchlist", profile_id=current_profile.id, show_id=show_id)
        db.commit()


@router.delete("/shows/{show_id}", status_code=204)
def remove_show(show_id: int, db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)) -> None:
    item = _get_item(db, current_profile.id, show_id=show_id)
    if item is not None:
        db.delete(item)
        log_event(db, "remove_from_watchlist", profile_id=current_profile.id, show_id=show_id)
        db.commit()


@router.get("/shows/{show_id}/status", response_model=WatchlistStatus)
def show_status(show_id: int, db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)) -> WatchlistStatus:
    return WatchlistStatus(in_watchlist=_get_item(db, current_profile.id, show_id=show_id) is not None)


@router.get("", response_model=list[WatchlistItemRead])
def list_watchlist(db: Session = Depends(get_db), current_profile: Profile = Depends(get_active_profile)) -> list[WatchlistItemRead]:
    rows = db.scalars(
        select(WatchlistItem)
        .where(WatchlistItem.profile_id == current_profile.id)
        .order_by(WatchlistItem.added_at.desc())
        .options(selectinload(WatchlistItem.movie), selectinload(WatchlistItem.show))
    ).all()

    items: list[WatchlistItemRead] = []
    for row in rows:
        if row.movie is not None:
            m = row.movie
            items.append(
                WatchlistItemRead(
                    kind="movie", id=m.id, title=m.title, poster_path=m.poster_path,
                    backdrop_path=m.backdrop_path, release_year=m.release_year, added_at=row.added_at,
                )
            )
        elif row.show is not None:
            s = row.show
            items.append(
                WatchlistItemRead(
                    kind="show", id=s.id, title=s.title, poster_path=s.poster_path,
                    backdrop_path=s.backdrop_path, release_year=s.release_year, added_at=row.added_at,
                )
            )
        # else: orphaned row (e.g. FK cascade race) — skip rather than error.
    return items
