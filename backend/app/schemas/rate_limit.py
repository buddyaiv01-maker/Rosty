from pydantic import BaseModel, Field


class RateLimitThreshold(BaseModel):
    max_requests: int = Field(ge=1, le=1000)
    window_seconds: int = Field(ge=1, le=86400)


class RateLimitConfigResponse(BaseModel):
    login: RateLimitThreshold
    registration: RateLimitThreshold


class RateLimitConfigUpdate(BaseModel):
    login: RateLimitThreshold | None = None
    registration: RateLimitThreshold | None = None
