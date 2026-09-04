"""SRT to WebVTT conversion.

Browsers only support WebVTT for <track> subtitles, so any uploaded .srt is
converted on ingest. The original .srt is kept alongside it — cheap to keep,
useful if we ever want to re-derive or offer a raw download.
"""

import re
from pathlib import Path

_TIMESTAMP = re.compile(r"(\d{2}:\d{2}:\d{2}),(\d{3})")


def srt_to_vtt_text(srt_text: str) -> str:
    body = _TIMESTAMP.sub(r"\1.\2", srt_text.replace("\r\n", "\n").strip())
    return f"WEBVTT\n\n{body}\n"


def convert_srt_file_to_vtt(srt_path: Path) -> Path:
    vtt_path = srt_path.with_suffix(".vtt")
    vtt_path.write_text(srt_to_vtt_text(srt_path.read_text(encoding="utf-8")), encoding="utf-8")
    return vtt_path
