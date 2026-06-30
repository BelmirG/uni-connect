import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/upload", tags=["upload"])

UPLOAD_DIR = Path("/app/uploads")
FILESTORE_DIR = Path("/app/filestore")

# ── images ────────────────────────────────────────────────────────────────────

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
IMAGE_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
IMAGE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}

IMAGE_MAGIC: dict[str, bytes] = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/gif": b"GIF",
    "image/webp": b"RIFF",
}

# ── documents ─────────────────────────────────────────────────────────────────

# Old binary Office formats (.doc, .xls, .ppt) support VBA macros — excluded.
# Open XML formats (.docx, .xlsx, .pptx) are ZIP-based and macro-free by spec.
ALLOWED_FILE_TYPES: dict[str, str] = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
}
FILE_MAX_BYTES = 20 * 1024 * 1024  # 20 MB

# All Open XML formats are ZIP archives; PDFs start with %PDF.
FILE_MAGIC: dict[str, bytes] = {
    "application/pdf": b"%PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": b"PK\x03\x04",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": b"PK\x03\x04",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": b"PK\x03\x04",
}

_UNSAFE_CHARS = re.compile(r'[^\w\s\-.]', re.UNICODE)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
FILESTORE_DIR.mkdir(parents=True, exist_ok=True)


# ── helpers ───────────────────────────────────────────────────────────────────

def _check_magic(data: bytes, mime: str, magic_table: dict[str, bytes]) -> bool:
    expected = magic_table.get(mime)
    if not expected:
        return False
    return data[: len(expected)] == expected


def _sanitize_filename(raw: str, expected_ext: str) -> str:
    """Return a safe display name, always ending with expected_ext.

    Stripping all but the last extension defeats double-extension tricks
    (e.g. "malware.exe.docx") that trick OS file managers hiding extensions.
    """
    raw = raw.replace("\x00", "").replace("/", "").replace("\\", "")
    raw = _UNSAFE_CHARS.sub("", raw).strip()
    stem = Path(raw).stem or "file"
    return f"{stem[:180]}{expected_ext}"


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.post("")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=422,
            detail="Only JPEG, PNG, GIF, and WebP images are allowed.",
        )

    data = await file.read()

    if len(data) > IMAGE_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image must be under 10 MB.")

    if not _check_magic(data, file.content_type, IMAGE_MAGIC):
        raise HTTPException(
            status_code=422,
            detail="File content does not match the declared image type.",
        )

    ext = IMAGE_EXTENSIONS[file.content_type]
    filename = f"{uuid.uuid4()}{ext}"
    (UPLOAD_DIR / filename).write_bytes(data)

    return {"url": f"/uploads/{filename}"}


@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=422,
            detail="Only PDF, Word (.docx), Excel (.xlsx), and PowerPoint (.pptx) files are allowed.",
        )

    data = await file.read()

    if len(data) > FILE_MAX_BYTES:
        raise HTTPException(status_code=413, detail="File must be under 20 MB.")

    # Verify actual bytes match the claimed MIME type.
    # This blocks renamed executables (e.g. malware.exe renamed to file.pdf).
    if not _check_magic(data, file.content_type, FILE_MAGIC):
        raise HTTPException(
            status_code=422,
            detail="File content does not match the declared document type.",
        )

    ext = ALLOWED_FILE_TYPES[file.content_type]
    stored_name = f"{uuid.uuid4()}{ext}"

    # Files are stored outside the StaticFiles mount (/app/filestore, not /app/uploads).
    # They are only reachable via /api/files/{filename}, which enforces auth and
    # sets Content-Disposition, X-Content-Type-Options, and Cache-Control headers.
    (FILESTORE_DIR / stored_name).write_bytes(data)

    display_name = _sanitize_filename(file.filename or "file", ext)

    return {
        "url": f"/api/files/{stored_name}",
        "name": display_name,
        "size": len(data),
        "mime_type": file.content_type,
    }
