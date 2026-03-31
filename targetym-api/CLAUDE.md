# CLAUDE.md — Targetym AI

## Schéma de données

Le schéma principal est défini dans `targetym-api/app/models/` — modèles clés :

- @targetym-api/app/models/employee.py
- @targetym-api/app/models/user.py
- @targetym-api/app/models/tenant.py
- @targetym-api/app/models/leave.py

## Configuration principale

- @targetym-api/app/core/config.py
- @targetym-api/app/main.py (routes enregistrées)

## Règles critiques

- **Isolation tenant** : toute query DOIT filtrer par `tenant_id`
- **Enum casing** : `EmployeeStatus.ACTIVE`, `UserRole.RH` (majuscules)
- **Routes FastAPI** : statiques avant paramétrisées
- **CORS** : jamais `allow_origins=["*"]` avec `credentials=True`
- **Migrations Alembic** : ne pas exécuter au démarrage — appliquer manuellement via CloudShell RDS

## Zones sensibles (ne pas modifier sans précaution)

- @targetym-api/app/api/auth.py — authentification et création tenant
- @targetym-api/app/core/tenant_admin.py — création admin tenant
- @targetym-api/app/api/recruitment.py — isolation tenant critique
- @targetym-api/app/models/training_plans.py — plan annuel avec héritage groupe via parent_plan_id
- @targetym-api/app/models/training_plan_actions.py — actions/formations du plan (is_mandatory = héritage groupe)
- @targetym-api/app/models/training_schedule.py — calendrier sessions T1-T4
- @targetym-api/app/models/training_needs.py — besoins agrégés depuis OKR, Performance, Obligatoire
- @targetym-api/app/models/training_assignments.py — participants assignés par session

## Bugs déjà corrigés (ne pas réintroduire)

- `EmployeeStatus.active` → doit être `EmployeeStatus.ACTIVE`
- `UserRole` en minuscules dans SQL brut → utiliser SQLAlchemy ORM
- `total_candidates` filtrait `Candidate` au lieu de `CandidateApplication`
- `initialize-all` doit être avant `initialize/{employee_id}` dans les routes
- `attitude.icon` était `VARCHAR(10)` → migration 026 l'a étendu à `VARCHAR(50)` (contournement : utiliser `FileText`/`Shield`)
- `getAuthHeaders` manquait dans l'import de `paths/page.tsx` → toujours importer depuis `../shared`
- Onglet "Employés Éligibles" (promotions) n'affichait personne si un filtre de statut de demande était actif → `filterStatus` ne doit pas filtrer les `employeeCareers` (fix 2026-03-26)
- `GET /api/training-plans/analytics` retournait 404 côté frontend → `API_URL` dans `shared.ts` n'inclut PAS `/api`; toujours utiliser `${API_URL}/api/...`
- `responsibilities.map is not a function` dans Offres Internes (Mon Espace) → les champs `responsibilities`, `requirements`, `nice_to_have`, `benefits` peuvent arriver comme chaînes JSON depuis l'API ; toujours utiliser `parseArrayField()` avant `.map()`
- `/api/leaves/balances/{employee_id}` retournait 500 au démarrage → `accrual_start_month` manquait en DB ; ajouté dans `start.sh` via SQL d'urgence + migration 028
- `notification_preferences` table manquante (pas de migration) → `GET/PUT /api/notifications/preferences` retournait 500 → table créée dans `start.sh` via `CREATE TABLE IF NOT EXISTS` au boot
- `leaves.py` ne créait pas de notification in-app → `notify_leave_created` et `notify_leave_decision` manquants → notifications maintenant envoyées à la création et approbation/refus de congé
- Agent IA refusait de créer des employés : restriction "ne peut pas créer d'employés" dans le system prompt + outil `generate_employee` manquant → restreindre seulement la *modification* ; tool ajouté avec handler `execute_agent_action`
- Agent IA refusait les fichiers Excel/CSV : `handleFileSelect` ne validait que `.pdf`, `<input accept=".pdf">` → maintenant accepte `.pdf,.docx,.doc,.txt,.xlsx,.xls,.csv` + endpoint `extract-pdf` supporte Excel et CSV

## Changelog

### 2026-03-28
- **Upload d'images (Blog & Ressources)** : nouvel endpoint `POST /api/media/upload` dans `app/api/media_upload.py` — accepte images JPEG/PNG/WebP/GIF/SVG (max 5 Mo), stocke dans `/app/public/media-uploads/{tenant_id}/`, retourne `{ "url": "/media-uploads/..." }` — dossier monté en `StaticFiles` à `/media-uploads` dans `main.py`
- **Blog — image de couverture** : modal `PostEditorModal` (dashboard) — toggle **URL / Upload** : mode URL = champ texte, mode Upload = zone cliquable avec preview + bouton ×
- **Ressources — thumbnail** : modal `ResourceFormModal` (dashboard) — même toggle **URL / Upload** compact intégré dans la grille 2 colonnes

### 2026-03-27 (suite)
- **Agent IA — création d'employés** : ajout de l'outil `generate_employee` dans `AGENT_TOOLS` (prénom, nom, email, poste, département, rôle, contrat, etc.) + handler `generate_employee` dans `execute_agent_action` (résout `department_name` → `department_id` automatiquement) + system prompt mis à jour pour autoriser la création (retrait de la restriction erronée "ne peut pas créer des employés")
- **Agent IA — fichiers Excel/CSV** : `extract_pdf_text` accepte maintenant `.xlsx`, `.xls`, `.csv` (conversion en texte tabulaire `Ligne N: clé=valeur`) ; `AIChatBox.tsx` : `<input accept>` étendu + validations côté client — pour un Excel multi-lignes, Claude crée un employé à la fois
- **Agent IA — contexte départements** : injection automatique de la liste des unités organisationnelles disponibles dans `extra_context` (toutes pages) pour que Claude puisse référencer les noms corrects dans `department_name`

### 2026-03-27
- **Fix notifications congés** : `leaves.py` n'appelait jamais le service de notifications → ajout de `notify_leave_created` (après création demande) et `notify_leave_decision` (après approbation/refus) — les admins/RH/DG reçoivent maintenant une notification in-app quand une demande est soumise, et l'employé est notifié de la décision
- **Table `notification_preferences` manquante** : pas de migration Alembic → créée dans `start.sh` via `CREATE TABLE IF NOT EXISTS` au démarrage Railway — résout le 500 sur `GET/PUT /api/notifications/preferences` (page Paramètres > Notifications)
- **Suppression types de congés** : ajout bouton "Supprimer" (rouge, avec confirmation) dans la modale "Types de congés" (Paramètres congés) — appelle `DELETE /api/leaves/types/{id}` (soft-delete `is_active=False`) — fonction `deleteLeaveType()` ajoutée dans `app/dashboard/leaves/page.tsx`
- **Offres Internes crash** : champs `responsibilities`, `requirements`, `nice_to_have`, `benefits` peuvent arriver comme chaînes JSON depuis l'API → `parseArrayField()` + `normalizeJob()` ajoutés dans le frontend `my-space/internal-jobs/page.tsx`
- **Signature électronique (Settings)** : section "signature du signataire" utilise désormais le canvas `SignatureCanvas.tsx` + un chemin upload fichier — base64 raw converti en `File` PNG avant envoi à `POST /api/settings/certificate/upload/signature`
- **Analytics Plan de Formation URL** : `API_URL` ne contient pas `/api` → toujours `${API_URL}/api/training-plans/analytics?year=N`

### 2026-03-26
- **Soldes congés — refonte** : nouveau champ `accrual_start_month` (SmallInteger, défaut=1) sur `LeaveBalance` — détermine le mois à partir duquel l'acquisition mensuelle commence (utile pour embauche en cours d'année) — migration 028
  - Nouvel endpoint `POST /api/leaves/balances/year-reset` — remet à zéro les soldes pour une nouvelle année en reportant les CR de N-1
  - Propriété calculée `available` sur `LeaveBalance` : `solde_init + carried_over + (accrual_rate × mois_courus depuis accrual_start_month) - taken - pending`
  - `start.sh` contient un SQL de rattrapage d'urgence pour ajouter la colonne si absente (évite le 500 au boot Railway)
- **Arrêt Maladie** : ajout du type `sick_leave` dans `AbsenceType` (model, API, frontend) + migration 027
- **Analytics Plan de Formation** : nouvel endpoint `GET /api/training-plans/analytics?year=N` — KPIs taux de réalisation, sessions, employés formés, consommation budget ; répartition trimestrielle (T1-T4) planifié vs réalisé ; répartition par modalité ; tableau de suivi par plan — Route placée AVANT `/{plan_id}` pour éviter conflit FastAPI

## Pattern pour nouvel endpoint

1. Filtrer par `tenant_id` obligatoirement
2. Utiliser `get_current_tenant` dependency
3. Placer routes statiques avant routes paramétrées

---

## Agent IA (Chat Agentique)

**Fichiers clés** :
- `app/services/ai_agent_service.py` — outils Claude (`AGENT_TOOLS`), system prompt, `build_agent_system_prompt()`
- `app/api/ai_chat.py` — endpoints `/agent`, `/execute-action`, `/extract-pdf`
- `targetym-dashboard/components/AIChatBox.tsx` — UI chat, gestion fichiers, flow validation

**Rôles autorisés** : `rh`, `admin`, `dg`, `manager` (les `employee` n'ont pas accès au mode agentique)

**Ce que l'agent PEUT faire** :
- Créer des employés (`generate_employee`)
- Créer des candidats dans le module recrutement (`generate_candidate`)
- Créer des offres d'emploi (`generate_job_posting`)
- Créer des unités organisationnelles — département, service, direction, etc. (`create_department`)
- Créer des programmes d'onboarding avec tâches (`generate_onboarding_program`)
- Créer des objectifs OKR avec key results (`generate_okr_objectives`)
- Créer des plans de formation (`generate_training_plan`)
- Répondre aux questions RH, conseils, analyses

**Restrictions actuelles** (dans `build_agent_system_prompt`) :
1. ❌ Pas de **suppression** de données
2. ❌ Pas de **modification** d'employés existants (création seulement)
3. ❌ Pas d'accès aux **données financières** (salaires, etc.)

**Formats de fichiers acceptés** : PDF, DOCX, DOC, TXT, RTF, XLSX, XLS, CSV

**Flow de création** :
1. Utilisateur écrit + joint éventuellement un fichier
2. `AIChatBox` appelle `/extract-pdf` → texte extrait envoyé à Claude
3. Claude appelle un `tool` → retourne `action_preview` (données à valider)
4. Utilisateur clique "Valider" → `executeAgentAction` → insertion en base
5. Confirmation affichée dans le chat

**Contexte injecté automatiquement** :
- Sur page recrutement : liste des offres actives/brouillons (pour lier `job_posting_id`)
- Toutes les pages : liste des unités organisationnelles disponibles (pour résoudre `department_name`)

---

## Sous-module Congés (Leaves)

### Endpoints clés

| Endpoint | Description |
|---|---|
| `GET /api/leaves/types` | Types de congés du tenant |
| `GET /api/leaves/balances/{employee_id}` | Soldes par employé |
| `POST /api/leaves/balances/initialize/{employee_id}` | Initialiser soldes d'un employé |
| `POST /api/leaves/balances/initialize-all` | Initialiser tous les employés |
| `PUT /api/leaves/balances/{balance_id}` | Modifier un solde manuellement |
| `POST /api/leaves/balance/year-end-rollover` | Report de fin d'année (N → N+1) |
| `POST /api/leaves/balances/year-reset` | Remise à zéro soldes pour une nouvelle année |
| `GET /api/leaves/requests` | Liste demandes de congés |
| `POST /api/leaves/requests` | Créer une demande |
| `POST /api/leaves/requests/{id}/approve` | Approuver/refuser |

### Modèle LeaveBalance — champs importants

- `accrual_start_month` (SmallInteger, 1-12) — mois de début d'acquisition pour les congés `is_annual=True`. Par défaut `1` (janvier). Pour une embauche en septembre : `accrual_start_month=9`
- `initial_balance` — solde saisi manuellement par le RH (solde au 31/12 N-1 importé)
- `carried_over` — report calculé automatiquement par `year-end-rollover`
- Propriété `available` = `initial_balance + carried_over + (accrual_rate × mois_courus) - taken - pending`

### Règles critiques Congés
- Routes `balances/initialize-all` et `balances/year-reset` AVANT `balances/{balance_id}` (routes statiques avant paramétrisées)
- `is_annual=True` sur `LeaveType` = acquisition mensuelle (accrual_rate jours/mois)
- Ne jamais supprimer un `LeaveBalance` — mettre à zéro via `PUT /balances/{id}`



### Decisions architecturales
- **Multi-tenant** : Modele C — isolation tenant + heritage groupe selectif (`is_mandatory=True` pour formations obligatoires groupe)
- **Annee fiscale** : Jan-Dec par defaut + `start_date`/`end_date` personnalisables sur `TrainingPlan`
- **Workflow** : Groupe cree plan racine (`parent_plan_id=NULL`) → RH/Admin filiale cree plan local (`parent_plan_id=X`) → Manager soumet besoins → Employe exprime souhaits
- **Gantt** : react-gantt-task + TanStack Table (frontend a venir)
- **Export** : pdfmake (rapide) + ReportLab (officiel) (frontend a venir)

### Nouvelles tables

| Table | Fichier | Role |
|-------|---------|------|
| `training_plans` | `app/models/training_plans.py` | Plan annuel avec heritage groupe via `parent_plan_id` |
| `training_needs` | `app/models/training_needs.py` | Besoins agrégés depuis OKR, Performance, Obligatoire, Manager, Employee |
| `training_plan_actions` | `app/models/training_plan_actions.py` | Actions/formations du plan avec cout, modalite, prestataire |
| `training_schedule` | `app/models/training_schedule.py` | Calendrier sessions avec dates T1-T4, lieu, formateur |
| `training_assignments` | `app/models/training_assignments.py` | Participants assignes par session (invite → confirme → present/absent) |

### Tables existantes modifiees
- `courses` (`app/models/learning.py`) — ajout `unit_cost` (Numeric 15,2) + `billing_mode` (String: per_participant, per_session, forfait)

### Enums cles (MAJUSCULES)
- `PlanLevel.GROUP`, `PlanLevel.SUBSIDIARY`, `PlanLevel.LOCAL`
- `PlanStatus.DRAFT` → `SUBMITTED` → `APPROVED` → `ACTIVE` → `CLOSED`
- `NeedPriority.HIGH`, `NeedPriority.MEDIUM`, `NeedPriority.LOW`
- `NeedStatus.IDENTIFIED` → `PLANNED` → `COMPLETED` / `CANCELLED`
- `TargetType.INDIVIDUAL`, `TargetType.JOB`, `TargetType.LEVEL`, `TargetType.DEPARTMENT`, `TargetType.GROUP`
- `Modality.PRESENTIEL`, `Modality.DISTANCIEL`, `Modality.BLENDED`, `Modality.ELEARNING`
- `BillingMode.PER_PARTICIPANT`, `BillingMode.PER_SESSION`, `BillingMode.FORFAIT`
- `Quarter.T1`, `Quarter.T2`, `Quarter.T3`, `Quarter.T4`
- `ScheduleStatus.PLANNED` → `IN_PROGRESS` → `COMPLETED` / `CANCELLED`
- `AssignmentStatus.INVITED` → `CONFIRMED` → `ATTENDED` / `ABSENT` / `CANCELLED`

### Regles critiques Plan de Formation
- `parent_plan_id = NULL` = plan groupe racine ; plan filiale pointe vers plan groupe
- `is_mandatory=True` sur une action = heritable par filiales, **non supprimable** par la filiale
- Ne jamais supprimer un plan — utiliser `status='cancelled'`
- Les besoins (`training_needs`) sont dedupliques par `(employee_id, skill_target, year)`
- Les trimestres T1/T2/T3/T4 sont calcules depuis `start_date` du plan
- `training_plan_actions.course_id` nullable — une action peut etre une formation hors catalogue (`title` seul)

### Endpoint analytics (2026-03-26)
`GET /api/training-plans/analytics?year=N` retourne :
```json
{
  "year": 2026,
  "kpis": { "plans_count", "actions_total", "sessions_total", "sessions_planned",
            "sessions_in_progress", "sessions_completed", "sessions_cancelled",
            "implementation_rate", "employees_trained",
            "total_budget_ceiling", "total_estimated_cost", "budget_consumption_percent" },
  "quarterly": [{ "quarter": "T1", "planned": N, "completed": N, "rate": N }],
  "modality_breakdown": [{ "modality": "presentiel", "count": N }],
  "plans_tracking": [{ "id", "title", "status", "plan_level", "budget_ceiling",
                       "actions_count", "needs_count", "sessions_total",
                       "sessions_completed", "sessions_cancelled", "implementation_rate" }]
}
```
- Accessible à tous les rôles authentifiés (`get_current_user`)
- `employees_trained` = count distinct `employee_id` sur assignments de sessions COMPLETED

### Endpoints a ne pas casser
- `GET /api/learning/courses` — catalogue existant (inchange)
- `GET /api/learning/assignments` — suivi existant (inchange)
- Tous les nouveaux endpoints du Plan de Formation sont sous `/api/training-plans/`

---

## Changelog — Bugs corriges & Fonctionnalites ajoutees

### 2026-03-23

#### Bug fix — Liste déroulante "Type de congé" vide lors d'une demande de congé
- **Symptôme** : Dans `/my-space/leaves`, le select "Type de congé" n'affichait rien
- **Cause** : Aucun type de congé créé pour le tenant concerné (table `leave_types` vide pour ce `tenant_id`)
- **Solution** : Créer les types manuellement via `/dashboard/leaves` → onglet **Paramètres** → **Gérer les types**
- **Fichiers concernés** : `app/api/leaves.py` (endpoint `GET /api/leaves/types`), dashboard `app/dashboard/my-space/leaves/page.tsx`
- **Note** : L'endpoint retourne un tableau vide si aucun type n'existe — c'est le comportement attendu, la configuration est à la charge de l'admin RH du tenant

#### Incident production — 503 sur `POST /api/auth/login` (authentification RDS échouée)
- **Symptôme** : `POST /api/auth/login` retournait 503, toute l'application était inaccessible
- **Cause** : Désynchronisation entre le mot de passe dans la Task Definition ECS active et le mot de passe configuré sur RDS — erreur PostgreSQL : `FATAL: password authentication failed for user "postgres"`
- **Infrastructure** : Backend FastAPI sur AWS ECS Fargate (eu-west-1), base de données PostgreSQL RDS (`database-1.cv8eayg8c9es.eu-west-1.rds.amazonaws.com:5432`)
- **Solution** :
  1. Changement du mot de passe sur RDS (AWS Console → RDS → Modify → nouveau mdp `TargetymProd2026!`)
  2. Création d'une nouvelle révision de Task Definition ECS avec la `DATABASE_URL` mise à jour
  3. Update du Service ECS avec Force new deployment
- **Fichiers concernés** : `task-definition.json` (local uniquement, dans `.gitignore`) — variable `DATABASE_URL`
- **Note** : Le service ECS continuait à répondre 200 sur `/health` (les containers tournaient) mais toutes les requêtes nécessitant la BDD échouaient en 503

#### Bug fix — Dashboard "Ma Performance" affichait des données incorrectes (OKR 78%, feedbacks/évaluations d'autres employés)
- **Symptôme** : Un utilisateur admin/RH voyait "78% OKR", "Feedbacks reçus: 1", "Évaluations" provenant d'autres employés du tenant dans la vue "Ma Performance"
- **Cause 1** : `okr_achievement = 78.0` était une valeur hardcodée (TODO jamais implémenté)
- **Cause 2** : Pour les rôles admin/RH, `employee_ids = None` ce qui déclenchait un comptage global de **tous** les feedbacks/évaluations du tenant au lieu des données personnelles
- **Solution** : Le scope est désormais toujours `"personal"` pour `GET /api/performance/my-stats` — les données sont filtrées sur l'employé connecté quel que soit son rôle
- **OKR** : `okr_achievement` maintenant calculé depuis la table `Objective` (valeur réelle)
- **Fichiers concernés** : `app/api/performance.py` (fonction `get_my_performance_stats`)
- **Commit** : `63364a3`

#### Incident production — 503 au redéploiement CI/CD (secret GitHub `DATABASE_URL` obsolète)
- **Symptôme** : Toute modification pushée sur `main` redéclenchait un 503 — les containers démarraient mais ne pouvaient pas se connecter à PostgreSQL
- **Cause** : Le secret GitHub `DATABASE_URL` utilisé par `.github/workflows/deploy.yml` contenait l'ancien mot de passe (avant le changement RDS fait lors de l'incident précédent)
- **Diagnostic** : Logs ECS montraient une tentative de connexion sur socket locale `/var/run/postgresql/` → variable `DATABASE_URL` absente = driver SQLAlchemy utilisait le socket Unix par défaut
- **Solution** : Mise à jour du secret GitHub `DATABASE_URL` → Settings → Secrets and variables → Actions → `DATABASE_URL` → valeur : `postgresql://postgres:TargetymProd2026!@database-1.cv8eayg8c9es.eu-west-1.rds.amazonaws.com:5432/targetym?sslmode=require`
- **Fichiers concernés** : `.github/workflows/deploy.yml` (injecte `${{ secrets.DATABASE_URL }}` dans la Task Definition)
- **Note** : À chaque changement de mot de passe RDS, mettre à jour **simultanément** la Task Definition ECS ET le secret GitHub `DATABASE_URL`

#### Fonctionnalité — Système d'évaluations périodiques pondérées (360° avec notes pondérées)
- **Objectif** : Configurer des campagnes d'évaluation avec 4 types d'évaluateurs, 3 périodicités et une pondération personnalisée
- **4 types d'évaluateurs** :
  - `self` — Auto-évaluation (l'employé s'évalue lui-même)
  - `peer` — Collègues (1-2 personnes du même niveau)
  - `direct_report` — Collaborateurs (1-3 subordonnés directs)
  - `manager` — Manager direct
- **3 périodicités** : `quarterly` (trimestriel), `semester` (semestriel), `annual` (annuel)
- **Pondération** : `weight_self + weight_manager + weight_peer + weight_direct_report = 100` (configurable par campagne)
- **Calcul du score** :
  - `weighted_score` sur `Evaluation` = contribution individuelle au score final de l'employé
  - Pour peer/direct_report (plusieurs évaluateurs) : score pondéré partagé entre les n évaluateurs du même type
  - `global_score` annuel = moyenne des scores de toutes les campagnes de l'année
- **Nouvel endpoint** : `GET /api/performance/global-score/{employee_id}?year=YYYY`
- **Migration** : `alembic/versions/020_add_evaluation_periods_and_weights.py`
- **Fichiers modifiés** :
  - `app/models/performance.py` : colonnes `period`, `quarter`, `weight_*`, `min/max_direct_report_evaluators` sur `EvaluationCampaign` ; `period`, `weighted_score` sur `Evaluation`
  - `app/schemas/performance.py` : `PeriodType` enum, `EvaluatorSelection`, champs étendus sur `EvaluationCampaignCreate/Response`, `GlobalScoreResponse`, `CampaignScoreItem`
  - `app/api/performance.py` : `create_campaign` crée les `EvaluationAssignment` + `Evaluation` pour tous les types inclus ; `submit_evaluation` calcule `weighted_score` ; nouvel endpoint `global-score`

#### Frontend — `CreateCampaignModal` multi-étapes (`targetym-dashboard`)
- **Fichier** : `app/dashboard/performance/campaigns/page.tsx`
- **Commit** : `dc48fde`
- **Étape 1** : Nom, description, type, périodicité, dates, choix des types d'évaluateurs (checkboxes), pondérations (sliders, visibles uniquement si ≥ 2 types cochés), employés concernés
- **Étape 2** (conditionnelle) : S'affiche uniquement si « Pairs » ou « Collaborateurs directs » est coché. Pour chaque employé, permet de sélectionner jusqu'à 3 pairs et/ou 3 collaborateurs via le composant `PeerSelector` (autocomplete avec tags supprimables)
- **Composant `PeerSelector`** : autocomplete de sélection multi-employés avec recherche live, affiche les sélectionnés en tags, respecte `maxSelectable`
- **Assignation automatique** : `manager` → récupéré depuis `emp.manager_id` côté backend (organigramme), aucune sélection manuelle requise
- **Assignation manuelle** : `peer_ids` et `direct_report_ids` envoyés dans `evaluator_selections[]` du corps POST
- **Pondérations auto-calculées** : quand on coche/décoche un type, les poids sont redistribués équitablement ; total affiché en vert (= 100 %) ou orange (≠ 100 %)
- **Navigation évaluations → campagnes** : `sessionStorage.setItem('open-create-campaign', 'true')` déclenche l'ouverture automatique du modal à l'arrivée sur `/campaigns` (commit `9a7f372`)

#### Bug fix — Bouton "Soumettre" absent dans `EvaluationEditModal` (`targetym-dashboard`)
- **Symptôme** : Dans `/dashboard/performance/evaluations`, le modal d'édition n'affichait que le bouton "Annuler" — impossible de soumettre une évaluation
- **Cause** : Le bouton était conditionné par `isEmployeeEditing`, un booléen composite qui exigeait que l'`employee_id` ou l'`evaluator_id` de l'évaluation corresponde exactement à l'ID de l'utilisateur connecté. Si l'un des IDs ne matchait pas (ex. rôle admin visualisant), le bouton disparaissait dans tous les cas
- **Solution** : `isEmployeeEditing` remplacé par `canEdit && (status === 'pending' || status === 'in_progress')` — condition lisible et correcte
- **Fichier** : `app/dashboard/performance/evaluations/page.tsx` (ligne ~526)
- **Commit** : `8af1b06`

#### Bug fix — 422 sur `POST /api/careers/levels/{level_id}/factors` (ajout facteur de promotion)
- **Symptôme** : Dans `/dashboard/talents/paths`, cliquer sur "+" pour ajouter un facteur de promotion retournait une erreur `422 Unprocessable Content`
- **Cause** : Le composant `AddFactorModal` envoyait `{ name, is_blocking }` alors que le backend (`PromotionFactorCreate`) attend `{ factor_name, factor_type, threshold_value, is_blocking }` — le champ `name` au lieu de `factor_name` causait l'échec de validation Pydantic
- **Solution** : Remplacement de `<AddFactorModal>` par `<AddFactorModalNew>` (composant déjà existant dans le fichier) qui envoie les bons noms de champs + expose la sélection du `factor_type` (`auto` / `committee` / `n_plus_1`) et la valeur seuil
- **Fichier** : `app/dashboard/talents/paths/page.tsx` (ligne ~594)
- **Commit** : `5fb6bc6`
- **Schéma backend** (`app/api/careers.py`, classe `PromotionFactorCreate`) :
  ```python
  class PromotionFactorCreate(BaseModel):
      factor_name: str
      factor_type: str = "auto"        # auto | committee | n_plus_1
      threshold_value: Optional[str] = None
      is_blocking: bool = True
  ```

#### Fonctionnalité — Évaluation + tâches/formations dans le One-to-one ✅ déployé `9c80eaf`
- **Objectif** : À la clôture d'un 1-on-1, permettre au manager de donner une évaluation (1-5 étoiles) qui impacte la note globale annuelle du collaborateur, et d'affecter des tâches/formations à suivre consultables par les deux parties.
- **Migration** : `alembic/versions/021_add_one_on_one_evaluation_and_tasks.py`
- **3 nouvelles colonnes sur `one_on_ones`** :
  - `evaluation_score` (INTEGER, nullable) — 1 à 5 étoiles
  - `evaluation_comment` (TEXT, nullable) — commentaire justificatif
  - `tasks` (JSONB, nullable) — `[{id, title, type (task|training), assignee (manager|employee), due_date, status (pending|done), completed_at}]`
- **Impact note globale** : `GET /api/performance/global-score/{employee_id}` — score normalisé /10 (score 1-on-1 × 2) pondéré à 20% du score final si des campagnes existent, sinon seul indicateur
- **Nouveau endpoint** : `PATCH /api/performance/one-on-ones/{id}/tasks/{task_id}?status=done|pending` — accessible manager ET employé concerné
- **`complete_one_on_one` mis à jour** : sauvegarde `evaluation_score`, `evaluation_comment`, et convertit les `tasks` créées en objets avec UUID
- **`my-stats` mis à jour** : retourne `avg_one_on_one_score` (moyenne des scores 1-on-1 sur 5)
- **Frontend** : `app/dashboard/performance1/page.tsx`
  - `CompleteOneOnOneModal` : notes + humeur + étoiles 1-5 avec label verbal + commentaire + ajout inline de tâches/formations (type, assigné, échéance)
  - Carte 1-on-1 : bouton "Clôturer" pour réunions `scheduled`, affichage des étoiles si terminé, notes, liste de tâches avec checkboxes cliquables (toggle `pending` ↔ `done`)
  - Interface `OneOnOneTask` et `OneOnOne` étendus

#### Fonctionnalité — Système de Gestion des Compétences ✅ Phase 1 déployée (`9ed8258` api, `2f75cd0` dashboard)

**Objectif** : Référentiel de compétences configurable par niveau hiérarchique × département × type, avec score automatique = formations + performance + attitudes → 9-box auto.

**Migration** : `alembic/versions/023_enrich_skills_competency_framework.py`

**Tables enrichies** :
- `skills` : +`skill_type` (soft_skill|technical|management), +`hierarchy_level`, +`department`, +`is_global`
- `level_competencies` : +`skill_id` FK optionnel vers `skills`
- `employee_skills` : +`formations_score`, +`performance_score`, +`attitude_score`, +`notes`, +`last_computed_at`

**Formule** : `global_score = 40% formations + 40% performance + 20% attitude`
- `formations_score` : % cours requis complétés par compétence (via `course_skills`)
- `performance_score` : AVG(evaluations.weighted_score) / 10 × 100
- `attitude_score` : % feedbacks positifs (recognition vs improvement)

**Endpoints backend** (`app/api/learning.py`) :
- `GET /learning/skills/` — filtres: `skill_type`, `hierarchy_level`, `department`
- `PUT /learning/skills/{id}` — mise à jour
- `DELETE /learning/skills/{id}` — suppression
- `POST /learning/employees/{id}/skills/compute` — calcule et persiste tous les scores
- `GET /learning/employees/{id}/competency-profile` — profil complet + formations restantes + reco IA
- `POST /learning/employees/{id}/skills/bulk-init` — import depuis scoring CV
- `POST /learning/employees/{id}/skills/from-career-level` — initialise depuis niveau de carrière

**9-box automatique** (`app/api/careers_ninebox.py`) :
- `POST /careers/ninebox/auto-compute?period=XXX` — calcule perf (évals 60% + OKR 40%) × potentiel (compétences 70% + attitude 30%) et upsert placements
- `GET /careers/ninebox/auto-preview?employee_id=XXX` — prévisualise les scores d'un employé

**Frontend** :
- `app/dashboard/learning/referentiel/page.tsx` — onglet Référentiel Compétences (existant) avec table groupée par niveau hiérarchique, filtres type/niveau/département, CRUD compétences ✅
- `components/EmployeeModal.tsx` — panel Compétences enrichi : score global badge (couleur), barres couleur-codées, recommandation IA sur compétences < 50% ✅
- `components/AddEmployeeModal.tsx` — étape compétences initiales après création employé : sliders 0-100 par compétence, sauvegarde en masse, bouton "Passer" disponible ✅
- `app/dashboard/talents/ninebox/page.tsx` — bouton "Auto-calculer" (RH only) pour calcul automatique depuis données réelles ✅
- `components/Sidebar.tsx` — "Référentiel Compétences" ajouté sous Formation & Développement (rh/admin/dg) ✅

**Gaps restants** :
- `CompetencyModal.tsx` dans talents/employees — modal profil compétences avec score radial et 3 sous-scores détaillés (non implémenté)

### 2026-03-30

#### Fonctionnalité — Transfert score CV → EmployeeSkill à l'embauche (`9ed8258` api)
- **Fichier** : `app/api/recruitment.py` — helper `_init_employee_skills_from_cv_score()` appelé par `convert_to_employee`
- **Logique** : si `candidate.ai_score` existe → cherche les compétences actives du tenant → crée `EmployeeSkill` avec niveau initial selon type :
  - `is_global=True` → overall `ai_score`
  - `skill_type='technical'` → score "Compétences techniques" du detail IA
  - `skill_type='soft_skill'` → score "Soft skills" du detail IA
  - Non-bloquant : warnings + rollback en cas d'erreur

#### Fonctionnalité — Étape compétences initiales dans AddEmployeeModal (`2f75cd0` dashboard)
- **Fichier** : `components/AddEmployeeModal.tsx`
- **Flux** : après création employé → si tenant a des compétences → affiche step avec sliders 0-100 groupés par type (technique/soft/management) → sauvegarde bulk via `POST /api/learning/employee-skills/` → continue vers create_access ou fermeture
- **Skip** : lien "Passer cette étape" disponible

#### Amélioration — Panel compétences enrichi dans EmployeeModal (`2f75cd0` dashboard)
- **Fichier** : `components/EmployeeModal.tsx` — section Compétences colonne 3
- **Ajouts** : badge score global (vert ≥70/jaune ≥40/rouge), barres de progression couleur-codées, bloc recommandation IA calculé client-side (liste les compétences < 50% avec action vers L&D)

#### Bug fix — Mon Équipe (Talents) affichait les mêmes données que Collaborateurs (`c4a1dfa`)
- **Symptôme** : `/dashboard/talents/team` montrait les mêmes fiches carrière que `/dashboard/talents/employees` — pas de filtrage par équipe du manager
- **Cause** : Les deux pages partageaient l'état `employeeCareers` dans `TalentsContext`, donc `loadEmployeeCareers` écrasait les données de l'autre vue
- **Solution** : Ajout d'un état séparé `teamCareers` + fonction `loadTeamCareers(managerId?)` dans `TalentsContext` — appelle `/api/careers/employees/all?manager_id=X`
- **Fichiers modifiés** :
  - `app/dashboard/talents/TalentsContext.tsx` : +`teamCareers`, +`loadTeamCareers`
  - `app/dashboard/talents/team/page.tsx` : `employeeCareers` → `teamCareers`, `loadEmployeeCareers` → `loadTeamCareers`

#### Fonctionnalité — Bouton "Évaluer" sur les 1-on-1 passés (`9d0e41a`)
- **Objectif** : Permettre au manager d'évaluer un 1-on-1 déjà planifié et dont la date est dépassée
- **Condition d'affichage** : `status === 'scheduled' && scheduled_date < now && canScheduleOneOnOne` (manager, admin, rh, dg)
- **Modal `EvaluateModal`** : notes (min 10 car.), score 1-5 étoiles, commentaire, actions de suivi (textarea)
- **Endpoint appelé** : `POST /api/performance/one-on-ones/{id}/complete` (déjà existant)
- **Fichier modifié** : `app/dashboard/performance/one-on-one/page.tsx`

#### Fonctionnalité — Type d'interaction dans Nouveau Feedback (`07adaba` / `f78e0f2`)
- **Objectif** : Permettre de qualifier le contexte du feedback avec un type d'interaction
- **5 types** : `request` (📋 Requête), `file` (📁 Dossier), `project` (🗂️ Projet), `mission` (🎯 Mission), `other` (💼 Autres)
- **Champ optionnel** : `interaction_type` nullable — le feedback reste valide sans sélection
- **UI** : boutons toggle sous "Type de feedback", sélection exclusive (cliquer à nouveau désélectionne)
- **Migration** : `alembic/versions/024_add_interaction_type_to_feedbacks.py` — `ALTER TABLE feedbacks ADD COLUMN interaction_type VARCHAR(20) NULL`
- **Fichiers modifiés** :
  - `app/models/performance.py` : +`interaction_type = Column(String(20), nullable=True)` sur `Feedback`
  - `app/schemas/performance.py` : +`InteractionType` enum, +`interaction_type: Optional[InteractionType]` dans `FeedbackBase` et `FeedbackResponse`
  - `app/api/performance.py` : `create_feedback` passe `interaction_type` au modèle ; `enrich_feedback` retourne `interaction_type` dans le dict
  - `app/dashboard/performance/page.tsx` : +`interactionType` state, +section boutons toggle dans `CreateFeedbackModal`, `createFeedback()` envoie `interaction_type`

- **Objectif** : À la clôture d'un 1-on-1, le manager peut créer des vraies tâches (`Task` records) visibles dans **Mes Tâches**
- **Remplacement** : Le textarea "actions de suivi" (chaîne libre) remplacé par une section "Tâches de suivi" avec bouton **+ Ajouter une tâche**
- **Champs par tâche** : titre (requis), assignée (employé ou manager « moi »), date d'échéance, priorité (faible/moyenne/haute/urgente)
- **Soumission** :
  1. `POST /api/performance/one-on-ones/{id}/complete` (avec `action_items[]` = titres des tâches)
  2. `POST /api/tasks` pour chaque tâche (crée le `Task` record)
- **Autorisation** : le manager peut assigner à lui-même OU à ses N-1 directs (`assignee.manager_id == creator.id`)
- **Toast résumé** : `Entretien évalué · N tâche(s) créée(s)` (ou signale les échecs partiels)
- **Imports ajoutés** : `Plus`, `Trash2`, `ListTodo` (lucide-react) + fonction `createTask()`
- **Interface ajoutée** : `TaskDraft { id, title, assigned_to_id, due_date, priority }`
- **Fichier modifié** : `app/dashboard/performance/one-on-one/page.tsx`

#### Bug fix — Tâches créées depuis le 1-on-1 n'apparaissaient pas dans "Mes Tâches" (`640de12` API, `66db208` dashboard)
- **Symptôme** : Le manager créait des tâches via `EvaluateModal` mais elles n'apparaissaient pas dans `/dashboard/tasks` côté employé
- **Cause** : Backend `POST /api/tasks/` retournait 403 si `assignee.manager_id != creator.id` — l'organigramme n'étant pas toujours parfaitement renseigné, la relation N+1 n'était pas détectée
- **Solution** : Nouveau bypass dans `app/api/tasks.py` : si `is_administrative=True` ET que le créateur a un rôle manager (`manager`, `rh`, `admin`, `dg`), la vérification `manager_id` est ignorée
- **Logique** :
  ```python
  is_direct_assign = data.assigned_to_id == creator.id
  is_direct_report = assignee.manager_id == creator.id
  is_admin_task = is_administrative and is_manager_role(current_user.role)
  if not (is_direct_assign or is_direct_report or is_admin_task):
      raise HTTPException(status_code=403, ...)
  ```
- **Frontend** : `EvaluateModal.createTask()` capte et affiche le message d'erreur exact en toast rouge si une tâche échoue
- **Fichiers modifiés** : `app/api/tasks.py`, `app/dashboard/performance/one-on-one/page.tsx`

#### Fonctionnalité — Renommage sidebar + page Évaluation 1-1 (`58d95c4`)
- **Renommage** : `"1-on-1"` → `"Coaching 1-1"` dans la sidebar
- **Nouveau lien sidebar** : `"Évaluation 1-1"` → `/dashboard/performance/evaluation-1-on-1` (icône `ClipboardCheck`, rôles : `manager`, `rh`, `admin`, `dg`)
- **7 nouveaux types de campagne** ajoutés dans `CreateCampaignModal` :
  - `evaluation_360` → Évaluation 360°
  - `entretien_1on1` → Entretien d'Évaluation 1-1
  - `coaching_1on1` → Session Coaching 1:1
  - `revue_hebdo` → Revue de Perf Hebdo
  - `feedback_360` → Feedback 360°
  - `prise_de_fonction` → Évaluation Prise de Fonction
  - `prise_dessai` → Évaluation de Prise d'Essai
- **Renommage bouton** : `"Évaluer"` → `"Report"` dans le modal de clôture 1-on-1
- **Nouvelle page** `app/dashboard/performance/evaluation-1-on-1/page.tsx` :
  - Récupère `GET /api/performance/one-on-ones?page_size=100&status=completed`
  - Stats : total sessions / évaluées / en attente
  - Recherche par nom + filtre "Afficher les déjà évaluées"
  - `EvaluationReportModal` : 5 critères (1-5 étoiles) + commentaires + formations + recommandation (4 options) + tâches d'amélioration → `POST /api/tasks/`
- **Fichiers modifiés** : `components/Sidebar.tsx`, `app/dashboard/performance/campaigns/page.tsx`, `app/dashboard/performance/one-on-one/page.tsx`, création `app/dashboard/performance/evaluation-1-on-1/page.tsx`

#### Bug fix — 422 sur la page Évaluation 1-1 (`9b1d0e2`)
- **Symptôme** : `GET /api/performance/one-on-ones?page_size=200&status=completed` retournait 422
- **Cause** : Backend définit `page_size: int = Query(20, ge=1, le=100)` — la valeur 200 était rejetée par FastAPI avant exécution du handler
- **Solution** : Remplacement de `page_size=200` par `page_size=100` dans `fetchCompletedSessions()`
- **Contrainte à retenir** : Tous les endpoints `one-on-ones` ont `page_size` max = **100**
- **Fichier modifié** : `app/dashboard/performance/evaluation-1-on-1/page.tsx`

### 2026-03-25

#### Fonctionnalite — Modele de donnees Plan de Formation
- **Objectif** : Sous-module complet pour la gestion du plan de formation annuel avec heritage groupe/filiale
- **5 nouvelles tables** : `training_plans`, `training_needs`, `training_plan_actions`, `training_schedule`, `training_assignments`
- **Table modifiee** : `courses` — ajout `unit_cost` (Numeric 15,2) + `billing_mode` (String)
- **Fichiers crees** :
  - `app/models/training_plans.py` — TrainingPlan + enums PlanLevel, PlanStatus
  - `app/models/training_needs.py` — TrainingNeed + enums NeedPriority, NeedStatus
  - `app/models/training_plan_actions.py` — TrainingPlanAction + enums TargetType, Modality, BillingMode
  - `app/models/training_schedule.py` — TrainingSchedule + enums Quarter, ScheduleStatus
  - `app/models/training_assignments.py` — TrainingAssignment + enum AssignmentStatus
- **Fichiers modifies** :
  - `app/models/learning.py` : +`unit_cost`, +`billing_mode` sur Course
  - `app/models/__init__.py` : enregistrement des 5 nouveaux modeles + enums
  - `alembic/env.py` : imports des nouveaux modeles pour autogenerate
- **Migration** : `alembic revision --autogenerate -m "add training plan module tables"` — a generer sur serveur, ne PAS executer (CloudShell RDS)

### 2026-03-26

#### Bug fix — Badge sidebar affiche les initiales lors d'une re-impersonnation (`aeff494` api, `372b25b` dashboard)

- **Symptôme** : Après avoir changé la photo d'un RH via impersonation, quitter puis re-impersonner ce RH, son badge sidebar affichait toujours ses initiales.
- **Cause racine** : La réponse `ImpersonationResponse` ne retournait pas `employee_id`. L'objet `user` stocké en localStorage lors de l'impersonation n'avait donc pas de `employee_id`. Dans `SidebarInner`, le fetch de photo est conditionné à `employeeId` → il ne se déclenchait jamais.
- **Fix backend** (`aeff494`) : Ajout de `employee_id: Optional[int] = None` dans `ImpersonationResponse` + `employee_id=employee.id if employee else None` dans le return de `/api/platform/impersonate/{user_id}`
- **Fix frontend** (`372b25b`) : Interface `ImpersonationResponse` mise à jour + ajout de `employee_id: result.employee_id || null` dans l'objet `user` stocké en localStorage lors de l'impersonation

#### Fonctionnalité — 7 nouvelles attitudes par défaut (`app/api/attitudes.py`)

- **Ajout** : 7 nouvelles attitudes ajoutées à la liste `DEFAULT_ATTITUDES` du endpoint `POST /api/attitudes/seed-defaults`
- **UI** : Les attitudes s'affichent sous forme de **checkboxes groupées par catégorie** (Savoir-être / Savoir-faire) dans le formulaire de feedback (`performance/page.tsx` → `AttitudeSelector`)
- **Nouvelles attitudes** :
  | Code | Nom | Catégorie | Icône | Ordre |
  |------|-----|-----------|-------|-------|
  | `REACTIVITE` | Réactivité | Savoir-être | ⚡ | 10 |
  | `DISCRETION` | Discrétion | Savoir-être | 🔒 | 11 |
  | `COMPASSION` | Compassion | Savoir-être | ❤️ | 12 |
  | `SOUTIEN_EMO` | Soutien Émotionnel | Savoir-être | 🫂 | 13 |
  | `DEP_FONCT` | Dépassement de fonction | Savoir-faire | 🚀 | 14 |
  | `PONCTUALITE` | Ponctualité | Savoir-être | ⏰ | 15 |
  | `SOUTIEN_TECH` | Soutien Technique | Savoir-faire | 🛠️ | 16 |
- **Total attitudes** : 16 (9 originales + 7 nouvelles)
- **Idempotent** : le seed ne recrée pas les attitudes déjà existantes (vérification par `code` + `tenant_id`)
- **Activation** : appeler `POST /api/attitudes/seed-defaults` depuis l'interface RH pour que les nouvelles attitudes apparaissent sur un tenant existant

#### Bug fix — `StringDataRightTruncation` sur `attitudes.icon` en production (`72a4dd9`, `22198c5` api / `0a53c48` dashboard)

- **Symptôme** : `POST /api/performance/attitudes/initialize` retournait 500 avec `StringDataRightTruncation` — la colonne `icon` est `VARCHAR(10)` en production, certains noms d'icônes Lucide dépassaient 10 caractères (`ClipboardList` = 13, `ShieldCheck` = 11)
- **Cause** : La migration 026 (`alembic/versions/026_extend_attitude_icon_column.py`) qui passe la colonne en `VARCHAR(50)` n'était pas encore appliquée en production (ECS ne redéployait pas automatiquement)
- **Solution immédiate** : Remplacement des noms d'icônes par des variantes courtes
  - `ClipboardList` → `FileText` (8 chars)  `ShieldCheck` → `Shield` (6 chars)
- **Contrainte supplémentaire découverte** : `Clipboard` est un type global du navigateur/TypeScript (Web API) — l'utiliser comme nom de variable Lucide cause un conflit de type sur Vercel (`Type '{ new (): Clipboard; prototype: Clipboard; }' is not assignable to type 'ComponentType<LucideProps>'`). Toujours choisir un nom qui n'est pas une interface Web API native.
- **Icônes valides (≤ 10 chars, pas de conflit TS)** : `Hourglass`, `Bell`, `Eye`, `FileText`, `Handshake`, `Wrench`, `Target`, `Brain`, `Globe`, `Zap`, `Shield`, `Heart`, `HeartPulse`, `TrendingUp`, `Clock`, `Cog`
- **Migration 026** : `ALTER TABLE attitudes ALTER COLUMN icon TYPE VARCHAR(50)` — à appliquer dès le prochain redéploiement ECS via `start.sh` + `main.py` lifespan ou manuellement
- **Fichiers modifiés** : `app/api/performance.py`, `app/api/attitudes.py` (backend) ; `app/dashboard/performance/page.tsx` (frontend)

#### Fonctionnalité — Picker de compétences Formation & Développement dans Parcours (`3f5e1a0` api, `0ec21f3` dashboard)

- **Objectif** : Lors de l'ajout d'une compétence à un niveau de parcours (Talents & Carrière → Parcours → Niveaux → Compétences), proposer un sélecteur qui affiche les compétences déjà configurées dans le référentiel Formation & Développement
- **Avant** : `AddCompetencyModal` ne proposait qu'une saisie manuelle du nom
- **Après** : Le modal charge `/api/learning/skills/` au démarrage et affiche un picker dropdown avec recherche filtrante (par nom ou catégorie). Sélectionner une compétence pré-remplit le nom et la description. La saisie manuelle reste disponible via un séparateur "ou saisir manuellement".
- **Lien persisté** : Le `skill_id` sélectionné est envoyé lors de la création → stocké dans `level_competencies.skill_id` (FK déjà présente via migration 023)
- **Backend** : `LevelCompetencyCreate` + `POST /careers/levels/{level_id}/competencies` acceptent désormais `skill_id: Optional[int] = None`
- **Fichiers modifiés** :
  - `app/api/careers.py` : +`skill_id` dans `LevelCompetencyCreate` + INSERT `level_competencies`
  - `app/dashboard/talents/paths/page.tsx` : `AddCompetencyModal` enrichi avec picker `LearningSkill[]`, interface `LearningSkill`, `useEffect` fetch `/api/learning/skills/`

