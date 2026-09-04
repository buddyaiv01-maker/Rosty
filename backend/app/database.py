from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.config import database_path, ensure_data_dirs

ensure_data_dirs()

engine = create_engine(
    f"sqlite:///{database_path()}",
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
    # SQLite ignores ON DELETE CASCADE in the schema unless FK enforcement is turned
    # on per connection — without this, deleting a movie/show leaves its
    # playback_progress/watchlist_items rows orphaned instead of cascading.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
