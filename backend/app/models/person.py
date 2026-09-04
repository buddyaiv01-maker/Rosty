from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Person(Base):
    """Shared by movie/show cast, directors, and creators."""

    __tablename__ = "people"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
