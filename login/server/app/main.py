import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import Base, engine
from .routers import auth, internal

Base.metadata.create_all(bind=engine)

logger = logging.getLogger("auth")

app = FastAPI(title="Auth API")

# Matches http(s)://<private-LAN-address-or-localhost>[:port] — the actual
# LAN IP a device uses isn't known ahead of time (see ARCHITECTURE.md), so
# this can't be a fixed origin list, but it's still meaningfully tighter
# than a bare wildcard: an origin from a public IP (e.g. this app somehow
# reachable over the internet, against SECURITY.md's guidance) is rejected.
_LAN_ORIGIN_REGEX = (
    r"^https?://("
    r"localhost|127\.0\.0\.1|"
    r"10(\.\d{1,3}){3}|"
    r"172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|"
    r"192\.168(\.\d{1,3}){2}"
    r")(:\d+)?$"
)


# Catches anything that isn't already an HTTPException (FastAPI/Starlette
# handle those with their own more-specific handler, registered separately —
# this one only ever fires for genuinely unhandled errors) so a bug never
# leaks a raw traceback to the client; the real trace still goes to the logs.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


# Bundled into Rosty, a LAN appliance reachable from any device on the
# network at the server's LAN IP — that IP (and the Origin header LAN devices
# send) isn't known ahead of time, so this can't pin to settings.frontend_origin;
# allow_origin_regex reflects any private-LAN origin instead (see
# _LAN_ORIGIN_REGEX above). Safe either way: auth uses a Bearer token, not
# cookies, so allow_credentials isn't needed and dropping it is what makes a
# reflected/wildcard origin valid at all.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=_LAN_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(internal.router)


@app.get("/health")
def health():
    return {"status": "ok"}
