# app/api/certificate_settings.py
"""
API pour la configuration des certificats de travail
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os
import uuid

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/settings/certificate", tags=["Certificate Settings"])

# Dossier pour les uploads
UPLOAD_DIR = "/app/uploads/certificates"


# ============================================
# SCHEMAS
# ============================================

class CertificateSettingsResponse(BaseModel):
    certificate_logo: Optional[str] = None
    certificate_signature: Optional[str] = None
    certificate_stamp: Optional[str] = None
    certificate_company_name: Optional[str] = None
    certificate_company_address: Optional[str] = None
    certificate_company_city: Optional[str] = None
    certificate_signatory_name: Optional[str] = None
    certificate_signatory_title: Optional[str] = None


class CertificateSettingsUpdate(BaseModel):
    certificate_company_name: Optional[str] = None
    certificate_company_address: Optional[str] = None
    certificate_company_city: Optional[str] = None
    certificate_signatory_name: Optional[str] = None
    certificate_signatory_title: Optional[str] = None


# ============================================
# HELPERS
# ============================================

def check_admin_permission(current_user: User):
    """Vérifie que l'utilisateur a les droits admin"""
    user_role = current_user.role.value.lower() if hasattr(current_user.role, 'value') else str(current_user.role).lower()
    allowed_roles = ['admin', 'dg', 'dga', 'rh', 'drh']
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès non autorisé")


# ============================================
# ENDPOINTS
# ============================================

@router.get("", response_model=CertificateSettingsResponse)
async def get_certificate_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Récupérer les paramètres de certificat du tenant"""
    check_admin_permission(current_user)
    
    result = db.execute(text("""
        SELECT 
            certificate_logo,
            certificate_signature,
            certificate_stamp,
            certificate_company_name,
            certificate_company_address,
            certificate_company_city,
            certificate_signatory_name,
            certificate_signatory_title
        FROM tenants 
        WHERE id = :tenant_id
    """), {"tenant_id": current_user.tenant_id}).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Tenant non trouvé")
    
    return CertificateSettingsResponse(
        certificate_logo=result[0],
        certificate_signature=result[1],
        certificate_stamp=result[2],
        certificate_company_name=result[3],
        certificate_company_address=result[4],
        certificate_company_city=result[5],
        certificate_signatory_name=result[6],
        certificate_signatory_title=result[7]
    )


@router.put("")
async def update_certificate_settings(
    data: CertificateSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mettre à jour les paramètres textuels de certificat"""
    check_admin_permission(current_user)
    
    # Construire la requête de mise à jour dynamiquement
    updates = []
    params = {"tenant_id": current_user.tenant_id}
    
    if data.certificate_company_name is not None:
        updates.append("certificate_company_name = :company_name")
        params["company_name"] = data.certificate_company_name
    
    if data.certificate_company_address is not None:
        updates.append("certificate_company_address = :company_address")
        params["company_address"] = data.certificate_company_address
    
    if data.certificate_company_city is not None:
        updates.append("certificate_company_city = :company_city")
        params["company_city"] = data.certificate_company_city
    
    if data.certificate_signatory_name is not None:
        updates.append("certificate_signatory_name = :signatory_name")
        params["signatory_name"] = data.certificate_signatory_name
    
    if data.certificate_signatory_title is not None:
        updates.append("certificate_signatory_title = :signatory_title")
        params["signatory_title"] = data.certificate_signatory_title
    
    if updates:
        query = f"UPDATE tenants SET {', '.join(updates)} WHERE id = :tenant_id"
        db.execute(text(query), params)
        db.commit()
    
    return {"message": "Paramètres mis à jour avec succès"}


@router.post("/upload/{file_type}")
async def upload_certificate_file(
    file_type: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Uploader un fichier pour les certificats.
    file_type: 'logo', 'signature', ou 'stamp'
    """
    check_admin_permission(current_user)
    
    # Valider le type de fichier
    if file_type not in ['logo', 'signature', 'stamp']:
        raise HTTPException(status_code=400, detail="Type de fichier invalide. Utilisez: logo, signature, stamp")
    
    # Valider l'extension
    allowed_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Extension non autorisée. Utilisez: {', '.join(allowed_extensions)}")
    
    # Valider la taille (max 2MB)
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux. Maximum 2MB")
    
    # Créer le dossier si nécessaire
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    # Générer un nom de fichier unique
    unique_filename = f"cert_{file_type}_{current_user.tenant_id}_{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Sauvegarder le fichier
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # URL relative pour la base de données
    file_url = f"/uploads/certificates/{unique_filename}"
    
    # Mettre à jour la base de données
    column_name = f"certificate_{file_type}"
    db.execute(
        text(f"UPDATE tenants SET {column_name} = :file_url WHERE id = :tenant_id"),
        {"file_url": file_url, "tenant_id": current_user.tenant_id}
    )
    db.commit()
    
    return {
        "message": f"{file_type.capitalize()} uploadé avec succès",
        "url": file_url,
        "filename": file.filename
    }


@router.delete("/upload/{file_type}")
async def delete_certificate_file(
    file_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Supprimer un fichier de certificat"""
    check_admin_permission(current_user)
    
    if file_type not in ['logo', 'signature', 'stamp']:
        raise HTTPException(status_code=400, detail="Type de fichier invalide")
    
    # Récupérer l'URL actuelle
    column_name = f"certificate_{file_type}"
    result = db.execute(
        text(f"SELECT {column_name} FROM tenants WHERE id = :tenant_id"),
        {"tenant_id": current_user.tenant_id}
    ).fetchone()
    
    if result and result[0]:
        # Supprimer le fichier physique
        file_path = f"/app{result[0]}"
        if os.path.exists(file_path):
            os.remove(file_path)
    
    # Mettre à jour la base de données
    db.execute(
        text(f"UPDATE tenants SET {column_name} = NULL WHERE id = :tenant_id"),
        {"tenant_id": current_user.tenant_id}
    )
    db.commit()
    
    return {"message": f"{file_type.capitalize()} supprimé"}
