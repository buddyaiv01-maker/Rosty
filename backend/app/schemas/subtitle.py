from pydantic import BaseModel, ConfigDict


class SubtitleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    language: str
    format: str
    file_path: str
