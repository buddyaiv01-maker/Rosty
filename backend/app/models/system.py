from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, utcnow


class MediaScanLog(Base):
    __tablename__ = "media_scan_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    scanned_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    files_found: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    new_items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    errors: Mapped[str | None] = mapped_column(Text)  # JSON-encoded list of problem paths


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text)
