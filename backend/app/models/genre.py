from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Genre(Base):
    __tablename__ = "genres"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
