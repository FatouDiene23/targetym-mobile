# ============================================
# API: Application Tour (Guide Applicatif)
# Fichier: app/api/app_tour.py
# ============================================

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import logging

from app.api.deps import get_db, get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["App Tour"])


# ============================================
# SCHEMAS
# ============================================

class AppTourStatus(BaseModel):
    """Status du tour applicatif pour l'utilisateur"""
    has_completed: bool
    completed_at: Optional[str] = None
    user_role: str


class CompleteAppTourRequest(BaseModel):
    """Requête pour marquer le tour comme complété"""
    force_reset: bool = False  # Pour réinitialiser le tour


# ============================================
# ENDPOINTS
# ============================================

@router.get("/api/app-tour/status", response_model=AppTourStatus)
def get_app_tour_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Récupère le statut du tour applicatif pour l'utilisateur connecté.
    
    Retourne:
    - has_completed: True si l'utilisateur a terminé le tour
    - completed_at: Date de complétion (si terminé)
    - user_role: Rôle de l'utilisateur (pour adapter le tour)
    """
    try:
        user = db.query(User).filter(User.id == current_user.id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        
        return AppTourStatus(
            has_completed=user.has_completed_app_tour or False,
            completed_at=user.app_tour_completed_at.isoformat() if user.app_tour_completed_at else None,
            user_role=user.role.value if hasattr(user.role, 'value') else str(user.role)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la récupération du statut du tour: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")


@router.post("/api/app-tour/complete")
def complete_app_tour(
    request: CompleteAppTourRequest = CompleteAppTourRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Marque le tour applicatif comme complété pour l'utilisateur.
    
    Si force_reset=True, réinitialise le tour (utile pour le revoir).
    """
    try:
        user = db.query(User).filter(User.id == current_user.id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        
        if request.force_reset:
            # Réinitialiser le tour
            user.has_completed_app_tour = False
            user.app_tour_completed_at = None
            db.commit()
            
            return {
                "success": True,
                "message": "Tour applicatif réinitialisé avec succès",
                "has_completed": False
            }
        else:
            # Marquer comme complété
            user.has_completed_app_tour = True
            user.app_tour_completed_at = datetime.utcnow()
            db.commit()
            
            return {
                "success": True,
                "message": "Tour applicatif complété avec succès",
                "has_completed": True,
                "completed_at": user.app_tour_completed_at.isoformat()
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du tour: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")


@router.post("/api/app-tour/reset")
def reset_app_tour(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Réinitialise le tour applicatif (équivalent à complete avec force_reset=True).
    Permet à l'utilisateur de revoir le guide.
    """
    try:
        user = db.query(User).filter(User.id == current_user.id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        
        user.has_completed_app_tour = False
        user.app_tour_completed_at = None
        db.commit()
        
        return {
            "success": True,
            "message": "Vous pouvez maintenant revoir le guide applicatif"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la réinitialisation du tour: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")
