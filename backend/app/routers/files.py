import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/files", tags=["files"])

FILESTORE_DIR = Path("/app/filestore")

# MIME type → file extension for stored files
MIME_TO_EXT: dict[str, str] = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
}

EXT_TO_MIME: dict[str, str] = {v: k for k, v in MIME_TO_EXT.items()}

# PDFs are opened inline (browser PDF viewer); Office files are force-downloaded.
INLINE_MIME_TYPES = {"application/pdf"}

# Allowed filename pattern: UUID + known extension only
_SAFE_FILENAME = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    r"\.(pdf|docx|xlsx|pptx)$"
)


@router.get("/{filename}")
async def serve_file(
    filename: str,
    current_user: User = Depends(get_current_user),
):
    # Strict allowlist: only UUID-named files with known extensions
    if not _SAFE_FILENAME.match(filename):
        raise HTTPException(status_code=400, detail="Invalid filename.")

    path = FILESTORE_DIR / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found.")

    ext = path.suffix.lower()
    mime = EXT_TO_MIME.get(ext, "application/octet-stream")
    disposition = "inline" if mime in INLINE_MIME_TYPES else "attachment"

    return FileResponse(
        path=path,
        media_type=mime,
        headers={
            # Force download for Office files; inline rendering for PDFs.
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            # Prevent browsers from MIME-sniffing the response.
            "X-Content-Type-Options": "nosniff",
            # Do not cache potentially sensitive files.
            "Cache-Control": "private, no-store",
            # Restrict what a PDF loaded inline can do.
            "Content-Security-Policy": "sandbox allow-scripts",
        },
    )
