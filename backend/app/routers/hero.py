from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import require_admin
from app.database import get_db
from app.models import HeroItem, Movie, Season, TVShow
from app.schemas.hero import HeroItemCreate, HeroItemRead, HeroReorderRequest

router = APIRouter(prefix="/hero", tags=["hero"])
_admin_only = [Depends(require_admin)]


def _first_episode_id(show: TVShow) -> int | None:
    """show.seasons is relationship-ordered by season_number, and each season's
    .episodes by episode_number — the first item of the first non-empty season
    is exactly "episode 1" of the series."""
    for season in show.seasons:
        if season.episodes:
            return season.episodes[0].id
    return None


@router.get("", response_model=list[HeroItemRead])
def list_hero_items(db: Session = Depends(get_db)) -> list[HeroItemRead]:
    rows = db.scalars(
        select(HeroItem)
        .order_by(HeroItem.sort_order)
        .options(selectinload(HeroItem.movie), selectinload(HeroItem.show).selectinload(TVShow.seasons).selectinload(Season.episodes))
    ).all()

    items: list[HeroItemRead] = []
    for row in rows:
        if row.movie is not None:
            m = row.movie
            items.append(
                HeroItemRead(
                    id=row.id, kind="movie", content_id=m.id, title=m.title, synopsis=m.synopsis,
                    poster_path=m.poster_path, backdrop_path=m.backdrop_path, release_year=m.release_year,
                )
            )
        elif row.show is not None:
            s = row.show
            items.append(
                HeroItemRead(
                    id=row.id, kind="show", content_id=s.id, title=s.title, synopsis=s.synopsis,
                    poster_path=s.poster_path, backdrop_path=s.backdrop_path, release_year=s.release_year,
                    play_episode_id=_first_episode_id(s),
                )
            )
        # else: orphaned row (e.g. FK cascade race) — skip rather than error.
    return items


@router.post("", response_model=HeroItemRead, status_code=201, dependencies=_admin_only)
def add_hero_item(payload: HeroItemCreate, db: Session = Depends(get_db)) -> HeroItemRead:
    if payload.kind == "movie":
        content = db.get(Movie, payload.content_id)
        if content is None:
            raise HTTPException(status_code=404, detail="Movie not found")
        existing = db.scalar(select(HeroItem).where(HeroItem.movie_id == payload.content_id))
    else:
        content = db.get(TVShow, payload.content_id)
        if content is None:
            raise HTTPException(status_code=404, detail="TV show not found")
        existing = db.scalar(select(HeroItem).where(HeroItem.show_id == payload.content_id))

    if existing is not None:
        raise HTTPException(status_code=409, detail="Already in the hero list")

    next_order = (db.scalar(select(func.max(HeroItem.sort_order))) or -1) + 1
    item = HeroItem(
        movie_id=payload.content_id if payload.kind == "movie" else None,
        show_id=payload.content_id if payload.kind == "show" else None,
        sort_order=next_order,
    )
    db.add(item)
    db.commit()

    return HeroItemRead(
        id=item.id, kind=payload.kind, content_id=payload.content_id, title=content.title,
        synopsis=content.synopsis, poster_path=content.poster_path, backdrop_path=content.backdrop_path,
        release_year=content.release_year,
        play_episode_id=_first_episode_id(content) if payload.kind == "show" else None,
    )


@router.delete("/{item_id}", status_code=204, dependencies=_admin_only)
def remove_hero_item(item_id: int, db: Session = Depends(get_db)) -> None:
    item = db.get(HeroItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Hero item not found")
    db.delete(item)
    db.commit()


@router.put("/reorder", status_code=204, dependencies=_admin_only)
def reorder_hero_items(payload: HeroReorderRequest, db: Session = Depends(get_db)) -> None:
    items = {item.id: item for item in db.scalars(select(HeroItem).where(HeroItem.id.in_(payload.ordered_ids)))}
    if len(items) != len(payload.ordered_ids):
        raise HTTPException(status_code=400, detail="ordered_ids contains an unknown hero item")
    for index, item_id in enumerate(payload.ordered_ids):
        items[item_id].sort_order = index
    db.commit()
