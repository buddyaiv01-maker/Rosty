import hashlib
import secrets

from .config import settings


def generate_otp() -> str:
    digits = "0123456789"
    return "".join(secrets.choice(digits) for _ in range(settings.otp_length))


def hash_otp(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def verify_otp(code: str, code_hash: str) -> bool:
    return secrets.compare_digest(hash_otp(code), code_hash)
