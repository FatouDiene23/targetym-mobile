# =============================================
# API ROUTES - Upload d'images (blog, ressources)
# File: app/api/media_upload.py
# =============================================

import os
import uuid
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/media", tags=["Media Upload"])

# Dossier de stockage des médias
BASE_UPLOAD_DIR = Path("/app/public/media-uploads")

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

ALLOWED_VIDEO_TYPES = {
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-ms-wmv",
}
MAX_VIDEO_SIZE = 200 * 1024 * 1024  # 200 MB


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload une image (couverture article, thumbnail ressource, etc.)
    Retourne l'URL publique accessible via /media-uploads/...
    """
    # Vérification du type MIME
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Type de fichier non autorisé : {file.content_type}. Formats acceptés : JPEG, PNG, GIF, WebP, SVG",
        )

    # Lecture et vérification de la taille
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Fichier trop volumineux (max 5 Mo)",
        )

    # Détermination de l'extension
    extension_map = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
    }
    ext = extension_map.get(file.content_type, ".bin")

    # Génération d'un nom de fichier unique par tenant
    tenant_id = str(current_user.tenant_id) if current_user.tenant_id else "shared"
    upload_dir = BASE_UPLOAD_DIR / tenant_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = upload_dir / filename

    # Sauvegarde du fichier
    with open(file_path, "wb") as f:
        f.write(contents)

    # URL publique
    public_url = f"/media-uploads/{tenant_id}/{filename}"

    logger.info(f"Image uploaded: {public_url} by user {current_user.id}")

    return {"url": public_url, "filename": filename}


@router.post("/upload-video")
async def upload_video(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload une vidéo (ressource pédagogique, etc.)
    Retourne l'URL publique accessible via /media-uploads/...
    """
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Type de fichier non autorisé : {file.content_type}. Formats acceptés : MP4, WebM, OGG, MOV, AVI",
        )

    contents = await file.read()
    if len(contents) > MAX_VIDEO_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Fichier trop volumineux (max 200 Mo)",
        )

    extension_map = {
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/ogg": ".ogv",
        "video/quicktime": ".mov",
        "video/x-msvideo": ".avi",
        "video/x-ms-wmv": ".wmv",
    }
    ext = extension_map.get(file.content_type, ".mp4")

    tenant_id = str(current_user.tenant_id) if current_user.tenant_id else "shared"
    upload_dir = BASE_UPLOAD_DIR / tenant_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        f.write(contents)

    public_url = f"/media-uploads/{tenant_id}/{filename}"

    logger.info(f"Video uploaded: {public_url} by user {current_user.id}")

    return {"url": public_url, "filename": filename}
