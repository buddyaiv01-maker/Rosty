import urllib.error
import urllib.request
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.auth.deps import require_admin
from app.config import StorageConfig
from app.database import get_db

router = APIRouter(prefix="/media", tags=["media"])


# The CMS forms used to download OMDb posters directly from the browser
# before uploading — but that CDN has inconsistent CORS support, occasionally
# serving a cached response with no CORS headers for a given image. Fetching
# server-side sidesteps CORS entirely, since it's purely a browser-enforced
# restriction. Host allowlisted to the known OMDb poster hosts rather than
# left open to arbitrary URLs, since an unrestricted "fetch any URL" endpoint
# is an SSRF vector even behind admin auth.
#
# Registered before the catch-all /{rel_path:path} route below — Starlette
# matches routes in registration order, and that catch-all would otherwise
# swallow "/proxy-image" as if it were a local file path.
ALLOWED_PROXY_HOSTS = {
    "m.media-amazon.com",
    "images-na.ssl-images-amazon.com",
    "img.omdbapi.com",
}


@router.get("/proxy-image", dependencies=[Depends(require_admin)])
def proxy_image(url: str = Query(...)) -> Response:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or parsed.hostname not in ALLOWED_PROXY_HOSTS:
        raise HTTPException(status_code=400, detail="URL host not allowed")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Rosty/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            content_type = resp.headers.get("Content-Type", "image/jpeg")
            data = resp.read()
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch image: {e}") from e
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=502, detail="Remote URL did not return an image")
    return Response(content=data, media_type=content_type)


@router.get("/{rel_path:path}")
def get_media_file(rel_path: str, db: Session = Depends(get_db)) -> FileResponse:
    storage = StorageConfig(db)
    resolved = (storage.media_root / rel_path).resolve()
    if storage.media_root not in resolved.parents and resolved != storage.media_root:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not resolved.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(resolved)
