"""
Service AI Agent - Chat contextuel avec actions de création
Permet au chat IA de générer et insérer des données selon le contexte de page.

SÉCURITÉ : Seules des créations sont permises. Jamais de suppression ou
modification d'employés/données sensibles.
"""
from typing import List, Dict, Any, Optional
from anthropic import Anthropic
from app.core.config import settings
from app.models.employee import Employee
from app.models.user import User
import json


# ============================================
# TOOLS CLAUDE - GÉNÉRATION UNIQUEMENT
# Ces tools génèrent des données pour prévisualisation.
# L'insertion réelle se fait seulement après validation utilisateur.
# ============================================

AGENT_TOOLS = [
    {
        "name": "generate_onboarding_program",
        "description": (
            "Génère un programme d'onboarding structuré avec ses tâches. "
            "Utilise cet outil quand l'utilisateur demande de créer ou générer un programme d'onboarding. "
            "Les données générées seront présentées à l'utilisateur pour validation avant insertion."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Nom du programme (ex: 'Onboarding Développeur Backend')"},
                "description": {"type": "string", "description": "Description détaillée du programme"},
                "job_title": {"type": "string", "description": "Poste concerné"},
                "duration_days": {"type": "integer", "description": "Durée en jours (ex: 30, 60, 90)"},
                "tasks": {
                    "type": "array",
                    "description": "Liste des tâches du programme",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "Titre de la tâche"},
                            "description": {"type": "string", "description": "Description détaillée"},
                            "category": {
                                "type": "string",
                                "enum": ["administratif", "materiel", "formation", "rencontre", "documentation", "acces_it", "general"],
                                "description": "Catégorie de la tâche: administratif (papiers/accueil), materiel (équipements), formation (apprentissage), rencontre (réunions/présentations), documentation (guides/procédures), acces_it (systèmes/comptes), general (autre)"
                            },
                            "assigned_role": {
                                "type": "string",
                                "enum": ["hr", "manager", "it", "employee", "buddy"],
                                "description": "Qui doit effectuer cette tâche: hr (RH), manager (responsable), it (informatique), employee (nouvel employé), buddy (accompagnateur)"
                            },
                            "due_day": {"type": "integer", "description": "Jour limite depuis le début (ex: 1, 7, 30)"},
                            "is_required": {"type": "boolean", "description": "Tâche obligatoire ?"}
                        },
                        "required": ["title", "category", "due_day"]
                    }
                }
            },
            "required": ["name", "duration_days", "tasks"]
        }
    },
    {
        "name": "generate_okr_objectives",
        "description": (
            "Génère des objectifs OKR (Objectives and Key Results) structurés. "
            "Utilise cet outil quand l'utilisateur demande de créer ou générer des OKRs. "
            "Les données seront présentées pour validation avant insertion."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "objectives": {
                    "type": "array",
                    "description": "Liste des objectifs à créer",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "Titre de l'objectif (inspirant, orienté résultat)"},
                            "description": {"type": "string", "description": "Description de l'objectif"},
                            "quarter": {"type": "integer", "enum": [1, 2, 3, 4], "description": "Trimestre"},
                            "year": {"type": "integer", "description": "Année"},
                            "key_results": {
                                "type": "array",
                                "description": "Résultats clés mesurables",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "title": {"type": "string", "description": "Titre du KR (mesurable et spécifique)"},
                                        "target_value": {"type": "number", "description": "Valeur cible (ex: 100, 95, 10)"},
                                        "unit": {"type": "string", "description": "Unité de mesure (%, pts, jours, €, etc.)"}
                                    },
                                    "required": ["title", "target_value", "unit"]
                                }
                            }
                        },
                        "required": ["title", "quarter", "year", "key_results"]
                    }
                }
            },
            "required": ["objectives"]
        }
    },
    {
        "name": "generate_training_plan",
        "description": (
            "Génère un plan de formation/développement des compétences. "
            "Utilise cet outil quand l'utilisateur demande de créer un plan de formation ou de développement. "
            "Les données seront présentées pour validation avant insertion."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "plan_title": {"type": "string", "description": "Titre du plan de formation"},
                "target_profile": {"type": "string", "description": "Profil visé (ex: 'Manager débutant', 'Développeur senior')"},
                "duration_weeks": {"type": "integer", "description": "Durée totale en semaines"},
                "courses": {
                    "type": "array",
                    "description": "Formations à inclure dans le plan",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "Titre de la formation"},
                            "description": {"type": "string", "description": "Description et objectifs de la formation"},
                            "duration_hours": {"type": "integer", "description": "Durée en heures"},
                            "format": {
                                "type": "string",
                                "enum": ["e-learning", "presentiel", "blended", "coaching", "mentoring"],
                                "description": "Format de la formation"
                            },
                            "skills_covered": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Compétences développées"
                            },
                            "week_start": {"type": "integer", "description": "Semaine de début dans le plan"}
                        },
                        "required": ["title", "duration_hours", "format"]
                    }
                }
            },
            "required": ["plan_title", "courses"]
        }
    },
    {
        "name": "generate_candidate",
        "description": (
            "Enregistre un nouveau candidat dans le module Recrutement. "
            "Utilise cet outil quand l'utilisateur demande d'ajouter, créer ou enregistrer un candidat. "
            "Les données seront présentées pour validation avant insertion."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "first_name": {"type": "string", "description": "Prénom du candidat"},
                "last_name": {"type": "string", "description": "Nom de famille du candidat"},
                "email": {"type": "string", "description": "Adresse email professionnelle"},
                "phone": {"type": "string", "description": "Numéro de téléphone (optionnel)"},
                "current_position": {"type": "string", "description": "Poste actuel ou visé (optionnel)"},
                "source": {
                    "type": "string",
                    "enum": ["LinkedIn", "Indeed", "Site Carrière", "Référence interne", "Référence externe", "Chasseur de tête", "Cabinet", "Autre"],
                    "description": "Source de provenance du candidat"
                },
                "notes": {"type": "string", "description": "Notes ou commentaires (optionnel)"},
                "job_posting_id": {"type": "integer", "description": "ID de l'offre d'emploi à lier au candidat (optionnel, permet d'afficher le candidat dans le kanban)"}
            },
            "required": ["first_name", "last_name", "email"]
        }
    },
    {
        "name": "generate_job_posting",
        "description": (
            "Génère une offre d'emploi complète et professionnelle. "
            "Utilise cet outil quand l'utilisateur demande de rédiger une offre d'emploi ou fiche de poste. "
            "Les données seront présentées pour validation avant insertion."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Titre du poste (ex: 'Ingénieur DevOps Senior')"},
                "description": {"type": "string", "description": "Description du poste et du contexte"},
                "requirements": {"type": "string", "description": "Profil recherché, compétences requises"},
                "responsibilities": {"type": "string", "description": "Missions et responsabilités principales"},
                "contract_type": {
                    "type": "string",
                    "enum": ["CDI", "CDD", "Stage", "Alternance", "Freelance", "Consultant"],
                    "description": "Type de contrat"
                },
                "experience_years": {"type": "integer", "description": "Années d'expérience requises"},
                "location": {"type": "string", "description": "Lieu de travail"},
                "skills": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Liste des compétences clés requises"
                }
            },
            "required": ["title", "description", "requirements", "contract_type"]
        }
    },
    {
        "name": "create_department",
        "description": (
            "Crée une nouvelle unité organisationnelle (département, service, direction, etc.). "
            "Utilise cet outil quand l'utilisateur demande de créer une unité, un département, un service, "
            "une direction, une équipe ou toute autre structure organisationnelle. "
            "L'unité sera créée immédiatement après validation."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Nom de l'unité (ex: 'Direction Commerciale', 'Service RH')"},
                "level": {
                    "type": "string",
                    "enum": ["president", "vice_president", "dg", "dga", "direction_centrale", "direction", "departement", "service"],
                    "description": "Niveau hiérarchique: president, vice_president, dg, dga, direction_centrale, direction, departement (défaut), service"
                },
                "description": {"type": "string", "description": "Description de l'unité (optionnel)"},
                "code": {"type": "string", "description": "Code court de l'unité, ex: 'DIR-COM', 'SRH' (optionnel)"},
                "color": {"type": "string", "description": "Couleur hexadécimale, ex: '#3B82F6' (optionnel)"},
            },
            "required": ["name", "level"]
        }
    },
    {
        "name": "generate_employee",
        "description": (
            "Crée un employé dans l'annuaire RH (module Employés). "
            "Utilise cet outil quand l'utilisateur demande d'ajouter, créer ou enregistrer un employé. "
            "Si un document (PDF, Excel, CSV) est fourni, extrait les informations et pré-remplis les champs. "
            "Les données seront présentées à l'utilisateur pour validation avant insertion."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "first_name": {"type": "string", "description": "Prénom de l'employé"},
                "last_name": {"type": "string", "description": "Nom de famille de l'employé"},
                "email": {"type": "string", "description": "Email professionnel (obligatoire, pas Gmail/Yahoo)"},
                "phone": {"type": "string", "description": "Numéro de téléphone (optionnel)"},
                "gender": {
                    "type": "string",
                    "enum": ["male", "female"],
                    "description": "Genre : male ou female (optionnel)"
                },
                "job_title": {"type": "string", "description": "Intitulé du poste (ex: 'Développeur Backend', 'Responsable RH')"},
                "department_name": {"type": "string", "description": "Nom du département (ex: 'Direction Commerciale'). Sera résolu automatiquement."},
                "role": {
                    "type": "string",
                    "enum": ["employee", "manager", "rh", "admin", "dg", "dga", "drh"],
                    "description": "Rôle système : employee (défaut), manager, rh, admin, dg, dga, drh. Déduis du titre de poste."
                },
                "contract_type": {
                    "type": "string",
                    "enum": ["CDI", "CDD", "Stage", "Alternance", "Freelance"],
                    "description": "Type de contrat (défaut: CDI)"
                },
                "hire_date": {"type": "string", "description": "Date d'embauche au format YYYY-MM-DD (optionnel)"},
                "site": {"type": "string", "description": "Site ou lieu de travail (optionnel)"},
                "nationality": {"type": "string", "description": "Nationalité (optionnel)"},
                "is_manager": {"type": "boolean", "description": "Est-il responsable d'une équipe ? (défaut: false)"}
            },
            "required": ["first_name", "last_name", "email"]
        }
    }
]

# Rôles autorisés pour le mode agentique
ROLES_ALLOWED_AGENT = ["rh", "admin", "dg", "manager"]

# Contextes de page (gardé pour la compatibilité mais les tools sont maintenant
# disponibles sur toutes les pages pour les rôles autorisés)
PAGE_CONTEXT_MAP = {
    "/dashboard/onboarding": {"label": "Onboarding"},
    "/dashboard/performance/objectives": {"label": "OKR"},
    "/dashboard/learning": {"label": "Formation"},
    "/dashboard/recruitment": {"label": "Recrutement"},
    "/dashboard/employees": {"label": "Employés / Organisation"},
}
class AIAgentService:
    """Service pour le chat agentique avec prévisualisation avant action."""

    def __init__(self):
        self.client = None
        if settings.ANTHROPIC_API_KEY:
            self.client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = settings.ANTHROPIC_MODEL

    def is_enabled(self) -> bool:
        return settings.AI_CHAT_ENABLED and self.client is not None

    def get_tools_for_context(self, page_path: str, role: str = "") -> List[Dict]:
        """Retourne TOUS les tools disponibles pour le rôle (pas de restriction par page)."""
        if role not in ROLES_ALLOWED_AGENT:
            return []
        return list(AGENT_TOOLS)

    def _is_page_role_forbidden(self, page_path: str, role: str) -> bool:
        """Toujours False — on ne bloque plus par page."""
        return False

    def get_context_label(self, page_path: str) -> str:
        for path_prefix, ctx in PAGE_CONTEXT_MAP.items():
            if page_path.startswith(path_prefix):
                return ctx["label"]
        return "Général"

    def build_agent_system_prompt(
        self, employee: Employee, page_path: str, file_text: Optional[str] = None, extra_context: Optional[str] = None
    ) -> str:
        role = employee.role.value if hasattr(employee.role, "value") else str(employee.role)
        context_label = self.get_context_label(page_path)

        prompt = f"""Tu es l'assistant IA agentique de Targetym, une plateforme de gestion RH.
Tu aides {employee.first_name} {employee.last_name} ({role.upper()}) à gérer la plateforme RH.

CONTEXTE DE PAGE : {context_label} ({page_path})

TES CAPACITÉS (disponibles depuis n'importe quelle page) :
- Créer des UNITÉS ORGANISATIONNELLES : départements, services, directions (create_department)
- Créer des PROGRAMMES D'ONBOARDING avec leurs tâches (generate_onboarding_program)
- Créer des OBJECTIFS OKR avec key results (generate_okr_objectives)
- Créer des PLANS DE FORMATION (generate_training_plan)
- Créer des CANDIDATS dans le module recrutement (generate_candidate)
- Créer des OFFRES D'EMPLOI (generate_job_posting)
- Créer des EMPLOYÉS dans l'annuaire RH (generate_employee)
- Répondre aux questions RH, analyses, conseils et explications

RÈGLE FONDAMENTALE : Si l'utilisateur te demande de créer quelque chose, utilise IMMÉDIATEMENT l'outil correspondant sans jamais dire que tu ne peux pas faire l'action ou qu'il faut aller sur une autre page. TU PEUX TOUT FAIRE DEPUIS N'IMPORTE QUELLE PAGE.

CRÉATION D'UNITÉ ORGANISATIONNELLE (create_department) :
- Détermine le level approprié : service (équipe opérationnelle), departement (département standard), direction (direction métier), dg (direction générale), etc.
- Si l'utilisateur ne précise pas le level, utilise "departement" par défaut
- Génère un code court pertinent (ex: "DEV" pour Développement, "COM" pour Commercial)
- Génère une couleur hexadécimale cohérente si possible

CRÉATION DE CANDIDAT (generate_candidate) :
- Si des OFFRES D'EMPLOI DISPONIBLES sont listées ci-dessous, inclure TOUJOURS le champ job_posting_id avec l'ID de l'offre la plus pertinente
- Si l'utilisateur mentionne un poste spécifique, choisir l'offre dont le titre correspond le mieux
- Si aucune offre n'est disponible, créer quand même le candidat sans job_posting_id

CRÉATION D'EMPLOYÉ (generate_employee) :
- Champs requis : prénom, nom, email professionnel (pas Gmail/Yahoo/Hotmail)
- Si l'email est absent du document : génère un email temporaire au format prenom.nom@entreprise.sn
- department_name : utilise le nom exact du département si fourni dans le document ou par l'utilisateur
- Déduis le rôle du titre de poste : DG/CEO → "dg", DRH → "drh", RH/Responsable RH → "rh", Manager/Directeur/Chef → "manager", sinon "employee"
- Si l'utilisateur fournit un fichier Excel/CSV avec PLUSIEURS employés, crée-les UN PAR UN en démarrant par le premier

GESTION DES DOCUMENTS PDF / EXCEL / CSV :
- Si un document est fourni dans la section DOCUMENT FOURNI ci-dessous, exploite-le ENTIÈREMENT pour pré-remplir les champs
- Pour un fichier Excel/CSV avec plusieurs lignes = plusieurs employés : commence par le premier et propose de continuer
- JAMAIS dire « je ne peux pas lire les pièces jointes » — le système gère l'extraction, pas toi

RÈGLES STRICTES :
- Tu ne peux PAS supprimer des données
- Tu ne peux PAS modifier des EMPLOYÉS existants (mais tu PEUX créer de nouveaux employés, candidats, offres et unités)
- Tu ne peux PAS accéder aux données financières (salaires, etc.)
- JAMAIS refuser de créer : utilise l'outil correspondant immédiatement

COMPORTEMENT :
- Si un outil correspond au besoin, utilise-le IMMÉDIATEMENT sans demander confirmation
- Génère du contenu professionnel adapté au contexte africain (entreprises sénégalaises, ivoiriennes, etc.)
- Si des infos manquent (ex: email), génère une valeur temporaire réaliste
"""

        if extra_context:
            prompt += f"""
{extra_context}
"""

        if file_text:
            prompt += f"""
DOCUMENT FOURNI PAR L'UTILISATEUR :
---
{file_text[:3000]}
---
Utilise ce document comme contexte pour personnaliser ta génération.
"""
        return prompt

    def send_agent_message(
        self,
        message: str,
        page_path: str,
        employee: Employee,
        conversation_history: Optional[List[Dict]] = None,
        file_text: Optional[str] = None,
        extra_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Envoie un message au chat agentique.
        Retourne: {reply, action_preview} où action_preview est None ou
        {type, data, display_label} à valider par l'utilisateur.
        """
        if not self.is_enabled():
            return {
                "reply": "Le chat IA n'est pas disponible.",
                "action_preview": None
            }

        # Vérifier le rôle
        role = employee.role.value if hasattr(employee.role, "value") else str(employee.role)
        if role not in ROLES_ALLOWED_AGENT:
            return {
                "reply": "Le mode agentique est réservé aux gestionnaires RH, managers et administrateurs.",
                "action_preview": None
            }

        tools = self.get_tools_for_context(page_path, role)

        # Si rôle non autorisé → refus
        if not tools and role not in ROLES_ALLOWED_AGENT:
            return {
                "reply": "Le mode agentique est réservé aux gestionnaires RH, managers et administrateurs.",
                "action_preview": None
            }
        # Continuer même si tools=[] (mode assistant textuel)
        system_prompt = self.build_agent_system_prompt(employee, page_path, file_text, extra_context)

        # Construire l'historique
        messages = []
        if conversation_history:
            for msg in conversation_history:
                if isinstance(msg, dict) and msg.get("role") in ["user", "assistant"] and msg.get("content"):
                    messages.append({"role": msg["role"], "content": str(msg["content"])})

        messages.append({"role": "user", "content": message})

        try:
            create_kwargs: Dict[str, Any] = {
                "model": self.model,
                "max_tokens": 4096,
                "system": system_prompt,
                "messages": messages,
            }
            if tools:  # N'envoyer tools que si des outils sont disponibles
                create_kwargs["tools"] = tools
            response = self.client.messages.create(**create_kwargs)

            # Cas 1 : Claude utilise un tool → action preview
            if response.stop_reason == "tool_use":
                for block in response.content:
                    if block.type == "tool_use":
                        tool_input = block.input
                        if hasattr(tool_input, "model_dump"):
                            tool_input = tool_input.model_dump()
                        elif hasattr(tool_input, "dict"):
                            tool_input = tool_input.dict()

                        # Texte d'intro de Claude (avant le tool_use)
                        intro_text = ""
                        for b in response.content:
                            if b.type == "text":
                                intro_text = b.text
                                break

                        return {
                            "reply": intro_text or "J'ai généré le contenu suivant. Vérifiez-le et validez pour l'insérer.",
                            "action_preview": {
                                "tool_name": block.name,
                                "data": tool_input,
                                "display_label": self._get_action_label(block.name),
                            }
                        }

            # Cas 2 : Réponse textuelle simple
            text = ""
            for block in response.content:
                if block.type == "text":
                    text += block.text

            return {"reply": text, "action_preview": None}

        except Exception as e:
            return {
                "reply": f"Erreur lors de la génération : {str(e)}",
                "action_preview": None
            }

    def _get_action_label(self, tool_name: str) -> str:
        labels = {
            "generate_onboarding_program": "Programme d'onboarding",
            "generate_okr_objectives": "Objectifs OKR",
            "generate_training_plan": "Plan de formation",
            "generate_candidate": "Nouveau candidat",
            "generate_job_posting": "Offre d'emploi",
            "create_department": "Unité organisationnelle",
        }
        return labels.get(tool_name, "Contenu généré")


ai_agent_service = AIAgentService()
