from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_auth_access_token, fetch_auth_email
from app.config import StorageConfig
from app.database import get_db
from app.models import Profile, User

bearer_scheme = HTTPBearer(auto_error=False)

# Admin accounts skip the profile UI entirely (see app/routers/profiles.py and
# the frontend ProfileGate), but the schema still requires every playback/
# watchlist/event row to reference a profile — so each admin silently gets
# exactly one of these at provisioning time, never shown to them as a choice.
ADMIN_DEFAULT_AVATAR_KEY = "robot"


def _is_admin_email(db: Session, email: str | None) -> bool:
    if not email:
        return False
    return email.strip().lower() in StorageConfig(db).admin_emails


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
        # row. Role is decided once, now, against the admin allowlist: editing
        # that list by itself never retroactively changes an already-provisioned
        # account's role — only the explicit promote/demote actions in
        # app/routers/admin_emails.py do that (deleting and re-registering the
        # account would also re-sync it against the list, same as before).
        # username has no meaning of its own once Auth owns identity; the Auth
        # subject id is unique and doubles as one.
        email = fetch_auth_email(credentials.credentials)
        cfg = StorageConfig(db)
        role = "admin" if _is_admin_email(db, email) else "user"
        user = User(username=subject, password_hash="", role=role, auth_subject=subject, email=email)
        db.add(user)
        db.flush()
        if role == "admin":
            db.add(Profile(user_id=user.id, name="Admin", avatar_key=ADMIN_DEFAULT_AVATAR_KEY))
            # Clears the now-fulfilled allowlist entry so Settings > Admin
            # Access doesn't keep showing this email as "pending" once
            # they're already a real, provisioned admin.
            if email and email.strip().lower() in cfg.admin_emails:
                cfg.set_admin_emails([e for e in cfg.admin_emails if e != email.strip().lower()])
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
