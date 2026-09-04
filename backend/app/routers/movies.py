from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth.deps import require_admin
from app.config import StorageConfig
from app.database import get_db
from app.models import Genre, Movie, MovieCast, MovieGenre, Person
from app.schemas.movie import MovieCreate, MovieRead, MovieUpdate
from app.schemas.subtitle import SubtitleRead
from app.storage_files import (
    delete_if_exists,
    delete_subtitle_file,
    remove_dir_if_empty,
    sanitize_folder_name,
    save_upload,
)

router = APIRouter(prefix="/movies", tags=["movies"])
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


def _apply_genres_cast(db: Session, movie: Movie, genres: list[str], cast: list[str]) -> None:
    movie.genres = [MovieGenre(genre=_get_or_create_genre(db, g)) for g in genres]
    movie.cast = [MovieCast(person=_get_or_create_person(db, c), role_order=i) for i, c in enumerate(cast)]


def _to_read(movie: Movie) -> MovieRead:
    return MovieRead(
        id=movie.id,
        title=movie.title,
        poster_path=movie.poster_path,
        backdrop_path=movie.backdrop_path,
        synopsis=movie.synopsis,
        release_year=movie.release_year,
        runtime_min=movie.runtime_min,
        language=movie.language,
        director=movie.director,
        age_rating=movie.age_rating,
        video_path=movie.video_path,
        date_added=movie.date_added,
        genres=[mg.genre.name for mg in movie.genres],
        cast=[mc.person.name for mc in sorted(movie.cast, key=lambda c: c.role_order)],
        subtitles=[SubtitleRead.model_validate(s) for s in movie.subtitles],
    )


def _get_movie(db: Session, movie_id: int) -> Movie:
    movie = db.scalar(
        select(Movie)
        .where(Movie.id == movie_id)
        .options(
            selectinload(Movie.genres).selectinload(MovieGenre.genre),
            selectinload(Movie.cast).selectinload(MovieCast.person),
            selectinload(Movie.subtitles),
        )
    )
    if movie is None:
        raise HTTPException(status_code=404, detail="Movie not found")
    return movie


@router.get("", response_model=list[MovieRead])
def list_movies(db: Session = Depends(get_db)) -> list[MovieRead]:
    movies = db.scalars(
        select(Movie).options(
            selectinload(Movie.genres).selectinload(MovieGenre.genre),
            selectinload(Movie.cast).selectinload(MovieCast.person),
            selectinload(Movie.subtitles),
        )
    ).all()
    return [_to_read(m) for m in movies]


@router.get("/{movie_id}", response_model=MovieRead)
def get_movie(movie_id: int, db: Session = Depends(get_db)) -> MovieRead:
    return _to_read(_get_movie(db, movie_id))


@router.post("", response_model=MovieRead, status_code=201, dependencies=_admin_only)
def create_movie(payload: MovieCreate, db: Session = Depends(get_db)) -> MovieRead:
    movie = Movie(
        title=payload.title,
        synopsis=payload.synopsis,
        release_year=payload.release_year,
        runtime_min=payload.runtime_min,
        language=payload.language,
        director=payload.director,
        age_rating=payload.age_rating,
    )
    db.add(movie)
    db.flush()
    _apply_genres_cast(db, movie, payload.genres, payload.cast)
    db.commit()
    return _to_read(_get_movie(db, movie.id))


@router.put("/{movie_id}", response_model=MovieRead, dependencies=_admin_only)
def update_movie(movie_id: int, payload: MovieUpdate, db: Session = Depends(get_db)) -> MovieRead:
    movie = _get_movie(db, movie_id)
    movie.title = payload.title
    movie.synopsis = payload.synopsis
    movie.release_year = payload.release_year
    movie.runtime_min = payload.runtime_min
    movie.language = payload.language
    movie.director = payload.director
    movie.age_rating = payload.age_rating
    _apply_genres_cast(db, movie, payload.genres, payload.cast)
    db.commit()
    return _to_read(_get_movie(db, movie_id))


@router.delete("/{movie_id}", status_code=204, dependencies=_admin_only)
def delete_movie(movie_id: int, db: Session = Depends(get_db)) -> None:
    movie = _get_movie(db, movie_id)
    storage = StorageConfig(db)
    for rel_path in (movie.poster_path, movie.backdrop_path, movie.video_path):
        if rel_path:
            delete_if_exists(storage.media_root / rel_path)
    for sub in movie.subtitles:
        delete_subtitle_file(storage.media_root, sub.file_path)
    _, movie_dir = _movie_dir(storage, movie)
    remove_dir_if_empty(movie_dir)
    db.delete(movie)
    db.commit()


def _movie_dir(storage: StorageConfig, movie: Movie) -> tuple[str, Path]:
    folder = sanitize_folder_name(movie.title)
    return folder, storage.movies_root / folder


@router.post("/{movie_id}/poster", response_model=MovieRead, dependencies=_admin_only)
def upload_poster(movie_id: int, file: UploadFile, db: Session = Depends(get_db)) -> MovieRead:
    movie = _get_movie(db, movie_id)
    storage = StorageConfig(db)
    _folder, dir_path = _movie_dir(storage, movie)
    ext = (file.filename or "poster").rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg"
    saved = save_upload(file, dir_path, f"poster.{ext}")
    movie.poster_path = str(saved.relative_to(storage.media_root))
    db.commit()
    return _to_read(_get_movie(db, movie_id))


@router.post("/{movie_id}/backdrop", response_model=MovieRead, dependencies=_admin_only)
def upload_backdrop(movie_id: int, file: UploadFile, db: Session = Depends(get_db)) -> MovieRead:
    movie = _get_movie(db, movie_id)
    storage = StorageConfig(db)
    _folder, dir_path = _movie_dir(storage, movie)
    ext = (file.filename or "backdrop").rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg"
    saved = save_upload(file, dir_path, f"backdrop.{ext}")
    movie.backdrop_path = str(saved.relative_to(storage.media_root))
    db.commit()
    return _to_read(_get_movie(db, movie_id))


@router.post("/{movie_id}/video", response_model=MovieRead, dependencies=_admin_only)
def upload_video(movie_id: int, file: UploadFile, db: Session = Depends(get_db)) -> MovieRead:
    movie = _get_movie(db, movie_id)
    storage = StorageConfig(db)
    _folder, dir_path = _movie_dir(storage, movie)
    saved = save_upload(file, dir_path, file.filename)
    movie.video_path = str(saved.relative_to(storage.media_root))
    db.commit()
    return _to_read(_get_movie(db, movie_id))
