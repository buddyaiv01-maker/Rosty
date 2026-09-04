"""Media library scanner.

Walks media_root/Movies and media_root/TV Shows, diffs against what's already
in the DB (by video_path), and surfaces anything unrecognized as an import
candidate. Nothing is auto-created — import is always an explicit follow-up
call from the CMS review queue.
"""

import re
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import StorageConfig
from app.database import get_db
from app.models import Episode, Genre, MediaScanLog, Movie, MovieCast, MovieGenre, Person, Season, TVShow
from app.schemas.movie import MovieRead
from app.schemas.scan import EpisodeCandidate, ImportEpisode, ImportMovie, MovieCandidate, ScanResult
from app.schemas.tv_show import EpisodeRead

router = APIRouter(prefix="/scan", tags=["scan"])

VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".ts"}
_SEASON_RE = re.compile(r"season\s*0*(\d+)", re.IGNORECASE)
_SXXEXX_RE = re.compile(r"s0*(\d{1,3})[._\s-]*e0*(\d{1,3})", re.IGNORECASE)
_EPISODE_RE = re.compile(r"(?:^|[^a-z0-9])e0*(\d{1,3})(?:[^0-9]|$)", re.IGNORECASE)


def _normalize(rel_path: str) -> str:
    return rel_path.replace("\\", "/")


def _walk_videos(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in VIDEO_EXTENSIONS)


def _guess_season_episode(rel_parts: tuple[str, ...], filename: str) -> tuple[int | None, int | None]:
    # "S02E01"-style names carry both numbers together — trust that over the folder name.
    combined = _SXXEXX_RE.search(filename)
    if combined:
        return int(combined.group(1)), int(combined.group(2))

    season = None
    for part in rel_parts:
        m = _SEASON_RE.search(part)
        if m:
            season = int(m.group(1))
            break
    ep_match = _EPISODE_RE.search(filename)
    episode = int(ep_match.group(1)) if ep_match else None
    return season, episode


@router.get("", response_model=ScanResult)
def run_scan(db: Session = Depends(get_db)) -> ScanResult:
    storage = StorageConfig(db)

    known_movie_paths = {_normalize(m) for (m,) in db.execute(select(Movie.video_path)).all() if m}
    known_episode_paths = {_normalize(e) for (e,) in db.execute(select(Episode.video_path)).all() if e}

    movie_candidates: list[MovieCandidate] = []
    for path in _walk_videos(storage.movies_root):
        rel = str(path.relative_to(storage.media_root))
        if _normalize(rel) in known_movie_paths:
            continue
        rel_to_movies = path.relative_to(storage.movies_root)
        guessed_title = rel_to_movies.parts[0] if len(rel_to_movies.parts) > 1 else path.stem
        movie_candidates.append(
            MovieCandidate(relative_path=rel, filename=path.name, size_bytes=path.stat().st_size, guessed_title=guessed_title)
        )

    episode_candidates: list[EpisodeCandidate] = []
    for path in _walk_videos(storage.tv_shows_root):
        rel = str(path.relative_to(storage.media_root))
        if _normalize(rel) in known_episode_paths:
            continue
        rel_to_shows = path.relative_to(storage.tv_shows_root)
        guessed_show_title = rel_to_shows.parts[0] if rel_to_shows.parts else path.stem
        season, episode = _guess_season_episode(rel_to_shows.parts[:-1], path.name)
        episode_candidates.append(
            EpisodeCandidate(
                relative_path=rel,
                filename=path.name,
                size_bytes=path.stat().st_size,
                guessed_show_title=guessed_show_title,
                guessed_season=season,
                guessed_episode=episode,
            )
        )

    log = MediaScanLog(
        files_found=len(known_movie_paths) + len(known_episode_paths) + len(movie_candidates) + len(episode_candidates),
        new_items=len(movie_candidates) + len(episode_candidates),
    )
    db.add(log)
    db.commit()

    return ScanResult(
        scanned_at=datetime.utcnow().isoformat(),
        movies=movie_candidates,
        episodes=episode_candidates,
    )


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


@router.post("/import-movie", response_model=MovieRead, status_code=201)
def import_movie(payload: ImportMovie, db: Session = Depends(get_db)) -> MovieRead:
    storage = StorageConfig(db)
    if not (storage.media_root / payload.relative_path).is_file():
        raise HTTPException(status_code=404, detail="File no longer exists on disk — re-run the scan")
    if db.scalar(select(Movie).where(Movie.video_path == payload.relative_path)) is not None:
        raise HTTPException(status_code=409, detail="This file is already imported")

    movie = Movie(
        title=payload.title,
        synopsis=payload.synopsis,
        release_year=payload.release_year,
        runtime_min=payload.runtime_min,
        language=payload.language,
        director=payload.director,
        age_rating=payload.age_rating,
        video_path=payload.relative_path,
    )
    db.add(movie)
    db.flush()
    movie.genres = [MovieGenre(genre=_get_or_create_genre(db, g)) for g in payload.genres]
    movie.cast = [MovieCast(person=_get_or_create_person(db, c), role_order=i) for i, c in enumerate(payload.cast)]
    db.commit()
    db.refresh(movie)

    from app.routers.movies import _get_movie, _to_read  # local import avoids a circular import at module load

    return _to_read(_get_movie(db, movie.id))


@router.post("/import-episode", response_model=EpisodeRead, status_code=201)
def import_episode(payload: ImportEpisode, db: Session = Depends(get_db)) -> EpisodeRead:
    storage = StorageConfig(db)
    if not (storage.media_root / payload.relative_path).is_file():
        raise HTTPException(status_code=404, detail="File no longer exists on disk — re-run the scan")
    if db.scalar(select(Episode).where(Episode.video_path == payload.relative_path)) is not None:
        raise HTTPException(status_code=409, detail="This file is already imported")

    show = db.get(TVShow, payload.show_id)
    if show is None:
        raise HTTPException(status_code=404, detail="TV show not found")

    season = db.scalar(select(Season).where(Season.show_id == show.id, Season.season_number == payload.season_number))
    if season is None:
        season = Season(show_id=show.id, season_number=payload.season_number)
        db.add(season)
        db.flush()

    existing = db.scalar(
        select(Episode).where(Episode.season_id == season.id, Episode.episode_number == payload.episode_number)
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Episode number already exists in this season")

    episode = Episode(
        season_id=season.id,
        episode_number=payload.episode_number,
        title=payload.title,
        synopsis=payload.synopsis,
        runtime_min=payload.runtime_min,
        air_date=date.fromisoformat(payload.air_date) if payload.air_date else None,
        video_path=payload.relative_path,
    )
    db.add(episode)
    db.commit()
    db.refresh(episode)
    return EpisodeRead.model_validate(episode)
