"""Playback endpoints: direct-play (byte-range) and on-demand HLS transcode.

Two ways to watch the same file:
- Direct play: the original file, served with Range support (Starlette's
  FileResponse already handles `Range` headers) — used when the client's
  codec/container support means no transcode is needed.
- HLS: `.m3u8` + `.ts` segments, transcoded once on first request and cached
  under `{cache_root}/hls/{kind}_{id}/` — used as the compatibility fallback.
"""

import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import StorageConfig
from app.database import get_db
from app.ffmpeg_tools import FFmpegNotFound, ensure_hls, hls_dir_for
from app.models import Episode, Movie

router = APIRouter(prefix="/stream", tags=["streaming"])


def _resolve_video(db: Session, kind: str, item_id: int) -> tuple[Path, Path]:
    """Returns (absolute_video_path, media_root)."""
    storage = StorageConfig(db)
    if kind == "movies":
        item = db.get(Movie, item_id)
    elif kind == "episodes":
        item = db.get(Episode, item_id)
    else:
        raise HTTPException(status_code=404, detail="Unknown stream kind")

    if item is None:
        raise HTTPException(status_code=404, detail=f"{kind[:-1].capitalize()} not found")
    if not item.video_path:
        raise HTTPException(status_code=404, detail="No video file attached yet")

    abs_path = storage.media_root / item.video_path
    if not abs_path.is_file():
        raise HTTPException(status_code=404, detail="Video file is missing on disk")
    return abs_path, storage.cache_root


@router.get("/movies/{movie_id}")
def direct_play_movie(movie_id: int, db: Session = Depends(get_db)) -> FileResponse:
    abs_path, _ = _resolve_video(db, "movies", movie_id)
    media_type = mimetypes.guess_type(abs_path.name)[0] or "application/octet-stream"
    return FileResponse(abs_path, media_type=media_type)


@router.get("/episodes/{episode_id}")
def direct_play_episode(episode_id: int, db: Session = Depends(get_db)) -> FileResponse:
    abs_path, _ = _resolve_video(db, "episodes", episode_id)
    media_type = mimetypes.guess_type(abs_path.name)[0] or "application/octet-stream"
    return FileResponse(abs_path, media_type=media_type)


def _hls_playlist(db: Session, kind: str, item_id: int) -> FileResponse:
    abs_path, cache_root = _resolve_video(db, kind, item_id)
    out_dir = hls_dir_for(cache_root, kind[:-1], item_id)
    try:
        playlist = ensure_hls(abs_path, out_dir)
    except FFmpegNotFound as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return FileResponse(playlist, media_type="application/vnd.apple.mpegurl")


def _hls_segment(db: Session, kind: str, item_id: int, segment: str) -> FileResponse:
    _, cache_root = _resolve_video(db, kind, item_id)
    out_dir = hls_dir_for(cache_root, kind[:-1], item_id)
    seg_path = (out_dir / segment).resolve()
    if out_dir.resolve() not in seg_path.parents or not seg_path.is_file():
        raise HTTPException(status_code=404, detail="Segment not found")
    return FileResponse(seg_path, media_type="video/mp2t")


@router.get("/movies/{movie_id}/hls/playlist.m3u8")
def hls_playlist_movie(movie_id: int, db: Session = Depends(get_db)) -> FileResponse:
    return _hls_playlist(db, "movies", movie_id)


@router.get("/movies/{movie_id}/hls/{segment}")
def hls_segment_movie(movie_id: int, segment: str, db: Session = Depends(get_db)) -> FileResponse:
    return _hls_segment(db, "movies", movie_id, segment)


@router.get("/episodes/{episode_id}/hls/playlist.m3u8")
def hls_playlist_episode(episode_id: int, db: Session = Depends(get_db)) -> FileResponse:
    return _hls_playlist(db, "episodes", episode_id)


@router.get("/episodes/{episode_id}/hls/{segment}")
def hls_segment_episode(episode_id: int, segment: str, db: Session = Depends(get_db)) -> FileResponse:
    return _hls_segment(db, "episodes", episode_id, segment)
