"""
Service de chatbot AI utilisant Claude d'Anthropic
Gère les conversations, permissions par rôle, et escalade humaine
"""
from typing import List, Dict, Any, Optional
from anthropic import Anthropic, APIError, RateLimitError, APIConnectionError
from app.core.config import settings
from app.models.employee import Employee
from app.services.ai_chat_tools import ChatbotTools, get_tools_for_role
from sqlalchemy.orm import Session
import json
import time


class AIChatService:
    """Service principal pour gérer les interactions avec Claude AI"""
    
    def __init__(self):
        self.client = None
        if settings.ANTHROPIC_API_KEY:
            self.client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = settings.ANTHROPIC_MODEL
    
    def is_enabled(self) -> bool:
        """Vérifie si le chatbot est activé et configuré"""
        return settings.AI_CHAT_ENABLED and self.client is not None
    
    def _call_claude_with_retry(self, **kwargs) -> Any:
        """
        Appelle l'API Claude avec retry automatique en cas d'erreur temporaire
        Utilise un backoff exponentiel pour les erreurs 529 (Overloaded) et rate limits
        """
        max_retries = 3
        base_delay = 1  # seconde
        
        for attempt in range(max_retries):
            try:
                return self.client.messages.create(**kwargs)
            
            except APIError as e:
                error_type = getattr(e, 'type', None)
                status_code = getattr(e, 'status_code', None)
                
                # Erreurs temporaires qui méritent un retry
                should_retry = (
                    status_code in [429, 529] or  # Rate limit ou Overloaded
                    error_type in ['overloaded_error', 'rate_limit_error']
                )
                
                if should_retry and attempt < max_retries - 1:
                    # Backoff exponentiel: 1s, 2s, 4s
                    delay = base_delay * (2 ** attempt)
                    print(f"🔄 API temporairement indisponible (tentative {attempt + 1}/{max_retries}), retry dans {delay}s...")
                    time.sleep(delay)
                    continue
                else:
                    # Dernière tentative ou erreur non temporaire - propager l'exception
                    raise e
            
            except Exception as e:
                # Autres erreurs non gérées - propager l'exception
                raise e
        
        # Ne devrait jamais arriver ici
        raise RuntimeError("Max retries atteint sans succès")
    
    # ============================================
    # PERMISSIONS & RESTRICTIONS PAR RÔLE
    # ============================================
    
    def get_role_permissions(self, role: str) -> Dict[str, Any]:
        """Retourne les permissions et restrictions pour chaque rôle"""
        
        permissions_map = {
            "employee": {
                "can_access": [
                    "own_leave_balance", "own_tasks", "own_okrs", "own_documents",
                    "own_performance", "available_trainings", "hr_policies",
                    "own_team_info", "navigation_help"
                ],
                "cannot_access": [
                    "other_employees_data", "salary_info", "global_stats",
                    "recruitment_data", "system_config"
                ],
                "description": "Employé standard - accès limité à ses propres données"
            },
            "manager": {
                "can_access": [
                    "own_leave_balance", "own_tasks", "own_okrs", "own_documents",
                    "own_performance", "available_trainings", "hr_policies",
                    "team_stats", "team_performance", "team_absences",
                    "pending_approvals", "team_okrs", "navigation_help"
                ],
                "cannot_access": [
                    "other_departments_data", "salary_info", "global_stats",
                    "recruitment_data", "system_config"
                ],
                "description": "Manager - accès à ses données + équipe"
            },
            "rh": {
                "can_access": [
                    "all_employee_data", "global_hr_stats", "recruitment_pipeline",
                    "all_leaves", "all_performance", "all_trainings",
                    "hr_reports", "talent_management", "onboarding",
                    "navigation_help"
                ],
                "cannot_access": [
                    "system_config", "financial_details"
                ],
                "description": "RH - accès étendu à toutes les données RH"
            },
            "hr": {  # Alias pour compatibilité
                "can_access": [
                    "all_employee_data", "global_hr_stats", "recruitment_pipeline",
                    "all_leaves", "all_performance", "all_trainings",
                    "hr_reports", "talent_management", "onboarding",
                    "navigation_help"
                ],
                "cannot_access": [
                    "system_config", "financial_details"
                ],
                "description": "RH - accès étendu à toutes les données RH"
            },
            "admin": {
                "can_access": [
                    "everything", "system_config", "all_data", "logs",
                    "user_management", "analytics"
                ],
                "cannot_access": [],
                "description": "Admin - accès complet au système"
            },
            "dg": {  # Direction Générale = accès admin
                "can_access": [
                    "everything", "system_config", "all_data", "logs",
                    "user_management", "analytics"
                ],
                "cannot_access": [],
                "description": "Direction Générale - accès complet au système"
            }
        }
        
        return permissions_map.get(role, permissions_map["employee"])
    
    # ============================================
    # ESCALADE HUMAINE
    # ============================================
    
    HUMAN_ESCALATION_KEYWORDS = {
        "salary": ["salaire", "paie", "augmentation", "rémunération", "bonus", "prime"],
        "legal": ["juridique", "avocat", "procès", "litige", "tribunal"],
        "conflicts": ["conflit", "harcèlement", "discrimination", "agression", "plainte"],
        "contracts": ["contrat", "modification contrat", "rupture", "résiliation"],
        "sensitive_hr": ["licenciement", "démission", "rupture conventionnelle", "préavis"],
        "complaints": ["réclamation", "plainte officielle", "signalement"]
    }
    
    def needs_human_escalation(self, message: str) -> Optional[Dict[str, str]]:
        """Détecte si la question nécessite une intervention humaine"""
        message_lower = message.lower()
        
        for category, keywords in self.HUMAN_ESCALATION_KEYWORDS.items():
            if any(keyword in message_lower for keyword in keywords):
                return {
                    "category": category,
                    "reason": f"Question sensible détectée ({category})",
                    "contact_email": settings.SUPPORT_EMAIL,
                    "contact_whatsapp": settings.SUPPORT_WHATSAPP,
                    "message": self._get_escalation_message(category)
                }
        
        return None
    
    def _get_escalation_message(self, category: str) -> str:
        """Génère un message d'escalade personnalisé"""
        messages = {
            "salary": "Les questions de rémunération nécessitent un entretien avec les RH.",
            "legal": "Les questions juridiques doivent être traitées par notre service juridique.",
            "conflicts": "Cette situation sensible nécessite l'intervention d'un responsable RH.",
            "contracts": "Les modifications contractuelles doivent être discutées avec les RH.",
            "sensitive_hr": "Cette démarche importante nécessite un accompagnement RH personnalisé.",
            "complaints": "Votre réclamation sera mieux traitée par notre service RH."
        }
        return messages.get(category, "Cette question nécessite l'intervention d'un expert RH.")
    
    # ============================================
    # SYSTEM PROMPTS PAR RÔLE
    # ============================================
    
    def build_system_prompt(self, employee: Employee) -> str:
        """Construit le system prompt personnalisé pour l'employé"""
        
        employee_role = employee.role.value if hasattr(employee.role, 'value') else str(employee.role)
        is_power_user = employee_role in ["rh", "hr", "admin", "dg"]
        
        if is_power_user:
            actions_block = """TES CAPACITÉS ET OUTILS DISPONIBLES:
Tu as un accès COMPLET aux données RH et tu PEUX exécuter les actions suivantes via tes outils:
- Lire les statistiques RH globales (get_company_stats)
- Chercher des employés (search_employee)
- Voir toutes les demandes de congés (get_all_leave_requests)
- ✅ CRÉER un candidat dans le module Recrutement (create_candidate)
- ✅ CRÉER une offre d'emploi dans le module Recrutement (create_job_posting)

RÈGLE ABSOLUE: Quand l'utilisateur demande de créer un candidat ou une offre d'emploi,
tu DOIS appeler l'outil correspondant IMMÉDIATEMENT, sans refus, sans demander de confirmation,
sans expliquer pourquoi tu « ne peux pas ».
Si des informations manquent (ex: email), génère une valeur temporaire réaliste (ex: candidat.test@targetym.ai).
Ne dis JAMAIS: « je ne peux pas créer », « hors de mes capacités », « doit être fait manuellement »."""
        else:
            permissions = self.get_role_permissions(employee_role)
            actions_block = f"""PERMISSIONS ({permissions['description']}):
PEUT ACCÉDER À:
{chr(10).join('- ' + item for item in permissions['can_access'])}

NE PEUT PAS ACCÉDER À (redirige vers les RH si demandé):
{chr(10).join('- ' + item for item in permissions['cannot_access'])}"""

        prompt = f"""Tu es l'assistant IA de Targetym, une plateforme de gestion RH.
Tu aides {employee.first_name} {employee.last_name}, qui a le rôle: {employee_role.upper()}.

INFORMATIONS UTILISATEUR:
- Nom: {employee.first_name} {employee.last_name}
- Rôle: {employee_role}
- Département: {employee.department.name if employee.department else "Non assigné"}
- Poste: {employee.job_title or "Non spécifié"}

{actions_block}

INSTRUCTIONS:
1. Réponds UNIQUEMENT en français
2. Sois concis, professionnel et amical
3. Utilise les outils disponibles pour toutes les données et actions
4. Pour les questions sensibles (salaire, conflits, juridique), redirige vers:
   📧 Email: {settings.SUPPORT_EMAIL}  💬 WhatsApp: {settings.SUPPORT_WHATSAPP}
5. CONFIRMATION APRÈS ACTION: Après chaque création/modification, envoie TOUJOURS:
   ✅ **[Ce qui a été fait]** — ex: "✅ **Candidat Jean Dupont créé** dans Recrutement."
   Puis: "Tu peux le retrouver dans **Recrutement → Candidats**."

STYLE: Utilise le markdown (gras, listes, tableaux). Pour les stats, génère des graphiques:
```chart-bar\n[{{"name": "Label", "valeur": N}}]\n```"""  # noqa
        
        return prompt

    # ============================================
    # GÉNÉRATION DE RÉPONSES
    # ============================================

    # Mots-clés qui déclenchent un appel d'outil obligatoire
    CREATION_KEYWORDS = [
        "créer", "crée", "ajouter", "ajoute", "générer", "génère", "nouveau", "nouvelle",
        "create", "add", "generate", "new", "enregistrer", "enregistre", "insérer", "insère"
    ]
    CREATION_TARGETS = [
        "candidat", "candidate", "offre", "emploi", "poste", "job", "recrutement",
        "candidature", "application"
    ]

    def _requires_tool_call(self, message: str) -> bool:
        """Détecte si le message nécessite obligatoirement un appel d'outil"""
        msg_lower = message.lower()
        has_creation = any(kw in msg_lower for kw in self.CREATION_KEYWORDS)
        has_target = any(t in msg_lower for t in self.CREATION_TARGETS)
        return has_creation and has_target

    async def generate_response(
        self,
        message: str,
        employee: Employee,
        conversation_history: List[Dict[str, str]] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Génère une réponse avec Claude utilisant function calling
        
        Args:
            message: Message de l'utilisateur
            employee: Employé qui pose la question
            conversation_history: Historique de la conversation
            db: Session de base de données pour les tools
            
        Returns:
            Dict avec la réponse et métadonnées
        """
        
        if not self.is_enabled():
            return {
                "error": "Le chatbot n'est pas configuré",
                "message": "Veuillez contacter l'administrateur pour activer le chatbot."
            }
        
        # Vérifier si escalade humaine nécessaire
        escalation = self.needs_human_escalation(message)
        if escalation:
            return {
                "needs_human": True,
                "escalation": escalation
            }
        
        # Construire l'historique
        messages = conversation_history or []
        
        # Valider que tous les messages ont le bon format
        validated_messages = []
        for msg in messages:
            if isinstance(msg, dict) and "role" in msg and "content" in msg:
                # S'assurer que role et content sont des strings valides
                if msg["role"] in ["user", "assistant"] and msg["content"]:
                    validated_messages.append({
                        "role": msg["role"],
                        "content": str(msg["content"]).strip()
                    })
        
        # Ajouter le nouveau message utilisateur
        validated_messages.append({
            "role": "user",
            "content": str(message).strip()
        })
        
        print(f"📝 Messages validés: {len(validated_messages)} messages")
        
        # System prompt
        system_prompt = self.build_system_prompt(employee)
        
        # Récupérer les tools disponibles pour le rôle (extraire la valeur de l'enum)
        employee_role = employee.role.value if hasattr(employee.role, 'value') else str(employee.role)
        tools = get_tools_for_role(employee_role)
        print(f"👤 Employé: {employee.first_name} {employee.last_name} | Rôle: '{employee_role}' | Outils disponibles: {len(tools)}")
        if len(tools) > 0:
            print(f"📋 Liste des outils: {', '.join([t['name'] for t in tools[:5]])}{'...' if len(tools) > 5 else ''}")

        # Détecter si une action de création est demandée → forcer l'appel d'outil
        force_tool = self._requires_tool_call(message) and tools
        
        # Initialiser le gestionnaire de tools si DB fournie
        tools_handler = ChatbotTools(db, employee) if db else None
        
        try:
            # Boucle pour gérer le function calling (max 5 tours)
            max_iterations = 5
            total_tokens = 0
            
            for iteration in range(max_iterations):
                # Appel à Claude avec tools et retry automatique
                print(f"🤖 Appel à Claude API (tokens utilisés: {total_tokens})...")
                # Forcer l'appel d'outil si action de création détectée (premier tour uniquement)
                call_kwargs: Dict[str, Any] = dict(
                    model=self.model,
                    max_tokens=4096,
                    system=system_prompt,
                    messages=validated_messages,
                    tools=tools if tools_handler else None
                )
                if force_tool and iteration == 0 and tools_handler:
                    call_kwargs["tool_choice"] = {"type": "any"}
                    print("⚡ tool_choice=any forcé (création détectée)")
                response = self._call_claude_with_retry(**call_kwargs)
                
                total_tokens += response.usage.input_tokens + response.usage.output_tokens
                print(f"✅ Claude a répondu (stop_reason: {response.stop_reason}, tokens: {total_tokens})")
                
                # Si pas de tool_use, on a la réponse finale
                if response.stop_reason != "tool_use":
                    # Extraire le texte de la réponse
                    text_content = ""
                    for block in response.content:
                        if block.type == "text":
                            text_content += block.text
                    
                    return {
                        "message": text_content,
                        "tokens_used": total_tokens,
                        "stop_reason": response.stop_reason
                    }
                
                # Gérer les tool calls
                if not tools_handler:
                    return {
                        "message": "Je ne peux pas accéder aux données pour le moment.",
                        "tokens_used": total_tokens
                    }
                
                # Convertir response.content (objets Pydantic) en dicts propres
                assistant_content = []
                for block in response.content:
                    if block.type == "text":
                        assistant_content.append({
                            "type": "text",
                            "text": block.text
                        })
                    elif block.type == "tool_use":
                        # Convertir block.input en dict si nécessaire (peut être Pydantic)
                        tool_input_dict = block.input
                        if hasattr(block.input, 'model_dump'):
                            tool_input_dict = block.input.model_dump()
                        elif hasattr(block.input, 'dict'):
                            tool_input_dict = block.input.dict()
                        
                        assistant_content.append({
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": tool_input_dict
                        })
                
                # Ajouter la réponse de l'assistant aux validated_messages
                validated_messages.append({
                    "role": "assistant",
                    "content": assistant_content
                })
                
                # Exécuter les tools et préparer les résultats
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        tool_name = block.name
                        tool_input = block.input
                        
                        print(f"🔧 Exécution du tool: {tool_name} avec input: {tool_input}")
                        
                        # Exécuter le tool
                        result = tools_handler.execute_tool(tool_name, tool_input)
                        
                        print(f"📊 Résultat du tool {tool_name}: {str(result)[:200]}...")
                        
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result, ensure_ascii=False, default=str)
                        })
                
                # Ajouter les résultats des tools aux validated_messages
                validated_messages.append({
                    "role": "user",
                    "content": tool_results
                })
            
            # Si on atteint max_iterations, retourner une erreur
            return {
                "message": "Désolé, je n'ai pas pu traiter votre demande. Veuillez reformuler.",
                "tokens_used": total_tokens
            }
            
        except APIError as e:
            import traceback
            print(f"❌ Erreur API Claude: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            
            # Messages d'erreur user-friendly selon le type
            error_type = getattr(e, 'type', None)
            status_code = getattr(e, 'status_code', None)
            
            if status_code == 529 or error_type == 'overloaded_error':
                user_message = "🔄 Le service AI est temporairement surchargé. Veuillez réessayer dans quelques instants."
            elif status_code == 429 or error_type == 'rate_limit_error':
                user_message = "⏱️ Limite de requêtes atteinte. Veuillez patienter quelques secondes avant de réessayer."
            elif status_code == 401 or error_type == 'authentication_error':
                user_message = "🔐 Erreur d'authentification. Veuillez contacter l'administrateur."
            elif status_code == 400 or error_type == 'invalid_request_error':
                user_message = "⚠️ Requête invalide. Veuillez reformuler votre question."
            else:
                user_message = "❌ Une erreur s'est produite avec le service AI. Veuillez réessayer."
            
            return {
                "error": str(e),
                "message": user_message
            }
            
        except Exception as e:
            import traceback
            print(f"❌ Erreur inattendue AI chatbot: {str(e)}")
            print(f"Traceback complet: {traceback.format_exc()}")
            print(f"Client configured: {self.client is not None}")
            print(f"API Key configured: {settings.ANTHROPIC_API_KEY is not None}")
            print(f"Employee role: {employee.role if employee else 'N/A'}")
            print(f"Employee ID: {employee.id if employee else 'N/A'}")
            return {
                "error": str(e),
                "message": "❌ Une erreur inattendue s'est produite. Veuillez réessayer ou contacter le support."
            }
    
    # ============================================
    # GÉNÉRATION DE TITRE DE CONVERSATION
    # ============================================
    
    async def generate_conversation_title(self, first_message: str) -> str:
        """Génère un titre court pour la conversation basé sur le premier message"""
        
        if not self.is_enabled():
            return "Nouvelle conversation"
        
        try:
            response = self._call_claude_with_retry(
                model=self.model,
                max_tokens=50,
                system="Tu génères des titres courts (max 6 mots) pour des conversations. Réponds UNIQUEMENT avec le titre, sans ponctuation finale.",
                messages=[{
                    "role": "user",
                    "content": f"Génère un titre court pour cette question: {first_message}"
                }]
            )
            
            title = response.content[0].text.strip()
            # Limiter la longueur
            return title[:100] if len(title) > 100 else title
            
        except Exception:
            # Fallback: utiliser les premiers mots du message
            words = first_message.split()[:6]
            return " ".join(words) + ("..." if len(first_message.split()) > 6 else "")


# Instance globale du service
ai_chat_service = AIChatService()
