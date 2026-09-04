"""FFmpeg-backed HLS transcoding.

Single practical quality rung for V1 — no adaptive multi-rendition ABR (see
DESIGN.md). Transcoding is synchronous and runs inside FastAPI's threadpool
(these are sync `def` route handlers), so it doesn't block the event loop,
but a caller does wait for the whole file to finish encoding before the
playlist is available. Fine for a personal LAN library; revisit if a title
is large enough that this becomes an annoying wait.
"""

import shutil
import subprocess
from pathlib import Path


class FFmpegNotFound(RuntimeError):
    pass


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def hls_dir_for(cache_root: Path, kind: str, item_id: int) -> Path:
    return cache_root / "hls" / f"{kind}_{item_id}"


def ensure_hls(input_path: Path, output_dir: Path) -> Path:
    """Transcode input_path to HLS in output_dir if not already done. Returns the playlist path."""
    playlist = output_dir / "playlist.m3u8"
    if playlist.exists():
        return playlist

    if not ffmpeg_available():
        raise FFmpegNotFound("ffmpeg is not installed or not on PATH")

    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(input_path),
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-c:a", "aac",
        "-start_number", "0",
        "-hls_time", "6",
        "-hls_list_size", "0",
        "-hls_playlist_type", "vod",
        "-f", "hls",
        str(playlist),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not playlist.exists():
        raise RuntimeError(f"ffmpeg transcode failed: {result.stderr[-2000:]}")
    return playlist
