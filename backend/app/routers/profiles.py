from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models import MAX_PROFILES_PER_USER, Profile, User
from app.schemas.profile import ProfileCreate, ProfileRead, ProfileUpdate

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("", response_model=list[ProfileRead])
def list_profiles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[ProfileRead]:
    rows = db.scalars(select(Profile).where(Profile.user_id == current_user.id).order_by(Profile.created_at)).all()
    return [ProfileRead(id=p.id, name=p.name, avatar_key=p.avatar_key) for p in rows]


@router.post("", response_model=ProfileRead, status_code=201)
def create_profile(
    payload: ProfileCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ProfileRead:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    existing_count = len(db.scalars(select(Profile.id).where(Profile.user_id == current_user.id)).all())
    if existing_count >= MAX_PROFILES_PER_USER:
        raise HTTPException(status_code=400, detail=f"Maximum of {MAX_PROFILES_PER_USER} profiles per account")

    profile = Profile(user_id=current_user.id, name=name, avatar_key=payload.avatar_key)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return ProfileRead(id=profile.id, name=profile.name, avatar_key=profile.avatar_key)


@router.patch("/{profile_id}", response_model=ProfileRead)
def update_profile(
    profile_id: int, payload: ProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ProfileRead:
    profile = db.query(Profile).filter(Profile.id == profile_id, Profile.user_id == current_user.id).one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name is required")
        profile.name = name
    if payload.avatar_key is not None:
        profile.avatar_key = payload.avatar_key

    db.commit()
    db.refresh(profile)
    return ProfileRead(id=profile.id, name=profile.name, avatar_key=profile.avatar_key)


@router.delete("/{profile_id}", status_code=204)
def delete_profile(profile_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    profile = db.query(Profile).filter(Profile.id == profile_id, Profile.user_id == current_user.id).one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    # playback_progress/watchlist_items/interaction_events all FK profile_id
    # with ondelete="CASCADE" and SQLite FK enforcement is on (see
    # app/database.py), so this alone clears everything owned by this profile.
    db.delete(profile)
    db.commit()
