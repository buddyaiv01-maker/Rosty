"""Saving uploaded media files (posters, backdrops, video, subtitles) to disk."""

import logging
import re
import shutil
import time
from pathlib import Path

from fastapi import UploadFile

logger = logging.getLogger(__name__)

_UNSAFE_CHARS = re.compile(r'[<>:"/\\|?*]')


def sanitize_folder_name(title: str) -> str:
    cleaned = _UNSAFE_CHARS.sub("", title).strip().rstrip(".")
    return cleaned or "Untitled"


def save_upload(upload: UploadFile, dest_dir: Path, filename: str | None = None) -> Path:
    """Write an UploadFile into dest_dir, returning the saved file's path."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    name = filename or upload.filename or "file"
    dest = dest_dir / name
    with dest.open("wb") as f:
        shutil.copyfileobj(upload.file, f)
    return dest


def delete_if_exists(path: Path | None) -> None:
    """Delete a file if present. Tolerates Windows file-lock contention (e.g. a
    client is still mid-stream reading the file) by retrying briefly, then giving
    up without raising — the library record is more important than a prompt disk
    cleanup, and the OS releases the handle once the streaming connection closes.
    """
    if not path or not path.exists():
        return
    for attempt in range(5):
        try:
            path.unlink()
            return
        except PermissionError:
            if attempt == 4:
                logger.warning("Could not delete %s — file is still in use, leaving it on disk", path)
                return
            time.sleep(0.3)


def delete_subtitle_file(media_root: Path, file_path: str) -> None:
    """Deletes a subtitle's stored file plus its .srt sibling, if any — a
    converted upload keeps the original .srt alongside the generated .vtt
    (see app/subtitles.py's convert_srt_file_to_vtt), so removing just the
    path on the Subtitle row would still orphan the .srt."""
    full_path = media_root / file_path
    delete_if_exists(full_path)
    delete_if_exists(full_path.with_suffix(".srt"))


def remove_dir_if_empty(path: Path) -> None:
    """Removes a directory tree if it contains no files anywhere inside it.
    A plain `path.rmdir()` after `not any(path.rglob("*"))` (the previous
    approach here) fails to clean up a movie/show/season folder whose only
    remaining content is an empty subdirectory — rglob() matches directories
    too, so that subdirectory alone counts as "not empty" and blocks removal
    even though nothing of value is left. Checking specifically for files,
    then removing the whole tree, handles that case in one pass.
    """
    if not path.exists():
        return
    if any(p.is_file() for p in path.rglob("*")):
        return
    shutil.rmtree(path, ignore_errors=True)
