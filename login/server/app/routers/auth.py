from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..email_utils import send_otp_email
from ..models import EmailOtp, OtpPurpose, User
from ..otp import generate_otp, hash_otp, verify_otp
from ..schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResendOtpRequest,
    ResetPasswordRequest,
    ResetTokenResponse,
    SetPasswordRequest,
    TokenResponse,
    UserResponse,
    VerifyOtpRequest,
)
from ..security import create_access_token, create_reset_token, decode_reset_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _now():
    return datetime.now(timezone.utc)


def _issue_otp(db: Session, user: User, purpose: OtpPurpose) -> str:
    latest = db.execute(
        select(EmailOtp)
        .where(EmailOtp.user_id == user.id, EmailOtp.purpose == purpose)
        .order_by(EmailOtp.created_at.desc())
    ).scalars().first()

    if latest is not None:
        elapsed = (_now() - latest.created_at.replace(tzinfo=timezone.utc)).total_seconds()
        if elapsed < settings.otp_resend_cooldown_seconds:
            wait = int(settings.otp_resend_cooldown_seconds - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {wait}s before requesting another code.",
            )

    # Invalidate all previous unused codes for this purpose.
    db.query(EmailOtp).filter(
        EmailOtp.user_id == user.id,
        EmailOtp.purpose == purpose,
        EmailOtp.used.is_(False),
    ).update({"used": True})

    code = generate_otp()
    otp = EmailOtp(
        user_id=user.id,
        purpose=purpose,
        code_hash=hash_otp(code),
        expires_at=_now() + timedelta(minutes=settings.otp_expire_minutes),
    )
    db.add(otp)
    db.commit()
    return code


def _check_otp(db: Session, user: User, purpose: OtpPurpose, code: str) -> EmailOtp:
    otp = db.execute(
        select(EmailOtp)
        .where(EmailOtp.user_id == user.id, EmailOtp.purpose == purpose, EmailOtp.used.is_(False))
        .order_by(EmailOtp.created_at.desc())
    ).scalars().first()

    if otp is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active code. Request a new one.")

    if otp.expires_at.replace(tzinfo=timezone.utc) < _now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code expired. Request a new one.")

    if otp.attempts >= settings.otp_max_attempts:
        otp.used = True
        db.commit()
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts. Request a new code.")

    if not verify_otp(code, otp.code_hash):
        otp.attempts += 1
        db.commit()
        remaining = settings.otp_max_attempts - otp.attempts
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Incorrect code. {remaining} attempt(s) left.")

    otp.used = True
    db.commit()
    return otp


@router.post("/register", response_model=MessageResponse)
def register(payload: RegisterRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    existing = db.execute(select(User).where(User.email == payload.email)).scalars().first()

    if existing is not None and existing.email_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an account with this email. Please sign in instead.",
        )

    if existing is not None and not existing.email_verified:
        user = existing
    else:
        user = User(email=payload.email, password_hash=None)
        db.add(user)

    db.commit()
    db.refresh(user)

    code = _issue_otp(db, user, OtpPurpose.verify_email)
    background_tasks.add_task(send_otp_email, user.email, code, "verify_email")

    return {"message": "Verification code sent. Check your email."}


@router.post("/verify-email", response_model=TokenResponse)
def verify_email(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == payload.email)).scalars().first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found for this email.")

    if user.email_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already verified.")

    _check_otp(db, user, OtpPurpose.verify_email, payload.code)

    user.email_verified = True
    db.commit()

    token = create_access_token(subject=user.id)
    return {"access_token": token}


@router.post("/resend-otp", response_model=MessageResponse)
def resend_otp(payload: ResendOtpRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == payload.email)).scalars().first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found for this email.")

    if user.email_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already verified.")

    code = _issue_otp(db, user, OtpPurpose.verify_email)
    background_tasks.add_task(send_otp_email, user.email, code, "verify_email")

    return {"message": "A new verification code has been sent."}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    generic_error = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    user = db.execute(select(User).where(User.email == payload.email)).scalars().first()
    if user is None:
        raise generic_error

    if not user.email_verified or user.password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Finish creating your account first: verify your email and set a password.",
        )

    if not verify_password(payload.password, user.password_hash):
        raise generic_error

    token = create_access_token(subject=user.id)
    return {"access_token": token}


@router.post("/set-password", response_model=TokenResponse)
def set_password(
    payload: SetPasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verify your email first.")

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()

    token = create_access_token(subject=current_user.id)
    return {"access_token": token}


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(payload: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == payload.email)).scalars().first()

    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account exists with this email.")

    if not user.email_verified or user.password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account hasn't finished signing up yet. Create your account to continue.",
        )

    code = _issue_otp(db, user, OtpPurpose.reset_password)
    background_tasks.add_task(send_otp_email, user.email, code, "reset_password")

    return {"message": "A reset code has been sent to your email."}


@router.post("/verify-reset-code", response_model=ResetTokenResponse)
def verify_reset_code(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == payload.email)).scalars().first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid code.")

    _check_otp(db, user, OtpPurpose.reset_password, payload.code)

    reset_token = create_reset_token(subject=user.id)
    return {"reset_token": reset_token}


@router.post("/reset-password", response_model=TokenResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user_id = decode_reset_token(payload.reset_token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset session expired. Start over.")

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset session expired. Start over.")

    user.password_hash = hash_password(payload.new_password)
    db.commit()

    token = create_access_token(subject=user.id)
    return {"access_token": token}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.delete("/me", response_model=MessageResponse)
def delete_account(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted."}


@router.post("/logout", response_model=MessageResponse)
def logout():
    # Stateless JWTs: the client discards the token. Nothing to invalidate server-side
    # unless a token blacklist/session table is added later.
    return {"message": "Logged out."}
