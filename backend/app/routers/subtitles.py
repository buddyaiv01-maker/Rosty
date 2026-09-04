from pathlib import Path

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import StorageConfig
from app.database import get_db
from app.models import Episode, Movie, Season, Subtitle
from app.schemas.subtitle import SubtitleRead
from app.storage_files import delete_subtitle_file, sanitize_folder_name, save_upload
from app.subtitles import convert_srt_file_to_vtt

router = APIRouter(tags=["subtitles"])


def _get_movie(db: Session, movie_id: int) -> Movie:
    movie = db.get(Movie, movie_id)
    if movie is None:
        raise HTTPException(status_code=404, detail="Movie not found")
    return movie


def _ingest_subtitle(storage: StorageConfig, dest_dir: Path, language: str, file: UploadFile) -> tuple[str, str]:
    """Save the uploaded subtitle, converting .srt to .vtt. Returns (rel_path, format)."""
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if ext not in ("srt", "vtt"):
        raise HTTPException(status_code=400, detail="Only .srt and .vtt files are supported")

    safe_lang = sanitize_folder_name(language)
    saved = save_upload(file, dest_dir, f"subtitle-{safe_lang}.{ext}")

    if ext == "srt":
        vtt_path = convert_srt_file_to_vtt(saved)
        return str(vtt_path.relative_to(storage.media_root)), "vtt"
    return str(saved.relative_to(storage.media_root)), "vtt"


@router.post("/movies/{movie_id}/subtitles", response_model=SubtitleRead, status_code=201)
def upload_movie_subtitle(
    movie_id: int, file: UploadFile, language: str = Form(...), db: Session = Depends(get_db)
) -> SubtitleRead:
    movie = _get_movie(db, movie_id)
    storage = StorageConfig(db)
    dest_dir = storage.movies_root / sanitize_folder_name(movie.title)
    rel_path, fmt = _ingest_subtitle(storage, dest_dir, language, file)
    sub = Subtitle(movie_id=movie.id, language=language, format=fmt, file_path=rel_path)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return SubtitleRead.model_validate(sub)


@router.post("/episodes/{episode_id}/subtitles", response_model=SubtitleRead, status_code=201)
def upload_episode_subtitle(
    episode_id: int, file: UploadFile, language: str = Form(...), db: Session = Depends(get_db)
) -> SubtitleRead:
    episode = db.scalar(
        select(Episode).where(Episode.id == episode_id).options()
    )
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    season = db.get(Season, episode.season_id)
    show = season.show
    storage = StorageConfig(db)
    dest_dir = storage.tv_shows_root / sanitize_folder_name(show.title) / f"Season {season.season_number:02d}"
    rel_path, fmt = _ingest_subtitle(storage, dest_dir, language, file)
    sub = Subtitle(episode_id=episode.id, language=language, format=fmt, file_path=rel_path)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return SubtitleRead.model_validate(sub)


@router.delete("/subtitles/{subtitle_id}", status_code=204)
def delete_subtitle(subtitle_id: int, db: Session = Depends(get_db)) -> None:
    sub = db.get(Subtitle, subtitle_id)
    if sub is None:
        raise HTTPException(status_code=404, detail="Subtitle not found")
    storage = StorageConfig(db)
    delete_subtitle_file(storage.media_root, sub.file_path)
    db.delete(sub)
    db.commit()
