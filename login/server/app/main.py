from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import auth

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Auth API")

# Bundled into Rosty, a LAN appliance reachable from any device on the
# network at the server's LAN IP — that IP (and the Origin header LAN devices
# send) isn't known ahead of time, so this mirrors Rosty's own backend
# CORS policy (wide open) rather than pinning to settings.frontend_origin.
# Safe to open up: auth uses a Bearer token, not cookies, so allow_credentials
# isn't needed and dropping it is what makes a wildcard origin valid at all.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)


@app.get("/health")
def health():
    return {"status": "ok"}
