from typing import Literal

from pydantic import BaseModel, EmailStr


class AdminEmailEntry(BaseModel):
    email: str
    # "admin" = already has an account and is actually an admin right now.
    # "pending" = on the allowlist but hasn't registered yet — will become
    # admin on first login (see app/auth/deps.py).
    status: Literal["admin", "pending"]


class AdminEmailsResponse(BaseModel):
    emails: list[AdminEmailEntry]


class AdminEmailAdd(BaseModel):
    email: EmailStr


class AdminEmailActionResponse(BaseModel):
    action: Literal["added_to_allowlist", "promoted", "already_admin", "removed_from_allowlist", "demoted"]
    message: str
    emails: list[AdminEmailEntry]
