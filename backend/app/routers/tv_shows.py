from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth.deps import require_admin
from app.config import StorageConfig
from app.database import get_db
from app.models import Episode, Genre, Person, Season, ShowCast, ShowGenre, TVShow
from app.schemas.tv_show import (
    EpisodeCreate,
    EpisodePlaybackInfo,
    EpisodeRead,
    EpisodeUpdate,
    SeasonCreate,
    SeasonRead,
    ShowCreate,
    ShowRead,
    ShowSummary,
    ShowUpdate,
)
from app.storage_files import delete_if_exists, delete_subtitle_file, remove_dir_if_empty, sanitize_folder_name, save_upload

router = APIRouter(tags=["tv-shows"])
# Router-level auth (any logged-in user) already covers reads; writes need admin too.
_admin_only = [Depends(require_admin)]


def _get_or_create_genre(db: Session, name: str) -> Genre:
    genre = db.scalar(select(Genre).where(Genre.name == name))
    if genre is None:
        genre = Genre(name=name)
        db.add(genre)
        db.flush()
    return genre


def _get_or_create_person(db: Session, name: str) -> Person:
    person = db.scalar(select(Person).where(Person.name == name))
    if person is None:
        person = Person(name=name)
        db.add(person)
        db.flush()
    return person


def _apply_genres_cast(db: Session, show: TVShow, genres: list[str], cast: list[str]) -> None:
    show.genres = [ShowGenre(genre=_get_or_create_genre(db, g)) for g in genres]
    show.cast = [ShowCast(person=_get_or_create_person(db, c), role_order=i) for i, c in enumerate(cast)]


def _show_query():
    return select(TVShow).options(
        selectinload(TVShow.genres).selectinload(ShowGenre.genre),
        selectinload(TVShow.cast).selectinload(ShowCast.person),
        selectinload(TVShow.seasons).selectinload(Season.episodes).selectinload(Episode.subtitles),
    )


def _to_show_read(show: TVShow) -> ShowRead:
    return ShowRead(
        id=show.id,
        title=show.title,
        poster_path=show.poster_path,
        backdrop_path=show.backdrop_path,
        synopsis=show.synopsis,
        release_year=show.release_year,
        language=show.language,
        creator=show.creator,
        age_rating=show.age_rating,
        date_added=show.date_added,
        genres=[sg.genre.name for sg in show.genres],
        cast=[sc.person.name for sc in sorted(show.cast, key=lambda c: c.role_order)],
        seasons=[
            SeasonRead(
                id=season.id,
                show_id=season.show_id,
                season_number=season.season_number,
                episodes=[EpisodeRead.model_validate(ep) for ep in season.episodes],
            )
            for season in sorted(show.seasons, key=lambda s: s.season_number)
        ],
    )


def _get_show(db: Session, show_id: int) -> TVShow:
    show = db.scalar(_show_query().where(TVShow.id == show_id))
    if show is None:
        raise HTTPException(status_code=404, detail="TV show not found")
    return show


def _get_season(db: Session, show_id: int, season_id: int) -> Season:
    season = db.scalar(
        select(Season)
        .where(Season.id == season_id, Season.show_id == show_id)
        .options(selectinload(Season.episodes).selectinload(Episode.subtitles))
    )
    if season is None:
        raise HTTPException(status_code=404, detail="Season not found")
    return season


def _get_episode(db: Session, episode_id: int) -> Episode:
    episode = db.scalar(
        select(Episode)
        .where(Episode.id == episode_id)
        .options(selectinload(Episode.season).selectinload(Season.show), selectinload(Episode.subtitles))
    )
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    return episode


def _show_dir(storage: StorageConfig, show: TVShow) -> Path:
    return storage.tv_shows_root / sanitize_folder_name(show.title)


def _season_dir(storage: StorageConfig, show: TVShow, season: Season) -> Path:
    return _show_dir(storage, show) / f"Season {season.season_number:02d}"


# ---- Shows ----


@router.get("/shows", response_model=list[ShowSummary])
def list_shows(db: Session = Depends(get_db)) -> list[ShowSummary]:
    shows = db.scalars(_show_query()).all()
    return [
        ShowSummary(
            id=s.id,
            title=s.title,
            poster_path=s.poster_path,
            backdrop_path=s.backdrop_path,
            release_year=s.release_year,
            age_rating=s.age_rating,
            date_added=s.date_added,
            genres=[sg.genre.name for sg in s.genres],
            season_count=len(s.seasons),
            episode_count=sum(len(season.episodes) for season in s.seasons),
        )
        for s in shows
    ]


@router.get("/shows/{show_id}", response_model=ShowRead)
def get_show(show_id: int, db: Session = Depends(get_db)) -> ShowRead:
    return _to_show_read(_get_show(db, show_id))


@router.post("/shows", response_model=ShowRead, status_code=201, dependencies=_admin_only)
def create_show(payload: ShowCreate, db: Session = Depends(get_db)) -> ShowRead:
    show = TVShow(
        title=payload.title,
        synopsis=payload.synopsis,
        release_year=payload.release_year,
        language=payload.language,
        creator=payload.creator,
        age_rating=payload.age_rating,
    )
    db.add(show)
    db.flush()
    _apply_genres_cast(db, show, payload.genres, payload.cast)
    db.commit()
    return _to_show_read(_get_show(db, show.id))


@router.put("/shows/{show_id}", response_model=ShowRead, dependencies=_admin_only)
def update_show(show_id: int, payload: ShowUpdate, db: Session = Depends(get_db)) -> ShowRead:
    show = _get_show(db, show_id)
    show.title = payload.title
    show.synopsis = payload.synopsis
    show.release_year = payload.release_year
    show.language = payload.language
    show.creator = payload.creator
    show.age_rating = payload.age_rating
    _apply_genres_cast(db, show, payload.genres, payload.cast)
    db.commit()
    return _to_show_read(_get_show(db, show_id))


@router.delete("/shows/{show_id}", status_code=204, dependencies=_admin_only)
def delete_show(show_id: int, db: Session = Depends(get_db)) -> None:
    show = _get_show(db, show_id)
    storage = StorageConfig(db)
    for rel_path in (show.poster_path, show.backdrop_path):
        if rel_path:
            delete_if_exists(storage.media_root / rel_path)
    for season in show.seasons:
        for ep in season.episodes:
            for rel_path in (ep.thumbnail_path, ep.video_path):
                if rel_path:
                    delete_if_exists(storage.media_root / rel_path)
            for sub in ep.subtitles:
                delete_subtitle_file(storage.media_root, sub.file_path)
    show_dir = _show_dir(storage, show)
    remove_dir_if_empty(show_dir)
    db.delete(show)
    db.commit()


@router.post("/shows/{show_id}/poster", response_model=ShowRead, dependencies=_admin_only)
def upload_show_poster(show_id: int, file: UploadFile, db: Session = Depends(get_db)) -> ShowRead:
    show = _get_show(db, show_id)
    storage = StorageConfig(db)
    ext = (file.filename or "poster").rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg"
    saved = save_upload(file, _show_dir(storage, show), f"poster.{ext}")
    show.poster_path = str(saved.relative_to(storage.media_root))
    db.commit()
    return _to_show_read(_get_show(db, show_id))


@router.post("/shows/{show_id}/backdrop", response_model=ShowRead, dependencies=_admin_only)
def upload_show_backdrop(show_id: int, file: UploadFile, db: Session = Depends(get_db)) -> ShowRead:
    show = _get_show(db, show_id)
    storage = StorageConfig(db)
    ext = (file.filename or "backdrop").rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg"
    saved = save_upload(file, _show_dir(storage, show), f"backdrop.{ext}")
    show.backdrop_path = str(saved.relative_to(storage.media_root))
    db.commit()
    return _to_show_read(_get_show(db, show_id))


# ---- Seasons ----


@router.post("/shows/{show_id}/seasons", response_model=SeasonRead, status_code=201, dependencies=_admin_only)
def create_season(show_id: int, payload: SeasonCreate, db: Session = Depends(get_db)) -> SeasonRead:
    _get_show(db, show_id)  # 404 if missing
    existing = db.scalar(select(Season).where(Season.show_id == show_id, Season.season_number == payload.season_number))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Season number already exists for this show")
    season = Season(show_id=show_id, season_number=payload.season_number)
    db.add(season)
    db.commit()
    db.refresh(season)
    return SeasonRead(id=season.id, show_id=season.show_id, season_number=season.season_number, episodes=[])


@router.delete("/shows/{show_id}/seasons/{season_id}", status_code=204, dependencies=_admin_only)
def delete_season(show_id: int, season_id: int, db: Session = Depends(get_db)) -> None:
    show = _get_show(db, show_id)
    season = _get_season(db, show_id, season_id)
    storage = StorageConfig(db)
    for ep in season.episodes:
        for rel_path in (ep.thumbnail_path, ep.video_path):
            if rel_path:
                delete_if_exists(storage.media_root / rel_path)
        for sub in ep.subtitles:
            delete_subtitle_file(storage.media_root, sub.file_path)
    season_dir = _season_dir(storage, show, season)
    remove_dir_if_empty(season_dir)
    db.delete(season)
    db.commit()


# ---- Episodes ----


@router.post("/shows/{show_id}/seasons/{season_id}/episodes", response_model=EpisodeRead, status_code=201, dependencies=_admin_only)
def create_episode(show_id: int, season_id: int, payload: EpisodeCreate, db: Session = Depends(get_db)) -> EpisodeRead:
    _get_season(db, show_id, season_id)
    existing = db.scalar(
        select(Episode).where(Episode.season_id == season_id, Episode.episode_number == payload.episode_number)
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Episode number already exists in this season")
    episode = Episode(
        season_id=season_id,
        episode_number=payload.episode_number,
        title=payload.title,
        synopsis=payload.synopsis,
        runtime_min=payload.runtime_min,
        air_date=payload.air_date,
    )
    db.add(episode)
    db.commit()
    db.refresh(episode)
    return EpisodeRead.model_validate(episode)


@router.get("/episodes/{episode_id}", response_model=EpisodePlaybackInfo)
def get_episode(episode_id: int, db: Session = Depends(get_db)) -> EpisodePlaybackInfo:
    episode = _get_episode(db, episode_id)
    return EpisodePlaybackInfo(
        **EpisodeRead.model_validate(episode).model_dump(),
        show_id=episode.season.show.id,
        show_title=episode.season.show.title,
        season_number=episode.season.season_number,
    )


@router.put("/episodes/{episode_id}", response_model=EpisodeRead, dependencies=_admin_only)
def update_episode(episode_id: int, payload: EpisodeUpdate, db: Session = Depends(get_db)) -> EpisodeRead:
    episode = _get_episode(db, episode_id)
    episode.episode_number = payload.episode_number
    episode.title = payload.title
    episode.synopsis = payload.synopsis
    episode.runtime_min = payload.runtime_min
    episode.air_date = payload.air_date
    db.commit()
    db.refresh(episode)
    return EpisodeRead.model_validate(episode)


@router.delete("/episodes/{episode_id}", status_code=204, dependencies=_admin_only)
def delete_episode(episode_id: int, db: Session = Depends(get_db)) -> None:
    episode = _get_episode(db, episode_id)
    storage = StorageConfig(db)
    for rel_path in (episode.thumbnail_path, episode.video_path):
        if rel_path:
            delete_if_exists(storage.media_root / rel_path)
    for sub in episode.subtitles:
        delete_subtitle_file(storage.media_root, sub.file_path)
    db.delete(episode)
    db.commit()


@router.post("/episodes/{episode_id}/thumbnail", response_model=EpisodeRead, dependencies=_admin_only)
def upload_episode_thumbnail(episode_id: int, file: UploadFile, db: Session = Depends(get_db)) -> EpisodeRead:
    episode = _get_episode(db, episode_id)
    storage = StorageConfig(db)
    dir_path = _season_dir(storage, episode.season.show, episode.season)
    ext = (file.filename or "thumb").rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg"
    saved = save_upload(file, dir_path, f"E{episode.episode_number:02d}-thumb.{ext}")
    episode.thumbnail_path = str(saved.relative_to(storage.media_root))
    db.commit()
    db.refresh(episode)
    return EpisodeRead.model_validate(episode)


@router.post("/episodes/{episode_id}/video", response_model=EpisodeRead, dependencies=_admin_only)
def upload_episode_video(episode_id: int, file: UploadFile, db: Session = Depends(get_db)) -> EpisodeRead:
    episode = _get_episode(db, episode_id)
    storage = StorageConfig(db)
    dir_path = _season_dir(storage, episode.season.show, episode.season)
    ext = (file.filename or "video").rsplit(".", 1)[-1] if "." in (file.filename or "") else "mp4"
    saved = save_upload(file, dir_path, f"E{episode.episode_number:02d}.{ext}")
    episode.video_path = str(saved.relative_to(storage.media_root))
    db.commit()
    db.refresh(episode)
    return EpisodeRead.model_validate(episode)
