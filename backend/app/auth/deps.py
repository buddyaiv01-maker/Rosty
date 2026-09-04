import os

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_auth_access_token, fetch_auth_email
from app.database import get_db
from app.models import Profile, User

bearer_scheme = HTTPBearer(auto_error=False)

# Admin accounts skip the profile UI entirely (see app/routers/profiles.py and
# the frontend ProfileGate), but the schema still requires every playback/
# watchlist/event row to reference a profile — so each admin silently gets
# exactly one of these at provisioning time, never shown to them as a choice.
ADMIN_DEFAULT_AVATAR_KEY = "robot"


def _is_admin_email(email: str | None) -> bool:
    if not email:
        return False
    allowlist = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}
    return email.strip().lower() in allowlist


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    subject = decode_auth_access_token(credentials.credentials)
    if subject is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = db.query(User).filter(User.auth_subject == subject).one_or_none()
    if user is None:
        # First time this Auth account has been seen here — provision a local
        # row. Role is decided once, now, against ADMIN_EMAILS: changing that
        # list later doesn't retroactively promote/demote an already-provisioned
        # account (deleting and re-registering the account re-syncs it).
        # username has no meaning of its own once Auth owns identity; the Auth
        # subject id is unique and doubles as one.
        email = fetch_auth_email(credentials.credentials)
        role = "admin" if _is_admin_email(email) else "user"
        user = User(username=subject, password_hash="", role=role, auth_subject=subject, email=email)
        db.add(user)
        db.flush()
        if role == "admin":
            db.add(Profile(user_id=user.id, name="Admin", avatar_key=ADMIN_DEFAULT_AVATAR_KEY))
        db.commit()
        db.refresh(user)
    elif user.role == "admin" and db.query(Profile).filter(Profile.user_id == user.id).first() is None:
        # Backfill for admin rows provisioned before this auto-profile existed
        # (or any other way an admin ended up with zero profiles) — self-heals
        # on next login rather than needing a one-off migration/script.
        db.add(Profile(user_id=user.id, name="Admin", avatar_key=ADMIN_DEFAULT_AVATAR_KEY))
        db.commit()

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def get_active_profile(
    x_profile_id: int | None = Header(None, alias="X-Profile-Id"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Profile:
    if x_profile_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="X-Profile-Id header required")
    profile = db.query(Profile).filter(Profile.id == x_profile_id, Profile.user_id == current_user.id).one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return profile
