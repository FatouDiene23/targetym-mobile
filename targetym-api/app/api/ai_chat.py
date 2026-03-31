"""
API endpoints pour le chatbot AI
Gère les conversations, messages, et interactions avec Claude
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_employee
from app.models.user import User
from app.models.employee import Employee
from app.models.chat import ChatConversation, ChatMessage, MessageRole
from app.schemas.chat import (
    ChatMessageCreate, ChatMessageResponse,
    ChatConversationCreate, ChatConversationResponse,
    ChatConversationWithMessages, HumanEscalationResponse
)
from app.services.ai_chat_service import ai_chat_service
from app.services.ai_agent_service import ai_agent_service
from datetime import datetime
import io

router = APIRouter()


# ============================================
# ENDPOINTS CONVERSATIONS
# ============================================

@router.get("/conversations", response_model=List[ChatConversationResponse])
async def get_my_conversations(
    current_user: User = Depends(get_current_user),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db)
):
    """Liste toutes les conversations de l'employé connecté"""
    
    conversations = db.query(ChatConversation).filter(
        ChatConversation.employee_id == employee.id,
        ChatConversation.tenant_id == current_user.tenant_id,
        ChatConversation.is_active == 1
    ).order_by(ChatConversation.updated_at.desc()).all()
    
    # Ajouter le nombre de messages
    result = []
    for conv in conversations:
        conv_dict = {
            "id": conv.id,
            "employee_id": conv.employee_id,
            "title": conv.title,
            "is_active": conv.is_active,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "message_count": len(conv.messages)
        }
        result.append(ChatConversationResponse(**conv_dict))
    
    return result


@router.get("/conversations/{conversation_id}", response_model=ChatConversationWithMessages)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db)
):
    """Récupère une conversation complète avec tous ses messages"""
    
    conversation = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.employee_id == employee.id,
        ChatConversation.tenant_id == current_user.tenant_id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation non trouvée"
        )
    
    return conversation


@router.post("/conversations", response_model=ChatConversationResponse)
async def create_conversation(
    data: ChatConversationCreate,
    current_user: User = Depends(get_current_user),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db)
):
    """Crée une nouvelle conversation"""
    
    try:
        # Générer un titre si un message initial est fourni
        title = data.title
        if not title and data.initial_message:
            title = await ai_chat_service.generate_conversation_title(data.initial_message)
        
        conversation = ChatConversation(
            employee_id=employee.id,
            tenant_id=current_user.tenant_id,
            title=title or "Nouvelle conversation",
            is_active=1
        )
        
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        
        return ChatConversationResponse(
            id=conversation.id,
            employee_id=conversation.employee_id,
            title=conversation.title,
            is_active=conversation.is_active,
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
            message_count=0
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la création de la conversation: {str(e)}"
        )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db)
):
    """Archive (soft delete) une conversation"""
    
    try:
        conversation = db.query(ChatConversation).filter(
            ChatConversation.id == conversation_id,
            ChatConversation.employee_id == employee.id,
            ChatConversation.tenant_id == current_user.tenant_id
        ).first()
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation non trouvée"
            )
        
        conversation.is_active = 0
        db.commit()
        
        return {"message": "Conversation archivée avec succès"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'archivage de la conversation: {str(e)}"
        )


# ============================================
# ENDPOINTS MESSAGES
# ============================================

@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    data: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db)
):
    """
    Envoie un message et obtient une réponse de l'IA
    Si conversation_id est None, crée une nouvelle conversation
    """
    
    if not ai_chat_service.is_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Le chatbot n'est pas activé. Veuillez configurer ANTHROPIC_API_KEY."
        )
    
    try:
        # Récupérer tenant_id au début pour éviter le lazy loading plus tard
        tenant_id = current_user.tenant_id
        employee_id = employee.id
        
        # Vérifier/créer la conversation
        conversation_id = data.conversation_id
        
        if not conversation_id:
            # Créer une nouvelle conversation
            title = await ai_chat_service.generate_conversation_title(data.content)
            conversation = ChatConversation(
                employee_id=employee_id,
                tenant_id=tenant_id,
                title=title,
                is_active=1
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            conversation_id = conversation.id
        else:
            # Vérifier que la conversation appartient à l'employé
            conversation = db.query(ChatConversation).filter(
                ChatConversation.id == conversation_id,
                ChatConversation.employee_id == employee_id,
                ChatConversation.tenant_id == tenant_id
            ).first()
            
            if not conversation:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Conversation non trouvée"
                )
        
        # Sauvegarder le message utilisateur
        user_message = ChatMessage(
            conversation_id=conversation_id,
            tenant_id=tenant_id,
            role=MessageRole.USER,
            content=data.content
        )
        db.add(user_message)
        db.commit()
        
        # Récupérer l'historique de la conversation
        history_messages = db.query(ChatMessage).filter(
            ChatMessage.conversation_id == conversation_id
        ).order_by(ChatMessage.created_at.asc()).all()
        
        # Formater l'historique pour Claude (en vérifiant que chaque message est valide)
        conversation_history = []
        for msg in history_messages:
            if msg.role != MessageRole.SYSTEM and msg.content and msg.role:
                # Valider que le role est correct
                role_value = msg.role.value if hasattr(msg.role, 'value') else str(msg.role)
                if role_value in ["user", "assistant"]:
                    conversation_history.append({
                        "role": role_value,
                        "content": str(msg.content).strip()
                    })
        
        print(f"📚 Historique chargé: {len(conversation_history)} messages")
        
        # Obtenir la réponse de l'IA avec accès aux données
        ai_response = await ai_chat_service.generate_response(
            message=data.content,
            employee=employee,
            conversation_history=conversation_history[:-1],  # Exclure le dernier (déjà dans message)
            db=db  # Passer la session DB pour les tools
        )
        
        # Vérifier si escalade humaine
        if ai_response.get("needs_human"):
            escalation_data = ai_response["escalation"]
            assistant_content = f"""🤚 {escalation_data['message']}

Pour cette question, je vous recommande de contacter directement notre équipe:

📧 **Email**: {escalation_data['contact_email']}
💬 **WhatsApp**: {escalation_data['contact_whatsapp']}

Je reste disponible pour toute autre question sur vos congés, objectifs, tâches, ou formations !"""
        elif ai_response.get("error"):
            assistant_content = ai_response["message"]
        else:
            assistant_content = ai_response["message"]
        
        # Sauvegarder la réponse de l'assistant
        assistant_message = ChatMessage(
            conversation_id=conversation_id,
            tenant_id=tenant_id,
            role=MessageRole.ASSISTANT,
            content=assistant_content,
            tokens_used=ai_response.get("tokens_used")
        )
        db.add(assistant_message)
        
        # Mettre à jour le updated_at de la conversation
        conversation.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(assistant_message)
        
        return ChatMessageResponse(
            id=assistant_message.id,
            conversation_id=assistant_message.conversation_id,
            role=assistant_message.role,
            content=assistant_message.content,
            created_at=assistant_message.created_at,
            tokens_used=assistant_message.tokens_used
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import traceback
        print(f"❌ Erreur dans send_message: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'envoi du message: {str(e)}"
        )


@router.get("/status")
async def get_chatbot_status(
    current_user: User = Depends(get_current_user)
):
    """Vérifie si le chatbot est activé et configuré"""
    
    return {
        "enabled": ai_chat_service.is_enabled(),
        "model": ai_chat_service.model if ai_chat_service.is_enabled() else None,
        "message": "Chatbot prêt" if ai_chat_service.is_enabled() else "Chatbot non configuré"
    }


# ============================================
# ENDPOINTS AGENT - CHAT CONTEXTUEL + ACTIONS
# ============================================

class AgentMessageRequest(BaseModel):
    message: str
    page_path: str = "/dashboard"
    file_text: Optional[str] = None
    conversation_history: Optional[List[Dict[str, Any]]] = None


class ExecuteActionRequest(BaseModel):
    action_type: str  # generate_onboarding_program | generate_okr_objectives | generate_training_plan | generate_job_posting
    data: Dict[str, Any]


@router.post("/agent")
async def send_agent_message(
    data: AgentMessageRequest,
    current_user: User = Depends(get_current_user),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db)
):
    """
    Chat agentique contextuel.
    Détecte la page, génère du contenu structuré (programmes, OKRs, etc.)
    et retourne une prévisualisation pour validation par l'utilisateur.
    """
    if not ai_agent_service.is_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Le chat agentique n'est pas disponible. Vérifiez ANTHROPIC_API_KEY."
        )

    try:
        # Sur la page recrutement, injecter les offres actives dans le contexte
        extra_context = None
        if data.page_path and "/recruitment" in data.page_path:
            from app.models.recruitment import JobPosting as JobPostingModel
            active_jobs = db.query(JobPostingModel).filter(
                JobPostingModel.tenant_id == current_user.tenant_id,
                JobPostingModel.status.in_(["active", "draft"])
            ).order_by(JobPostingModel.id.desc()).limit(20).all()
            if active_jobs:
                job_lines = "\n".join(
                    f"- ID={j.id} : {j.title} ({j.contract_type or 'N/A'})"
                    for j in active_jobs
                )
                extra_context = f"OFFRES D'EMPLOI DISPONIBLES (actives et brouillons — utilise ces IDs pour job_posting_id):\n{job_lines}"

        # Injecter les départements disponibles (utile pour create_department et generate_employee)
        from app.models.department import Department as DeptModelCtx
        departments_ctx = db.query(DeptModelCtx).filter(
            DeptModelCtx.tenant_id == current_user.tenant_id,
            DeptModelCtx.is_active == True
        ).order_by(DeptModelCtx.name).limit(60).all()
        if departments_ctx:
            dept_lines = "\n".join(
                f"- {d.name} (niveau: {d.level or 'departement'})"
                for d in departments_ctx
            )
            dept_ctx_str = f"UNITÉS ORGANISATIONNELLES DISPONIBLES (utilise ces noms dans department_name) :\n{dept_lines}"
            extra_context = (extra_context + "\n\n" + dept_ctx_str) if extra_context else dept_ctx_str

        result = ai_agent_service.send_agent_message(
            message=data.message,
            page_path=data.page_path,
            employee=employee,
            conversation_history=data.conversation_history,
            file_text=data.file_text,
            extra_context=extra_context,
        )
        return result
    except Exception as e:
        import traceback
        print(f"❌ Erreur agent: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors du traitement: {str(e)}"
        )


@router.post("/execute-action")
async def execute_agent_action(
    data: ExecuteActionRequest,
    current_user: User = Depends(get_current_user),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db)
):
    """
    Exécute une action agentique après validation utilisateur.
    Insère réellement les données en base selon le type d'action.
    """
    from sqlalchemy import text
    from datetime import date

    tenant_id = current_user.tenant_id
    action_type = data.action_type
    action_data = data.data

    try:
        # ----------------------------------------------------------------
        # ONBOARDING : créer programme + tâches
        # ----------------------------------------------------------------
        if action_type == "generate_onboarding_program":
            # Créer le programme
            prog_result = db.execute(text("""
                INSERT INTO onboarding_programs
                    (tenant_id, name, description, department_id, job_title, duration_days, is_default, created_by)
                VALUES
                    (:tenant_id, :name, :description, null, :job_title, :duration_days, false, :created_by)
                RETURNING id
            """), {
                "tenant_id": tenant_id,
                "name": action_data.get("name", "Programme généré par IA"),
                "description": action_data.get("description", ""),
                "job_title": action_data.get("job_title", ""),
                "duration_days": action_data.get("duration_days", 90),
                "created_by": employee.id,
            })
            program_id = prog_result.fetchone()[0]

            # Créer les tâches
            tasks = action_data.get("tasks", [])
            for i, task in enumerate(tasks):
                db.execute(text("""
                    INSERT INTO onboarding_tasks
                        (program_id, title, description, category, assigned_role, due_day,
                         sort_order, is_required, requires_document, document_type)
                    VALUES
                        (:program_id, :title, :description, :category, :assigned_role,
                         :due_day, :sort_order, :is_required, false, null)
                """), {
                    "program_id": program_id,
                    "title": task.get("title", f"Tâche {i+1}"),
                    "description": task.get("description", ""),
                    "category": {
                        "administrative": "administratif", "admin": "administratif",
                        "technical": "acces_it", "it": "acces_it",
                        "cultural": "rencontre", "meeting": "rencontre",
                        "training": "formation", "equipment": "materiel",
                    }.get(task.get("category", "general"), task.get("category", "general")),
                    "assigned_role": {
                        "rh": "hr", "admin": "hr",
                    }.get(task.get("assigned_role", "hr"), task.get("assigned_role", "hr")),
                    "due_day": task.get("due_day", 1),
                    "sort_order": i,
                    "is_required": task.get("is_required", True),
                })

            db.commit()
            return {
                "success": True,
                "message": f"Programme d'onboarding '{action_data.get('name')}' créé avec {len(tasks)} tâche(s).",
                "program_id": program_id
            }

        # ----------------------------------------------------------------
        # OKR : créer objectif(s) + key results
        # ----------------------------------------------------------------
        elif action_type == "generate_okr_objectives":
            objectives = action_data.get("objectives", [])
            created_ids = []

            for obj in objectives:
                quarter = obj.get("quarter", 1)
                year = obj.get("year", date.today().year)
                period = f"Q{quarter}-{year}"

                obj_result = db.execute(text("""
                    INSERT INTO objectives
                        (tenant_id, title, description, level, owner_id, period,
                         start_date, end_date, status, is_active, created_at, updated_at)
                    VALUES
                        (:tenant_id, :title, :description, 'individual', :owner_id, :period,
                         :start_date, :end_date, 'active', true, NOW(), NOW())
                    RETURNING id
                """), {
                    "tenant_id": tenant_id,
                    "title": obj.get("title"),
                    "description": obj.get("description", ""),
                    "owner_id": employee.id,
                    "period": period,
                    "start_date": date(year, (quarter - 1) * 3 + 1, 1),
                    "end_date": date(year, quarter * 3, 28),
                })
                objective_id = obj_result.fetchone()[0]
                created_ids.append(objective_id)

                for kr in obj.get("key_results", []):
                    db.execute(text("""
                        INSERT INTO key_results
                            (objective_id, title, target, current, unit, weight, created_at, updated_at)
                        VALUES
                            (:objective_id, :title, :target, 0, :unit, 100, NOW(), NOW())
                    """), {
                        "objective_id": objective_id,
                        "title": kr.get("title"),
                        "target": kr.get("target_value", 100),
                        "unit": kr.get("unit", "%"),
                    })

            db.commit()
            return {
                "success": True,
                "message": f"{len(objectives)} objectif(s) OKR créé(s) avec succès.",
                "objective_ids": created_ids
            }

        # ----------------------------------------------------------------
        # FORMATION : enregistrer le plan de formation
        # ----------------------------------------------------------------
        elif action_type == "generate_training_plan":
            plan_title = action_data.get("plan_title", "Plan de formation IA")
            courses = action_data.get("courses", [])

            # Insérer le plan dans la table training_plans si elle existe
            # sinon on crée dans learning_courses / formations selon le schéma
            try:
                plan_result = db.execute(text("""
                    INSERT INTO training_plans
                        (tenant_id, title, description, target_profile, duration_weeks, created_by, created_at, updated_at)
                    VALUES
                        (:tenant_id, :title, :description, :target_profile, :duration_weeks, :created_by, NOW(), NOW())
                    RETURNING id
                """), {
                    "tenant_id": tenant_id,
                    "title": plan_title,
                    "description": f"Plan de formation généré par IA - {len(courses)} modules",
                    "target_profile": action_data.get("target_profile", ""),
                    "duration_weeks": action_data.get("duration_weeks", len(courses)),
                    "created_by": employee.id,
                })
                plan_id = plan_result.fetchone()[0]
                db.commit()
                return {
                    "success": True,
                    "message": f"Plan de formation '{plan_title}' créé avec {len(courses)} module(s).",
                    "plan_id": plan_id
                }
            except Exception:
                db.rollback()
                # Table non trouvée - retourner les données pour usage externe
                return {
                    "success": True,
                    "message": f"Plan de formation '{plan_title}' généré ({len(courses)} modules). Importez-le dans votre système de formation.",
                    "data": action_data
                }

        # ----------------------------------------------------------------
        # RECRUTEMENT : créer candidat
        # ----------------------------------------------------------------
        elif action_type == "generate_candidate":
            from app.models.recruitment import Candidate, CandidateApplication
            candidate = Candidate(
                tenant_id=tenant_id,
                first_name=action_data.get("first_name"),
                last_name=action_data.get("last_name"),
                email=action_data.get("email"),
                phone=action_data.get("phone"),
                current_position=action_data.get("current_position"),
                source=action_data.get("source", "Autre"),
                notes=action_data.get("notes"),
                cv_url=action_data.get("cv_tmp_path") or None,
                cv_filename=action_data.get("cv_filename") or None,
            )
            db.add(candidate)
            db.flush()  # obtenir candidate.id sans commit

            # Si un job_posting_id est fourni, créer aussi la candidature (visible dans le kanban)
            job_posting_id = action_data.get("job_posting_id")
            message_suffix = "Il apparaîtra dans le kanban après validation."
            if job_posting_id:
                application = CandidateApplication(
                    tenant_id=tenant_id,
                    candidate_id=candidate.id,
                    job_posting_id=int(job_posting_id),
                    stage="new",
                )
                db.add(application)
                message_suffix = "Il apparaît maintenant dans le kanban (colonne Nouveau)."

            db.commit()
            db.refresh(candidate)
            return {
                "success": True,
                "message": f"Candidat {action_data.get('first_name')} {action_data.get('last_name')} créé. {message_suffix}",
                "candidate_id": candidate.id
            }

        # ----------------------------------------------------------------
        # RECRUTEMENT : créer offre d'emploi
        # ----------------------------------------------------------------
        elif action_type == "generate_job_posting":
            from app.models.recruitment import JobPosting as JobPostingModel
            job = JobPostingModel(
                tenant_id=tenant_id,
                title=action_data.get("title"),
                description=action_data.get("description", ""),
                responsibilities=action_data.get("responsibilities", ""),
                contract_type=action_data.get("contract_type", "CDI"),
                location=action_data.get("location", ""),
                status="draft",
                urgency="medium",
                recruiter_id=employee.id,
            )
            db.add(job)
            db.commit()
            db.refresh(job)
            return {
                "success": True,
                "message": f"Offre d'emploi '{action_data.get('title')}' créée en brouillon dans Recrutement → Offres.",
                "job_id": job.id
            }

        # ----------------------------------------------------------------
        # ORGANISATION : créer une unité organisationnelle (département, service, etc.)
        # ----------------------------------------------------------------
        elif action_type == "create_department":
            dept_result = db.execute(text("""
                INSERT INTO departments
                    (tenant_id, name, code, description, color, level, is_active, created_at, updated_at)
                VALUES
                    (:tenant_id, :name, :code, :description, :color, :level, true, NOW(), NOW())
                RETURNING id
            """), {
                "tenant_id": tenant_id,
                "name": action_data.get("name"),
                "code": action_data.get("code") or action_data.get("name", "")[:6].upper().replace(" ", ""),
                "description": action_data.get("description", ""),
                "color": action_data.get("color", "#3B82F6"),
                "level": action_data.get("level", "departement"),
            })
            dept_id = dept_result.fetchone()[0]
            db.commit()
            level_labels = {
                "president": "Présidence", "vice_president": "Vice-Présidence",
                "dg": "Direction Générale", "dga": "Direction Générale Adjointe",
                "direction_centrale": "Direction Centrale", "direction": "Direction",
                "departement": "Département", "service": "Service",
            }
            level_label = level_labels.get(action_data.get("level", "departement"), action_data.get("level", "Département"))
            return {
                "success": True,
                "message": f"{level_label} '{action_data.get('name')}' créé(e) avec succès. Visible dans Employés → Unités.",
                "department_id": dept_id
            }

        elif action_type == "generate_employee":
            from app.models.employee import Employee as EmployeeModel
            from app.models.department import Department as DeptModel
            from datetime import datetime as _dt

            email = action_data.get("email", "").strip()
            if not email:
                raise HTTPException(status_code=400, detail="L'email est obligatoire pour créer un employé.")

            # Vérifier unicité email
            existing_emp = db.query(EmployeeModel).filter(
                EmployeeModel.email == email,
                EmployeeModel.tenant_id == tenant_id
            ).first()
            if existing_emp:
                raise HTTPException(status_code=400, detail=f"Un employé avec l'email '{email}' existe déjà.")

            # Résoudre department_name → department_id
            department_id = None
            dept_name = action_data.get("department_name", "").strip()
            if dept_name:
                dept = db.query(DeptModel).filter(
                    DeptModel.name.ilike(f"%{dept_name}%"),
                    DeptModel.tenant_id == tenant_id
                ).first()
                if dept:
                    department_id = dept.id

            # Parser hire_date
            hire_date = None
            raw_date = action_data.get("hire_date", "")
            if raw_date:
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                    try:
                        hire_date = _dt.strptime(raw_date, fmt).date()
                        break
                    except ValueError:
                        pass

            gender_val = action_data.get("gender")
            if gender_val not in ("male", "female"):
                gender_val = None

            valid_roles = ["employee", "manager", "rh", "admin", "dg", "dga", "drh"]
            role_val = (action_data.get("role") or "employee").lower()
            if role_val not in valid_roles:
                role_val = "employee"

            contract_map = {"CDI": "CDI", "CDD": "CDD", "Stage": "Stage", "Alternance": "Alternance", "Freelance": "Freelance"}
            contract_val = contract_map.get(action_data.get("contract_type", "CDI"), "CDI")

            new_emp = EmployeeModel(
                tenant_id=tenant_id,
                first_name=action_data.get("first_name", "").strip(),
                last_name=action_data.get("last_name", "").strip(),
                email=email,
                phone=action_data.get("phone") or None,
                gender=gender_val,
                job_title=action_data.get("job_title") or None,
                department_id=department_id,
                is_manager=bool(action_data.get("is_manager", False)),
                role=role_val,
                site=action_data.get("site") or None,
                nationality=action_data.get("nationality") or None,
                contract_type=contract_val,
                hire_date=hire_date,
                status="active",
            )
            db.add(new_emp)
            db.commit()
            db.refresh(new_emp)
            full_name = f"{new_emp.first_name} {new_emp.last_name}"
            dept_info = f" dans le département '{dept_name}'" if dept_name and department_id else ""
            return {
                "success": True,
                "message": f"Employé '{full_name}' créé avec succès{dept_info}. Visible dans la liste des Employés.",
                "employee_id": new_emp.id,
            }

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Type d'action inconnu: {action_type}"
            )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        print(f"❌ execute-action error: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'insertion: {str(e)}"
        )


@router.post("/extract-pdf")
async def extract_pdf_text(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Extrait le texte d'un fichier uploadé.
    Formats supportés : PDF, DOCX, DOC, TXT, RTF, XLSX, XLS, CSV.
    Sauvegarde aussi le fichier sur disque pour pouvoir le lier au candidat créé.
    """
    import os, re, uuid
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier manquant.")

    fname = file.filename.lower()
    supported = (".pdf", ".docx", ".doc", ".txt", ".text", ".rtf", ".xlsx", ".xls", ".csv")
    if not any(fname.endswith(ext) for ext in supported):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Format non supporté. Formats acceptés : PDF, DOCX, DOC, TXT, RTF, XLSX, XLS, CSV."
        )

    contents = await file.read()

    # Sauvegarder le fichier sur disque pour pouvoir le lier au candidat après création
    cv_dir = os.path.abspath("uploads/recruitment/cvs")
    os.makedirs(cv_dir, exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower()
    safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', os.path.basename(file.filename))
    tmp_name = f"tmp_{current_user.tenant_id}_{uuid.uuid4().hex}{ext}"
    cv_tmp_path = os.path.join(cv_dir, tmp_name)
    with open(cv_tmp_path, "wb") as f:
        f.write(contents)
    full_text = ""
    extra: dict = {}

    try:
        if fname.endswith(".pdf"):
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(contents))
            parts = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    parts.append(t)
            full_text = "\n\n".join(parts)
            extra["pages"] = len(reader.pages)
            if not full_text.strip():
                extra["warning"] = "Aucun texte extractible (PDF scanné ?)"

        elif fname.endswith(".docx"):
            from docx import Document  # python-docx
            doc = Document(io.BytesIO(contents))
            full_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())

        elif fname.endswith(".doc"):
            # .doc (ancien format Word) — lecture best-effort via décodage latin-1
            raw = contents.decode("latin-1", errors="replace")
            # Extraire les runs de texte entre les séquences binaires
            import re as _re
            parts = _re.findall(r'[\x20-\x7e\xc0-\xff]{4,}', raw)
            full_text = " ".join(parts)

        elif fname.endswith(".rtf"):
            from striprtf.striprtf import rtf_to_text
            raw = contents.decode("utf-8", errors="replace")
            full_text = rtf_to_text(raw)

        elif fname.endswith((".txt", ".text")):
            for enc in ("utf-8", "latin-1", "cp1252"):
                try:
                    full_text = contents.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue

        elif fname.endswith(".csv"):
            import csv as _csv
            for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
                try:
                    text_data = contents.decode(enc)
                    break
                except UnicodeDecodeError:
                    text_data = contents.decode("latin-1", errors="replace")
            reader_csv = _csv.DictReader(io.StringIO(text_data))
            rows = [dict(r) for r in reader_csv]
            if rows:
                headers = list(rows[0].keys())
                lines = [" | ".join(str(v) if v is not None else "" for v in headers)]
                for i, row in enumerate(rows, start=1):
                    lines.append(f"Ligne {i}: " + " | ".join(f"{k}={v}" for k, v in row.items() if v not in (None, "")))
                full_text = "\n".join(lines)
                extra["rows"] = len(rows)
            else:
                full_text = text_data

        elif fname.endswith((".xlsx", ".xls")):
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
            ws = wb.active
            headers: list = []
            rows_text: list = []
            for i, row in enumerate(ws.iter_rows(values_only=True)):
                if i == 0:
                    headers = [str(c).strip() if c is not None else f"Col{j}" for j, c in enumerate(row)]
                else:
                    row_vals = {headers[j]: str(c).strip() if c is not None else "" for j, c in enumerate(row) if j < len(headers)}
                    non_empty = {k: v for k, v in row_vals.items() if v}
                    if non_empty:
                        rows_text.append(f"Ligne {i}: " + " | ".join(f"{k}={v}" for k, v in non_empty.items()))
            wb.close()
            header_line = " | ".join(headers)
            full_text = header_line + "\n" + "\n".join(rows_text)
            extra["rows"] = len(rows_text)

    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Bibliothèque manquante pour ce format : {exc}. Contactez l'administrateur."
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'extraction : {exc}"
        )

    return {
        "text": full_text[:8000],
        "filename": file.filename,
        "cv_tmp_path": cv_tmp_path,
        "cv_filename": safe_name,
        **extra,
    }
