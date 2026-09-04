from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/account", tags=["account"])


class AccountRead(BaseModel):
    id: int
    email: str | None
    role: str


@router.get("", response_model=AccountRead)
def get_account(current_user: User = Depends(get_current_user)) -> AccountRead:
    return AccountRead(id=current_user.id, email=current_user.email, role=current_user.role)


@router.delete("", status_code=204)
def delete_account(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    # watchlist_items/playback_progress/interaction_events all FK user_id with
    # ondelete="CASCADE" and SQLite FK enforcement is on (see app/database.py),
    # so this alone clears everything this user owns here.
    db.delete(current_user)
    db.commit()
