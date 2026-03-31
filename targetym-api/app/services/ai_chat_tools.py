"""
Tools/Functions disponibles pour le chatbot AI
Permettent au chatbot d'accéder aux données réelles via function calling
"""
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.employee import Employee
from app.models.leave import LeaveBalance, LeaveRequest
from app.models.task import Task
from app.models.okr import Objective, KeyResult
from app.models.learning import Course, CourseAssignment
from app.models.performance import Evaluation
from app.models.recruitment import Candidate, JobPosting
from datetime import datetime, date
from sqlalchemy import func, and_


# ============================================
# DÉFINITION DES TOOLS (pour Claude)
# ============================================

EMPLOYEE_TOOLS = [
    {
        "name": "get_my_leave_balance",
        "description": "Récupère le solde de congés de l'employé connecté (jours restants, pris, totaux)",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "get_my_tasks",
        "description": "Récupère les tâches de l'employé (en cours, terminées, en retard)",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["pending", "in_progress", "completed", "all"],
                    "description": "Filtrer par statut (optionnel)"
                }
            }
        }
    },
    {
        "name": "get_my_okrs",
        "description": "Récupère les objectifs OKR de l'employé avec leur progression",
        "input_schema": {
            "type": "object",
            "properties": {
                "year": {
                    "type": "integer",
                    "description": "Année (optionnel, par défaut année en cours)"
                },
                "quarter": {
                    "type": "integer",
                    "description": "Trimestre 1-4 (optionnel)"
                }
            }
        }
    },
    {
        "name": "get_my_performance",
        "description": "Récupère l'évaluation de performance de l'employé (dernière évaluation, scores)",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "get_available_trainings",
        "description": "Liste les formations disponibles que l'employé peut suivre",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "Catégorie de formation (optionnel)"
                }
            }
        }
    },
    {
        "name": "get_my_enrollments",
        "description": "Récupère les formations auxquelles l'employé est inscrit",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
]

MANAGER_TOOLS = EMPLOYEE_TOOLS + [
    {
        "name": "get_team_stats",
        "description": "Récupère les statistiques de l'équipe du manager (présence, performance, congés)",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "get_pending_leave_requests",
        "description": "Liste les demandes de congés en attente d'approbation",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "get_team_performance",
        "description": "Récupère les performances de l'équipe",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "get_team_okrs",
        "description": "Récupère les OKR de l'équipe",
        "input_schema": {
            "type": "object",
            "properties": {
                "year": {
                    "type": "integer",
                    "description": "Année (optionnel)"
                }
            }
        }
    }
]

HR_TOOLS = MANAGER_TOOLS + [
    {
        "name": "get_company_stats",
        "description": "Récupère les statistiques RH globales (headcount, turnover, absences)",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "get_all_leave_requests",
        "description": "Liste toutes les demandes de congés (tous employés)",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["pending", "approved", "rejected", "all"],
                    "description": "Filtrer par statut"
                }
            }
        }
    },
    {
        "name": "search_employee",
        "description": "Recherche un employé par nom",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Nom ou prénom de l'employé"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "create_candidate",
        "description": "Crée un nouveau candidat dans le module Recrutement. Utiliser quand l'utilisateur demande d'ajouter ou créer un candidat.",
        "input_schema": {
            "type": "object",
            "properties": {
                "first_name": {"type": "string", "description": "Prénom du candidat"},
                "last_name": {"type": "string", "description": "Nom du candidat"},
                "email": {"type": "string", "description": "Email du candidat"},
                "phone": {"type": "string", "description": "Téléphone (optionnel)"},
                "current_position": {"type": "string", "description": "Poste actuel ou visé (optionnel)"},
                "source": {"type": "string", "description": "Source: LinkedIn, Indeed, Site Carrière, Référence interne, Référence externe, Chasseur de tête, Cabinet, Autre"},
                "notes": {"type": "string", "description": "Notes ou commentaires (optionnel)"}
            },
            "required": ["first_name", "last_name", "email"]
        }
    },
    {
        "name": "create_job_posting",
        "description": "Crée une nouvelle offre d'emploi (job posting) dans le module Recrutement. Utiliser quand l'utilisateur demande de générer ou créer une offre d'emploi.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Intitulé du poste"},
                "location": {"type": "string", "description": "Lieu (ville et pays)"},
                "contract_type": {"type": "string", "description": "Type de contrat: CDI, CDD, Stage, Freelance, Alternance"},
                "description": {"type": "string", "description": "Description du poste (optionnel)"},
                "remote_policy": {"type": "string", "description": "Politique télétravail: onsite, hybrid, remote"},
                "urgency": {"type": "string", "description": "Urgence: low, medium, high"}
            },
            "required": ["title", "location"]
        }
    }
]

ADMIN_TOOLS = HR_TOOLS  # Admin a accès à tout


# ============================================
# IMPLÉMENTATION DES FUNCTIONS
# ============================================

class ChatbotTools:
    """Classe pour exécuter les tools/functions du chatbot"""
    
    def __init__(self, db: Session, employee: Employee):
        self.db = db
        self.employee = employee
        self.tenant_id = employee.tenant_id
    
    # ============================================
    # EMPLOYEE TOOLS
    # ============================================
    
    def get_my_leave_balance(self) -> Dict[str, Any]:
        """Récupère le solde de congés de l'employé"""
        balance = self.db.query(LeaveBalance).filter(
            LeaveBalance.employee_id == self.employee.id,
            LeaveBalance.tenant_id == self.tenant_id
        ).first()
        
        if not balance:
            return {
                "message": "Aucun solde de congés trouvé",
                "total_days": 0,
                "used_days": 0,
                "remaining_days": 0
            }
        
        return {
            "total_days": float(balance.total_days or 0),
            "used_days": float(balance.used_days or 0),
            "remaining_days": float(balance.remaining_days or 0),
            "message": f"Vous avez {balance.remaining_days} jours de congés restants sur {balance.total_days} jours annuels."
        }
    
    def get_my_tasks(self, status: str = "all") -> Dict[str, Any]:
        """Récupère les tâches de l'employé"""
        query = self.db.query(Task).filter(
            Task.employee_id == self.employee.id,
            Task.tenant_id == self.tenant_id
        )
        
        if status != "all":
            query = query.filter(Task.status == status)
        
        tasks = query.order_by(Task.due_date).limit(20).all()
        
        result = {
            "total": len(tasks),
            "tasks": []
        }
        
        for task in tasks:
            result["tasks"].append({
                "id": task.id,
                "title": task.title,
                "status": task.status,
                "priority": task.priority,
                "due_date": task.due_date.isoformat() if task.due_date else None,
                "is_overdue": task.due_date < date.today() if task.due_date and task.status != "completed" else False
            })
        
        return result
    
    def get_my_okrs(self, year: int = None, quarter: int = None) -> Dict[str, Any]:
        """Récupère les OKR de l'employé"""
        if not year:
            year = datetime.now().year
        
        query = self.db.query(Objective).filter(
            Objective.owner_id == self.employee.id,
            Objective.tenant_id == self.tenant_id,
            Objective.period.like(f"%{year}%")
        )
        
        if quarter:
            query = query.filter(Objective.period.like(f"%Q{quarter}%"))
        
        objectives = query.all()
        
        result = {
            "year": year,
            "quarter": quarter,
            "total_objectives": len(objectives),
            "objectives": []
        }
        
        for obj in objectives:
            key_results = self.db.query(KeyResult).filter(
                KeyResult.objective_id == obj.id
            ).all()
            
            result["objectives"].append({
                "id": obj.id,
                "title": obj.title,
                "progress": float(obj.progress or 0),
                "status": obj.status,
                "key_results_count": len(key_results),
                "avg_kr_progress": sum(float(kr.progress or 0) for kr in key_results) / len(key_results) if key_results else 0
            })
        
        return result
    
    def get_my_performance(self) -> Dict[str, Any]:
        """Récupère l'évaluation de performance"""
        evaluation = self.db.query(Evaluation).filter(
            Evaluation.employee_id == self.employee.id,
            Evaluation.tenant_id == self.tenant_id,
            Evaluation.status.in_(['submitted', 'validated'])
        ).order_by(Evaluation.validated_at.desc()).first()
        
        if not evaluation:
            return {
                "message": "Aucune évaluation de performance enregistrée",
                "has_evaluation": False
            }
        
        review_date = evaluation.validated_at or evaluation.submitted_at or evaluation.created_at
        score_out_of_100 = float(evaluation.calibrated_score or evaluation.overall_score or 0) * 20  # Convert from /5 to /100
        
        return {
            "has_evaluation": True,
            "evaluation_date": review_date.isoformat() if review_date else None,
            "overall_score": float(evaluation.calibrated_score or evaluation.overall_score or 0),
            "score_out_of_5": float(evaluation.calibrated_score or evaluation.overall_score or 0),
            "status": evaluation.status,
            "type": evaluation.type,
            "strengths": evaluation.strengths,
            "improvements": evaluation.improvements,
            "message": f"Votre dernière évaluation date du {review_date.strftime('%d/%m/%Y') if review_date else 'N/A'} avec un score de {score_out_of_100:.0f}/100 ({evaluation.calibrated_score or evaluation.overall_score or 0}/5)"
        }
    
    def get_available_trainings(self, category: str = None) -> Dict[str, Any]:
        """Liste les formations disponibles"""
        query = self.db.query(Course).filter(
            Course.tenant_id == self.tenant_id,
            Course.is_active == 1
        )
        
        if category:
            query = query.filter(Course.category == category)
        
        courses = query.limit(20).all()
        
        return {
            "total": len(courses),
            "courses": [
                {
                    "id": c.id,
                    "title": c.title,
                    "category": c.category,
                    "duration_hours": c.duration_hours,
                    "description": c.description[:100] + "..." if c.description and len(c.description) > 100 else c.description
                }
                for c in courses
            ]
        }
    
    def get_my_enrollments(self) -> Dict[str, Any]:
        """Récupère les formations de l'employé"""
        assignments = self.db.query(CourseAssignment).filter(
            CourseAssignment.employee_id == self.employee.id,
            CourseAssignment.tenant_id == self.tenant_id
        ).all()
        
        return {
            "total": len(assignments),
            "enrollments": [
                {
                    "course_title": a.course.title if a.course else "N/A",
                    "status": a.status,
                    "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
                    "deadline": a.deadline.isoformat() if a.deadline else None,
                    "completed_at": a.completed_at.isoformat() if a.completed_at else None
                }
                for a in assignments
            ]
        }
    
    # ============================================
    # MANAGER TOOLS
    # ============================================
    
    def get_team_stats(self) -> Dict[str, Any]:
        """Stats de l'équipe du manager"""
        if not self.employee.is_manager:
            return {"error": "Vous n'êtes pas manager"}
        
        team = self.db.query(Employee).filter(
            Employee.manager_id == self.employee.id,
            Employee.tenant_id == self.tenant_id
        ).all()
        
        active = len([e for e in team if e.status == "active"])
        inactive = len(team) - active
        
        # Données pour graphique
        chart_data = [
            {"name": "Actifs", "valeur": active},
            {"name": "Inactifs", "valeur": inactive}
        ] if inactive > 0 else None
        
        return {
            "team_size": len(team),
            "active_employees": active,
            "inactive_employees": inactive,
            "message": f"Votre équipe compte {active} employés actifs sur {len(team)} total",
            "chart_data": chart_data,
            "chart_type": "bar" if chart_data else None
        }
    
    def get_pending_leave_requests(self) -> Dict[str, Any]:
        """Congés en attente d'approbation"""
        if not self.employee.is_manager:
            return {"error": "Vous n'êtes pas manager"}
        
        team_ids = [e.id for e in self.db.query(Employee).filter(
            Employee.manager_id == self.employee.id,
            Employee.tenant_id == self.tenant_id
        ).all()]
        
        requests = self.db.query(LeaveRequest).filter(
            LeaveRequest.employee_id.in_(team_ids),
            LeaveRequest.tenant_id == self.tenant_id,
            LeaveRequest.status == "pending"
        ).all()
        
        return {
            "total": len(requests),
            "requests": [
                {
                    "employee_name": f"{r.employee.first_name} {r.employee.last_name}" if r.employee else "N/A",
                    "leave_type": r.leave_type.name if r.leave_type else "N/A",
                    "start_date": r.start_date.isoformat() if r.start_date else None,
                    "end_date": r.end_date.isoformat() if r.end_date else None,
                    "days": float(r.days_requested or 0)
                }
                for r in requests[:10]
            ]
        }
    
    def get_team_performance(self) -> Dict[str, Any]:
        """Performance de l'équipe"""
        if not self.employee.is_manager:
            return {"error": "Vous n'êtes pas manager"}
        
        team_ids = [e.id for e in self.db.query(Employee).filter(
            Employee.manager_id == self.employee.id,
            Employee.tenant_id == self.tenant_id
        ).all()]
        
        reviews = self.db.query(Evaluation).filter(
            Evaluation.employee_id.in_(team_ids),
            Evaluation.tenant_id == self.tenant_id,
            Evaluation.status.in_(['submitted', 'validated'])
        ).all()
        
        if not reviews:
            return {"message": "Aucune évaluation disponible pour votre équipe"}
        
        avg_score = sum(float(r.calibrated_score or r.overall_score or 0) for r in reviews) / len(reviews)
        
        return {
            "team_size": len(team_ids),
            "evaluated_members": len(reviews),
            "average_score": round(avg_score, 2),
            "message": f"Score moyen de l'équipe : {round(avg_score, 2)}/5"
        }
    
    def get_team_okrs(self, year: int = None) -> Dict[str, Any]:
        """OKR de l'équipe"""
        if not self.employee.is_manager:
            return {"error": "Vous n'êtes pas manager"}
        
        if not year:
            year = datetime.now().year
        
        team_ids = [e.id for e in self.db.query(Employee).filter(
            Employee.manager_id == self.employee.id,
            Employee.tenant_id == self.tenant_id
        ).all()]
        
        objectives = self.db.query(Objective).filter(
            Objective.owner_id.in_(team_ids),
            Objective.tenant_id == self.tenant_id,
            Objective.period.like(f"%{year}%")
        ).all()
        
        return {
            "year": year,
            "total_objectives": len(objectives),
            "avg_progress": round(sum(float(o.progress or 0) for o in objectives) / len(objectives), 2) if objectives else 0
        }
    
    # ============================================
    # HR TOOLS
    # ============================================
    
    def get_company_stats(self) -> Dict[str, Any]:
        """Stats RH globales"""
        employee_role = self.employee.role.value if hasattr(self.employee.role, 'value') else str(self.employee.role)
        if employee_role not in ["rh", "hr", "admin", "dg"]:
            return {"error": "Accès réservé aux RH"}
        
        total = self.db.query(Employee).filter(
            Employee.tenant_id == self.tenant_id
        ).count()
        
        active = self.db.query(Employee).filter(
            Employee.tenant_id == self.tenant_id,
            Employee.status == "active"
        ).count()
        
        inactive = total - active
        
        # Données formatées pour graphique
        chart_data = [
            {"name": "Actifs", "valeur": active},
            {"name": "Inactifs", "valeur": inactive}
        ]
        
        return {
            "total_employees": total,
            "active_employees": active,
            "inactive_employees": inactive,
            "message": f"L'entreprise compte {active} employés actifs sur {total} total",
            "chart_data": chart_data,
            "chart_type": "bar"
        }
    
    def get_all_leave_requests(self, status: str = "all") -> Dict[str, Any]:
        """Toutes les demandes de congés"""
        employee_role = self.employee.role.value if hasattr(self.employee.role, 'value') else str(self.employee.role)
        if employee_role not in ["rh", "hr", "admin", "dg"]:
            return {"error": "Accès réservé aux RH"}
        
        query = self.db.query(LeaveRequest).filter(
            LeaveRequest.tenant_id == self.tenant_id
        )
        
        if status != "all":
            query = query.filter(LeaveRequest.status == status)
        
        requests = query.order_by(LeaveRequest.created_at.desc()).limit(50).all()
        
        # Stats par statut pour graphique
        from collections import Counter
        status_counts = Counter(r.status for r in requests)
        chart_data = [
            {"name": "En attente", "valeur": status_counts.get("pending", 0)},
            {"name": "Approuvées", "valeur": status_counts.get("approved", 0)},
            {"name": "Rejetées", "valeur": status_counts.get("rejected", 0)}
        ]
        
        return {
            "total": len(requests),
            "requests": [
                {
                    "employee_name": f"{r.employee.first_name} {r.employee.last_name}" if r.employee else "N/A",
                    "status": r.status,
                    "start_date": r.start_date.isoformat() if r.start_date else None,
                    "days": float(r.days_requested or 0)
                }
                for r in requests[:20]
            ],
            "chart_data": chart_data,
            "chart_type": "pie"
        }
    
    def search_employee(self, query: str) -> Dict[str, Any]:
        """Recherche un employé"""
        employee_role = self.employee.role.value if hasattr(self.employee.role, 'value') else str(self.employee.role)
        if employee_role not in ["rh", "hr", "admin", "dg"]:
            return {"error": "Accès réservé aux RH"}
        
        employees = self.db.query(Employee).filter(
            Employee.tenant_id == self.tenant_id,
            (Employee.first_name.ilike(f"%{query}%")) | (Employee.last_name.ilike(f"%{query}%"))
        ).limit(10).all()
        
        return {
            "total": len(employees),
            "employees": [
                {
                    "name": f"{e.first_name} {e.last_name}",
                    "job_title": e.job_title,
                    "department": e.department.name if e.department else "N/A",
                    "status": e.status
                }
                for e in employees
            ]
        }
    
    # ============================================
    # HR CREATION TOOLS
    # ============================================

    def create_candidate(
        self,
        first_name: str,
        last_name: str,
        email: str,
        phone: str = None,
        current_position: str = None,
        source: str = "Autre",
        notes: str = None
    ) -> Dict[str, Any]:
        """Crée un nouveau candidat dans le module Recrutement"""
        employee_role = self.employee.role.value if hasattr(self.employee.role, 'value') else str(self.employee.role)
        if employee_role not in ["rh", "hr", "admin", "dg"]:
            return {"error": "Accès réservé aux RH"}

        candidate = Candidate(
            tenant_id=self.tenant_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            current_position=current_position,
            source=source,
            notes=notes,
        )
        self.db.add(candidate)
        self.db.commit()
        self.db.refresh(candidate)

        return {
            "success": True,
            "candidate_id": candidate.id,
            "name": f"{first_name} {last_name}",
            "email": email,
            "message": f"Le candidat {first_name} {last_name} a été créé avec succès dans le module Recrutement."
        }

    def create_job_posting(
        self,
        title: str,
        location: str,
        contract_type: str = "CDI",
        description: str = None,
        remote_policy: str = "onsite",
        urgency: str = "medium"
    ) -> Dict[str, Any]:
        """Crée une nouvelle offre d'emploi"""
        employee_role = self.employee.role.value if hasattr(self.employee.role, 'value') else str(self.employee.role)
        if employee_role not in ["rh", "hr", "admin", "dg"]:
            return {"error": "Accès réservé aux RH"}

        job = JobPosting(
            tenant_id=self.tenant_id,
            title=title,
            location=location,
            contract_type=contract_type,
            description=description,
            remote_policy=remote_policy,
            urgency=urgency,
            status="draft",
            recruiter_id=self.employee.id,
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        return {
            "success": True,
            "job_id": job.id,
            "title": title,
            "location": location,
            "contract_type": contract_type,
            "status": "draft",
            "message": f"L'offre d'emploi '{title}' a été créée en statut brouillon. Tu peux la compléter et la publier dans Recrutement → Offres."
        }

    # ============================================
    # EXECUTION
    # ============================================
    
    def execute_tool(self, tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Exécute un tool et retourne le résultat"""
        method = getattr(self, tool_name, None)
        if not method:
            return {"error": f"Tool '{tool_name}' non trouvé"}
        
        try:
            return method(**tool_input)
        except Exception as e:
            return {"error": f"Erreur lors de l'exécution: {str(e)}"}


def get_tools_for_role(role: str) -> List[Dict[str, Any]]:
    """Retourne les tools disponibles pour un rôle"""
    role_tools = {
        "employee": EMPLOYEE_TOOLS,
        "manager": MANAGER_TOOLS,
        "rh": HR_TOOLS,        # Corrigé: "rh" au lieu de "hr" pour matcher l'enum
        "hr": HR_TOOLS,        # Gardé pour compatibilité
        "admin": ADMIN_TOOLS,
        "dg": ADMIN_TOOLS      # Direction générale = accès admin
    }
    return role_tools.get(role, EMPLOYEE_TOOLS)
