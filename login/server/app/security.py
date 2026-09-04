from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from .config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

RESET_TOKEN_EXPIRE_MINUTES = 10


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def _encode(subject: str, scope: str, expire_minutes: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    payload = {"sub": subject, "scope": scope, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode(token: str, expected_scope: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    if payload.get("scope") != expected_scope:
        return None
    return payload.get("sub")


def create_access_token(subject: str) -> str:
    return _encode(subject, "access", settings.access_token_expire_minutes)


def decode_access_token(token: str) -> str | None:
    return _decode(token, "access")


def create_reset_token(subject: str) -> str:
    return _encode(subject, "password_reset", RESET_TOKEN_EXPIRE_MINUTES)


def decode_reset_token(token: str) -> str | None:
    return _decode(token, "password_reset")
