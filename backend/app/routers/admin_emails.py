"""Admin-editable list controlling who has admin access.

For an email with no account yet, adding it to the allowlist means that
account gets role=admin the first time it registers and verifies (see
_is_admin_email / JIT-provisioning in app/auth/deps.py) — that entry then
clears itself from the allowlist once that happens.

For an email that already has an account, add/remove act directly on that
account instead of the allowlist, since the allowlist is only ever
consulted at first-ever login and has no effect on an existing row:
- Add  -> promotes the existing account to admin immediately.
- Remove -> demotes it back to a regular user immediately (and clears it
  from the allowlist too, so no stale "will become admin" entry lingers).

The list shown to the admin combines both: real admin accounts (status=
"admin") and not-yet-registered allowlist entries (status="pending") — just
the pending list on its own would make a promoted account vanish from view
entirely, with no lasting confirmation it actually has access.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import ADMIN_DEFAULT_AVATAR_KEY, require_admin
from app.config import StorageConfig
from app.database import get_db
from app.models import Profile, User
from app.schemas.admin_emails import AdminEmailAdd, AdminEmailActionResponse, AdminEmailEntry, AdminEmailsResponse

router = APIRouter(prefix="/admin-emails", tags=["admin-emails"], dependencies=[Depends(require_admin)])


def _current_view(db: Session) -> list[AdminEmailEntry]:
    cfg = StorageConfig(db)
    admin_emails = {
        e.strip().lower() for e in db.scalars(select(User.email).where(User.role == "admin", User.email.isnot(None))).all() if e
    }
    entries = [AdminEmailEntry(email=e, status="admin") for e in sorted(admin_emails)]
    entries += [AdminEmailEntry(email=e, status="pending") for e in sorted(set(cfg.admin_emails) - admin_emails)]
    return entries


@router.get("", response_model=AdminEmailsResponse)
def list_admin_emails(db: Session = Depends(get_db)) -> AdminEmailsResponse:
    return AdminEmailsResponse(emails=_current_view(db))


@router.post("", response_model=AdminEmailActionResponse, status_code=201)
def add_admin_email(payload: AdminEmailAdd, db: Session = Depends(get_db)) -> AdminEmailActionResponse:
    email = payload.email.strip().lower()
    cfg = StorageConfig(db)

    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        if existing.role == "admin":
            return AdminEmailActionResponse(action="already_admin", message="This account is already an admin.", emails=_current_view(db))
        existing.role = "admin"
        if db.query(Profile).filter(Profile.user_id == existing.id).first() is None:
            db.add(Profile(user_id=existing.id, name="Admin", avatar_key=ADMIN_DEFAULT_AVATAR_KEY))
        db.commit()
        return AdminEmailActionResponse(
            action="promoted",
            message="This email already had an account — it has been promoted to admin.",
            emails=_current_view(db),
        )

    if email in cfg.admin_emails:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This email is already on the admin allowlist.")

    cfg.set_admin_emails([*cfg.admin_emails, email])
    return AdminEmailActionResponse(
        action="added_to_allowlist",
        message="Added — this account will get admin access the first time it registers and verifies.",
        emails=_current_view(db),
    )


@router.delete("/{email}", response_model=AdminEmailActionResponse)
def remove_admin_email(email: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)) -> AdminEmailActionResponse:
    normalized = email.strip().lower()

    # A disabled button on the frontend is cosmetic only — this is the real
    # guard against an admin locking themselves out via a direct API call.
    if current_user.email and current_user.email.strip().lower() == normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't remove your own admin access.")

    cfg = StorageConfig(db)

    existing = db.scalar(select(User).where(User.email == normalized))
    on_list = normalized in cfg.admin_emails

    if existing is None and not on_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This email is not on the admin allowlist.")

    if on_list:
        cfg.set_admin_emails([e for e in cfg.admin_emails if e != normalized])

    if existing is not None and existing.role == "admin":
        existing.role = "user"
        db.commit()
        return AdminEmailActionResponse(
            action="demoted",
            message="This account's admin access has been revoked — they are now a regular user.",
            emails=_current_view(db),
        )

    return AdminEmailActionResponse(action="removed_from_allowlist", message="Removed from the allowlist.", emails=_current_view(db))
