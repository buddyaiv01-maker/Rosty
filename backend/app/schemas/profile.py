from pydantic import BaseModel


class ProfileCreate(BaseModel):
    name: str
    avatar_key: str


class ProfileUpdate(BaseModel):
    name: str | None = None
    avatar_key: str | None = None


class ProfileRead(BaseModel):
    id: int
    name: str
    avatar_key: str
