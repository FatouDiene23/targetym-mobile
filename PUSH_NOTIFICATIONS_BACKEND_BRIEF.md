# 📱 Brief backend — Push Notifications Firebase

**Destinataire :** dev backend Targetym
**Expéditeur :** Fatou (mobile)
**Date :** 21 avril 2026
**Stack concerné :** `targetym-api` — FastAPI + SQLAlchemy + Alembic + PostgreSQL
**Durée estimée :** 4 à 6 heures

---

## 🧭 Contexte général

### Le problème à résoudre

Actuellement, quand un manager valide un congé pour un employé, celui-ci doit ouvrir l'app pour voir le résultat. Pas de notification → frustration.

### La solution : notifications push

Un message apparaît sur le téléphone (comme WhatsApp), même si l'app est fermée.

### Chaîne technique

```
[Événement backend] → [Firebase FCM] → [Téléphone de l'utilisateur]
(ex: congé validé)    (service Google)   (affiche la notification)
```

Pour que ça fonctionne, il faut :

1. **Un annuaire des téléphones** → table `push_tokens` en DB
2. **Une adresse par téléphone** → le token FCM stocké en DB
3. **Un moyen d'envoyer** → lib `firebase-admin` + credentials
4. **Des déclencheurs métier** → quand envoyer quoi

### État actuel

- ✅ **Mobile** : Capacitor récupère le token FCM, demande l'autorisation, essaie de l'envoyer au backend
- ❌ **Backend** : `POST /api/push-tokens/register` retourne **404** (endpoint absent)

Il faut implémenter tout le backend.

---

## 📋 Liste des tâches

| # | Tâche | Fichier principal | Durée |
|---|-------|-------------------|-------|
| 1 | Modèle SQLAlchemy `PushToken` | `app/models/push_token.py` | 10 min |
| 2 | Migration Alembic | `alembic/versions/029_add_push_tokens.py` | 15 min |
| 3 | Installer firebase-admin | `requirements.txt` | 5 min |
| 4 | Récupérer credentials Firebase | env var `FIREBASE_CREDENTIALS_JSON` | 15 min |
| 5 | Service `send_push()` | `app/services/push_notifications.py` | 30 min |
| 6 | Endpoints register/unregister | `app/api/push_tokens.py` + `main.py` | 30 min |
| 7 | Brancher les 3 événements prioritaires | `tasks.py`, `leaves.py` | 45 min |
| 8 | Déployer en prod + migration | AWS ECS + CloudShell | 30 min |
| 9 | Test end-to-end | — | 30 min |

---

## ✅ TÂCHE 1 — Créer le modèle `PushToken`

### Intérêt

Créer la structure Python qui représente la nouvelle table SQL. On stockera les "adresses de téléphone" de chaque utilisateur.

**Pourquoi une table dédiée et pas une colonne sur `users` ?**
- Un user peut avoir plusieurs appareils (tél perso + pro + tablette)
- Les tokens changent (réinstall, reset Firebase)
- Multi-tenancy : filtrage par `tenant_id` obligatoire

### Fichier à créer

**`targetym-api/app/models/push_token.py`**

```python
from datetime import datetime
from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class PushToken(Base):
    """
    Stocke les tokens FCM (Firebase Cloud Messaging) des appareils mobiles
    pour envoyer des notifications push.
    """
    __tablename__ = "push_tokens"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(BigInteger, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(Text, nullable=False, unique=True)
    platform = Column(String(20), nullable=False)  # 'android' | 'ios' | 'web'
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_used_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="push_tokens")
    tenant = relationship("Tenant")
```

### Enregistrer le modèle

**Ajouter dans `targetym-api/app/models/__init__.py`** :

```python
from app.models.push_token import PushToken
```

### Validation

- [ ] Fichier `push_token.py` créé
- [ ] Import ajouté dans `__init__.py`
- [ ] `python -c "from app.models.push_token import PushToken"` → pas d'erreur

---

## ✅ TÂCHE 2 — Créer la migration Alembic

### Intérêt

Le modèle Python décrit la table, mais la migration **crée réellement la table** dans PostgreSQL. Alembic trace toutes les modifs de schéma → reproductible, versionné, rollback possible.

**Règle Targetym (CLAUDE.md) :** ne JAMAIS exécuter les migrations au démarrage. Appliquer manuellement via CloudShell RDS.

### Vérifier le numéro de migration

```bash
ls targetym-api/alembic/versions/ | sort | tail -3
```

→ Si la dernière est `028_xxx.py`, utiliser `029`. Sinon incrémenter.

### Fichier à créer

**`targetym-api/alembic/versions/029_add_push_tokens.py`**

```python
"""add push_tokens table

Revision ID: 029
Revises: 028
Create Date: 2026-04-21 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '029'
down_revision = '028'  # ⚠️ REMPLACER par le vrai dernier numéro
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'push_tokens',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', sa.BigInteger(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token', sa.Text(), nullable=False),
        sa.Column('platform', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('last_used_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('token', name='uq_push_tokens_token'),
    )
    op.create_index('idx_push_tokens_user_id', 'push_tokens', ['user_id'])
    op.create_index('idx_push_tokens_tenant_id', 'push_tokens', ['tenant_id'])


def downgrade():
    op.drop_index('idx_push_tokens_tenant_id', table_name='push_tokens')
    op.drop_index('idx_push_tokens_user_id', table_name='push_tokens')
    op.drop_table('push_tokens')
```

### Validation

- [ ] Fichier créé avec le bon numéro
- [ ] `alembic heads` ne plante pas (sans appliquer)

---

## ✅ TÂCHE 3 — Installer Firebase Admin SDK

### Intérêt

La librairie officielle Python pour parler à Firebase Cloud Messaging. Gère l'authentification OAuth2, les retry, la sérialisation.

Sans cette lib : il faudrait 50+ lignes de HTTP et de JWT signing manuel.

### Fichier à modifier

**`targetym-api/requirements.txt`** — ajouter à la fin :

```
# Push Notifications (FCM)
firebase-admin>=6.4.0
```

### Installation locale

```bash
cd targetym-api
pip install firebase-admin
```

### Validation

```bash
python -c "from firebase_admin import messaging; print('OK')"
# → affiche "OK"
```

---

## ✅ TÂCHE 4 — Récupérer les credentials Firebase

### Intérêt

Le backend doit prouver à Google qu'il est autorisé à envoyer des notifs au nom de l'app Targetym. C'est une **carte d'identité numérique** (service account) sous forme de JSON avec clé privée RSA.

**⚠️ CRITIQUE : ne jamais committer ce fichier dans Git.** Variable d'environnement uniquement.

### Étape 4.1 — Accéder à la console Firebase

1. Aller sur https://console.firebase.google.com
2. Se connecter avec **`targetym.playstore@gmail.com`** (identifiants via Fatou)
3. Sélectionner le projet **Targetym**

### Étape 4.2 — Générer la clé privée

1. Cliquer ⚙️ (roue crantée, en haut à gauche) → **Paramètres du projet**
2. Onglet **Comptes de service**
3. Cliquer **Générer une nouvelle clé privée** → confirmer
4. Un fichier JSON se télécharge (ex: `targetym-firebase-adminsdk-xxxxx.json`)

Contenu du fichier :

```json
{
  "type": "service_account",
  "project_id": "targetym-xxxx",
  "private_key_id": "xxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk@targetym-xxxx.iam.gserviceaccount.com",
  ...
}
```

### Étape 4.3 — Convertir en JSON minifié (une seule ligne)

```bash
python -c "import json; print(json.dumps(json.load(open('targetym-firebase-adminsdk-xxxxx.json'))))"
```

Copier la sortie.

### Étape 4.4 — Ajouter en variable d'environnement

**En local** — ajouter dans `.env` ou `.env.local` :
```
FIREBASE_CREDENTIALS_JSON={"type":"service_account","project_id":"targetym-xxxx",...}
```

**En production (AWS ECS)** :
1. AWS Console → ECS → Task Definitions → **targetym-api** → Create new revision
2. Trouver le container principal → Environment variables → **Add environment variable**
   - Name : `FIREBASE_CREDENTIALS_JSON`
   - Value : coller le JSON minifié
3. Create revision
4. Update le service ECS avec cette nouvelle révision → Force new deployment

### Règles absolues

- ❌ **NE JAMAIS** committer le fichier JSON dans Git
- ❌ **NE JAMAIS** le hardcoder dans le code source
- ✅ Stocker le fichier original dans un coffre partagé (Bitwarden, 1Password)

### Validation

```python
import os
print(len(os.environ.get("FIREBASE_CREDENTIALS_JSON", "")))
# → > 1000 (le JSON complet fait plusieurs Ko)
```

---

## ✅ TÂCHE 5 — Créer le service `send_push()`

### Intérêt

**Centraliser toute la logique d'envoi de notifications dans une seule fonction réutilisable.**

Avec un service centralisé :
- Code DRY — une seule implémentation, 100 utilisations
- Si on change Firebase pour OneSignal → un seul fichier à modifier
- Gestion d'erreurs uniforme (tokens expirés supprimés auto, logs uniformes)

Usage :
```python
send_push(db, user_ids=[42], title="Bonjour", body="Test")
```

### Fichier à créer

**`targetym-api/app/services/push_notifications.py`** (créer le dossier `services/` s'il n'existe pas)

```python
"""
Service d'envoi de notifications push via Firebase Cloud Messaging (FCM).

Utilisation :
    from app.services.push_notifications import send_push

    send_push(
        db,
        user_ids=[42],
        title="Nouvelle tâche",
        body="Vous avez une tâche à faire",
        data={"route": "/dashboard/my-space/tasks"},
        tenant_id=1,
    )
"""
import json
import logging
import os
from typing import Optional

import firebase_admin
from firebase_admin import credentials, messaging
from sqlalchemy.orm import Session

from app.models.push_token import PushToken

logger = logging.getLogger(__name__)

# Flag pour n'initialiser Firebase qu'une seule fois (lazy init)
_initialized = False


def _init_firebase():
    """Initialise Firebase Admin SDK une seule fois au premier appel."""
    global _initialized
    if _initialized:
        return

    cred_json = os.environ.get("FIREBASE_CREDENTIALS_JSON")
    if not cred_json:
        logger.warning(
            "FIREBASE_CREDENTIALS_JSON not set — push notifications are DISABLED. "
            "Set the env var to enable FCM."
        )
        return

    try:
        cred = credentials.Certificate(json.loads(cred_json))
        firebase_admin.initialize_app(cred)
        _initialized = True
        logger.info("Firebase Admin SDK initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin: {e}")


def send_push(
    db: Session,
    user_ids: list[int],
    title: str,
    body: str,
    data: Optional[dict] = None,
    tenant_id: Optional[int] = None,
) -> int:
    """
    Envoie une notification push aux utilisateurs donnés.

    Arguments :
        db          - session SQLAlchemy
        user_ids    - liste des user_id destinataires
        title       - titre de la notif
        body        - corps du message
        data        - dict optionnel (ex: {"route": "/dashboard/tasks"}) pour deep linking
        tenant_id   - filtrer par tenant (recommandé pour isolation multi-tenant)

    Retourne :
        Le nombre de notifications envoyées avec succès.

    Note : les tokens invalides ou expirés sont automatiquement supprimés de la DB.
    """
    _init_firebase()
    if not _initialized:
        logger.warning("Firebase not initialized — push notification skipped")
        return 0

    if not user_ids:
        return 0

    # Récupérer tous les tokens des utilisateurs
    query = db.query(PushToken).filter(PushToken.user_id.in_(user_ids))
    if tenant_id is not None:
        query = query.filter(PushToken.tenant_id == tenant_id)
    tokens = query.all()

    if not tokens:
        logger.debug(f"No push tokens found for user_ids={user_ids}")
        return 0

    # FCM n'accepte que des strings dans le champ data
    clean_data = {}
    if data:
        for k, v in data.items():
            if v is not None:
                clean_data[str(k)] = str(v)

    success_count = 0
    tokens_to_delete = []

    for t in tokens:
        try:
            msg = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                token=t.token,
                data=clean_data,
                android=messaging.AndroidConfig(priority="high"),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(sound="default", badge=1)
                    )
                ),
            )
            messaging.send(msg)
            success_count += 1
        except messaging.UnregisteredError:
            # Token expiré ou app désinstallée → supprimer
            tokens_to_delete.append(t.id)
        except messaging.InvalidArgumentError:
            # Token invalide → supprimer
            tokens_to_delete.append(t.id)
        except Exception as e:
            logger.error(f"Push send failed for user={t.user_id} token_id={t.id}: {e}")

    # Nettoyer les tokens obsolètes
    if tokens_to_delete:
        db.query(PushToken).filter(PushToken.id.in_(tokens_to_delete)).delete(
            synchronize_session=False
        )
        db.commit()
        logger.info(f"Deleted {len(tokens_to_delete)} obsolete push tokens")

    return success_count
```

### Pourquoi l'init lazy ?

Si `FIREBASE_CREDENTIALS_JSON` manque au démarrage, l'app ne plante pas : elle démarre normalement, seules les notifs sont désactivées avec un warning. Robuste.

### Pourquoi supprimer les tokens `UnregisteredError` ?

Si un utilisateur désinstalle l'app, son token devient invalide. Firebase nous le signale → on nettoie la DB automatiquement pour ne pas garder de la pollution.

### Validation

```python
python -c "from app.services.push_notifications import send_push; print('OK')"
# → affiche "OK"
```

---

## ✅ TÂCHE 6 — Créer les endpoints register/unregister

### Intérêt

**Ces endpoints sont la "boîte aux lettres" qui reçoit les tokens depuis l'app mobile.**

Flux complet :
```
1. Fatou ouvre l'app mobile
2. L'app récupère son token FCM : "dZ9H..."
3. L'app appelle POST /api/push-tokens/register { token, platform }
4. Le backend l'enregistre en DB
5. Plus tard, un événement → le backend retrouve le token → envoie la notif
```

**L'absence de cet endpoint est la cause actuelle du 404** dans les logs mobile.

### Fichier à créer

**`targetym-api/app/api/push_tokens.py`**

```python
"""
Endpoints pour la gestion des tokens de push notifications (FCM).
Appelés par l'app mobile Capacitor au démarrage et à la déconnexion.
"""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.push_token import PushToken
from app.models.user import User

router = APIRouter(prefix="/api/push-tokens", tags=["Push Notifications"])


# ========================
# SCHEMAS Pydantic
# ========================

class PushTokenRegister(BaseModel):
    token: str
    platform: Literal["android", "ios", "web"]


class PushTokenUnregister(BaseModel):
    token: str


# ========================
# ENDPOINTS
# ========================

@router.post("/register")
def register_push_token(
    data: PushTokenRegister,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Enregistre ou met à jour le token FCM d'un appareil.
    Appelé par l'app mobile au démarrage après authentification.

    Si le token existe déjà pour un autre user (cas fréquent : plusieurs
    personnes se connectent sur le même téléphone), on le réattribue au
    user courant.
    """
    if not data.token or len(data.token) < 20:
        raise HTTPException(status_code=400, detail="Invalid token")

    existing = db.query(PushToken).filter(PushToken.token == data.token).first()
    if existing:
        existing.user_id = current_user.id
        existing.tenant_id = current_user.tenant_id
        existing.platform = data.platform
        existing.last_used_at = datetime.utcnow()
    else:
        db.add(PushToken(
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            token=data.token,
            platform=data.platform,
        ))

    db.commit()
    return {"success": True}


@router.post("/unregister")
def unregister_push_token(
    data: PushTokenUnregister,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Supprime un token FCM (appelé par l'app mobile à la déconnexion).
    """
    db.query(PushToken).filter(
        PushToken.token == data.token,
        PushToken.user_id == current_user.id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"success": True}
```

### Enregistrer le router

**Modifier `targetym-api/app/main.py`** — dans la section `include_router` :

```python
from app.api import push_tokens

# ... dans la liste des include_router existants
app.include_router(push_tokens.router)
```

### Pourquoi un endpoint `/unregister` ?

Si un employé quitte l'entreprise mais garde l'app installée, on ne veut pas continuer à lui envoyer des notifs Targetym. À la déconnexion, l'app mobile appellera cet endpoint.

### Pourquoi `get_current_user` dependency ?

Sans authentification, n'importe qui pourrait enregistrer un token et recevoir les notifs d'un autre utilisateur. Risque de fuite d'info.

### Validation

Démarrer l'API en local :

```bash
uvicorn app.main:app --reload
```

Tester avec curl :

```bash
curl -X POST http://localhost:8000/api/push-tokens/register \
  -H "Authorization: Bearer <UN_TOKEN_JWT_VALIDE>" \
  -H "Content-Type: application/json" \
  -d '{"token":"test_token_12345678901234567890","platform":"android"}'
# → {"success":true}
```

Vérifier en DB :

```sql
SELECT * FROM push_tokens WHERE token = 'test_token_12345678901234567890';
-- Doit retourner 1 ligne
```

---

## ✅ TÂCHE 7 — Brancher les événements métier

### Intérêt

**C'est le moment où la magie opère : un événement métier → une notification sur le téléphone.**

Sans cette tâche, le système est prêt mais **aucune notif ne part jamais**.

3 événements prioritaires (P0) :
1. **Nouvelle tâche assignée** — l'employé doit savoir qu'on attend quelque chose de lui
2. **Congé approuvé/refusé** — décision importante, attendue avec impatience
3. **Journée validée/rejetée** — feedback quotidien du manager

Les autres événements (évaluation, feedback, etc.) viendront en P2.

---

### 7A. Notification quand une tâche est assignée

**Fichier à modifier :** `targetym-api/app/api/tasks.py`

**Trouver** la fonction qui crée une tâche (chercher `@router.post` + `def create_task` ou similaire).

**Juste APRÈS** le `db.commit()` et `db.refresh(new_task)`, ajouter :

```python
from app.services.push_notifications import send_push
from app.models.employee import Employee

# --- Notification push à l'employé assigné ---
if new_task.assigned_to_id and new_task.assigned_to_id != current_user.id:
    assignee = db.query(Employee).filter(Employee.id == new_task.assigned_to_id).first()
    if assignee and assignee.user_id:
        try:
            send_push(
                db,
                user_ids=[assignee.user_id],
                title="Nouvelle tâche",
                body=f"{current_user.full_name or current_user.email} vous a assigné : {new_task.title}",
                data={"route": "/dashboard/my-space/tasks", "task_id": new_task.id},
                tenant_id=new_task.tenant_id,
            )
        except Exception as e:
            logger.error(f"Push notification failed for task {new_task.id}: {e}")
```

**Si `logger` n'est pas défini dans le fichier**, ajouter en haut :
```python
import logging
logger = logging.getLogger(__name__)
```

**Pourquoi le `try/except` ?** Si Firebase est down, on ne veut PAS casser la création de tâche (fonctionnalité principale). La notif est un bonus.

**Pourquoi `!= current_user.id` ?** Pour éviter la notif "vous vous êtes assigné une tâche" — absurde.

**Pourquoi `data={"route": ...}` ?** Pour le deep linking : tapoter la notif amènera directement à la bonne page.

---

### 7B. Notification quand un congé est approuvé/refusé

**Fichier à modifier :** `targetym-api/app/api/leaves.py`

**Trouver** la fonction d'approbation (ex: `def approve_leave_request` ou endpoint `/approve`).

**Juste APRÈS** le `db.commit()`, ajouter :

```python
from app.services.push_notifications import send_push

# --- Notification push à l'employé ---
if leave.employee and leave.employee.user_id:
    approved = leave.status == "approved"  # ou la variable locale équivalente
    status_label = "approuvée ✅" if approved else "refusée ❌"
    title = f"Congé {'approuvé' if approved else 'refusé'}"
    try:
        send_push(
            db,
            user_ids=[leave.employee.user_id],
            title=title,
            body=f"Votre demande du {leave.start_date.strftime('%d/%m/%Y')} a été {status_label}",
            data={"route": "/dashboard/leaves", "leave_id": leave.id},
            tenant_id=leave.tenant_id,
        )
    except Exception as e:
        logger.error(f"Push notification failed for leave {leave.id}: {e}")
```

---

### 7C. Notification quand une journée est validée/rejetée

**Fichier à modifier :** `targetym-api/app/api/tasks.py` (endpoint `validate_daily` ou équivalent)

**Juste APRÈS** le `db.commit()` qui valide la journée, ajouter :

```python
from app.services.push_notifications import send_push

# --- Notification push à l'employé ---
if validation.employee and validation.employee.user_id:
    approved = validation.status == "approved"
    status_label = "validée ✅" if approved else "rejetée ❌"
    title = f"Journée {'validée' if approved else 'rejetée'}"
    try:
        send_push(
            db,
            user_ids=[validation.employee.user_id],
            title=title,
            body=f"Votre soumission du {validation.date.strftime('%d/%m/%Y')} a été {status_label}",
            data={"route": "/dashboard/my-space/tasks", "validation_id": validation.id},
            tenant_id=validation.tenant_id,
        )
    except Exception as e:
        logger.error(f"Push notification failed for validation {validation.id}: {e}")
```

### Validation globale tâche 7

- [ ] API démarre sans erreur
- [ ] Créer une tâche dans le dashboard fonctionne toujours (n'est pas cassée par les ajouts)
- [ ] Approuver/refuser un congé fonctionne toujours
- [ ] Valider une journée fonctionne toujours

---

## ✅ TÂCHE 8 — Déployer en production

### Intérêt

Tout le code local est inutile tant qu'il n'est pas sur le serveur qui répond à `api.targetym.ai`.

### Étape 8.1 — Commit et push

```bash
cd targetym-api
git add app/models/push_token.py \
        app/models/__init__.py \
        alembic/versions/029_add_push_tokens.py \
        requirements.txt \
        app/services/push_notifications.py \
        app/api/push_tokens.py \
        app/main.py \
        app/api/tasks.py \
        app/api/leaves.py
git commit -m "feat(push): Firebase Cloud Messaging for mobile push notifications"
git push origin main
```

⚠️ Surtout ne PAS committer :
- Le fichier JSON Firebase (`targetym-firebase-adminsdk-*.json`)
- Le fichier `.env` local

### Étape 8.2 — Attendre le CI/CD

GitHub Actions déploiera automatiquement sur AWS ECS.

### Étape 8.3 — Ajouter la variable d'env sur ECS

1. AWS Console → ECS → Task Definitions → **targetym-api**
2. Create new revision
3. Trouver le container principal → Environment variables → **Add**
   - Name : `FIREBASE_CREDENTIALS_JSON`
   - Value : coller le JSON minifié (cf Tâche 4)
4. Create
5. Aller sur le Service ECS → Update → cocher "Force new deployment" → Update

### Étape 8.4 — Appliquer la migration Alembic

⚠️ **NE PAS exécuter au démarrage du conteneur.** Règle du CLAUDE.md Targetym : migrations manuelles.

**Via AWS CloudShell :**

```bash
# Lister les tâches ECS en cours
aws ecs list-tasks --cluster targetym-cluster

# Se connecter à la tâche active
aws ecs execute-command \
  --cluster targetym-cluster \
  --task <TASK_ID_RÉCUPÉRÉ> \
  --container targetym-api \
  --command "/bin/bash" \
  --interactive

# Dans le conteneur
alembic current  # vérifier version actuelle
alembic upgrade head  # appliquer 029
alembic current  # confirmer 029 appliquée
exit
```

**Si `execute-command` n'est pas activé**, alternative via `psql` direct :

```sql
-- Via un client PostgreSQL connecté à RDS
BEGIN;

CREATE TABLE push_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    platform VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_tenant_id ON push_tokens(tenant_id);

-- Marquer la migration comme appliquée
UPDATE alembic_version SET version_num = '029';

COMMIT;
```

### Étape 8.5 — Vérifier les logs

CloudWatch → `/ecs/targetym-api` → chercher :
- `Firebase Admin SDK initialized successfully` ✅

Si `FIREBASE_CREDENTIALS_JSON not set — push disabled` → la variable d'env manque, revoir 8.3.

---

## ✅ TÂCHE 9 — Test end-to-end

### Intérêt

Vérifier que la chaîne complète fonctionne : mobile → backend → Firebase → téléphone.

Chaque étape peut marcher séparément mais la chaîne peut casser entre deux.

### 9.1 — Réinstaller l'app mobile

Sur le téléphone de test :
- Désinstaller Targetym (appui long → désinstaller)
- Réinstaller via APK ou `npx cap run android`
- Se connecter

### 9.2 — Vérifier le register

Logs ECS CloudWatch → chercher `POST /api/push-tokens/register` → **200 OK** (plus de 404)

Vérifier en DB :

```sql
SELECT user_id, platform, last_used_at
FROM push_tokens
ORDER BY created_at DESC
LIMIT 5;
-- Doit contenir une ligne récente avec platform='android'
```

### 9.3 — Tester les 3 événements

| # | Scénario | Action | Résultat attendu |
|---|----------|--------|-------------------|
| 1 | Tâche assignée | Depuis un compte manager, créer une tâche assignée à l'utilisateur de test | Notif sur tél <10s |
| 2 | Congé approuvé | L'utilisateur demande un congé → un manager l'approuve | Notif "Congé approuvé" |
| 3 | Journée rejetée | L'utilisateur soumet sa journée → un manager la rejette | Notif "Journée rejetée" |

### 9.4 — Debugging

Si un test échoue :

1. **Logs ECS CloudWatch** → chercher `Push` → l'erreur est là
2. **En base** → `SELECT * FROM push_tokens` → vérifier qu'il y a bien un token
3. **Firebase Console** → Project Settings → Cloud Messaging → Message history

---

## 📋 CHECKLIST FINALE

| # | Tâche | Validation | ☐/✅ |
|---|-------|------------|------|
| 1 | Modèle `PushToken` créé + import dans `__init__.py` | `from app.models.push_token import PushToken` OK | ☐ |
| 2 | Migration `029_add_push_tokens.py` créée | Fichier existe avec bon numéro | ☐ |
| 3 | `firebase-admin>=6.4.0` dans `requirements.txt` | `pip show firebase-admin` OK | ☐ |
| 4 | `FIREBASE_CREDENTIALS_JSON` en env var ECS | `env` contient la variable | ☐ |
| 5 | Service `app/services/push_notifications.py` créé | Import OK | ☐ |
| 6 | Endpoints `/api/push-tokens/register` + `/unregister` | `curl` → 200 | ☐ |
| 7A | Notif branchée dans `tasks.py` (création tâche) | Notif reçue au test | ☐ |
| 7B | Notif branchée dans `leaves.py` (approve/reject) | Notif reçue au test | ☐ |
| 7C | Notif branchée dans `tasks.py` (validate daily) | Notif reçue au test | ☐ |
| 8 | Déployé en prod + migration appliquée | Logs ECS OK | ☐ |
| 9 | Test end-to-end validé | 3 notifs reçues sur tél | ☐ |

---

## 🆘 Dépannage courant

| Erreur | Cause probable | Solution |
|--------|----------------|----------|
| `FIREBASE_CREDENTIALS_JSON not set` dans logs | Variable d'env manquante sur ECS | Refaire Tâche 4 + redéployer |
| `404 /api/push-tokens/register` | Router pas inclus dans `main.py` | Refaire `app.include_router` en Tâche 6 |
| `relation "push_tokens" does not exist` | Migration non appliquée | Refaire Tâche 8.4 |
| Notif jamais reçue malgré 200 OK | Token obsolète ou téléphone en mode "Ne pas déranger" | Réinstaller l'app, vérifier paramètres notifs Android |
| `messaging.UnregisteredError` dans logs | Token expiré (app désinstallée) | Normal — le code les supprime automatiquement |
| API plante au démarrage | Erreur d'import | Vérifier `from app.models.push_token import PushToken` dans `__init__.py` |

---

## 📞 Contact

Pour toute question bloquante, transmettre via **Fatou**.

### Token FCM de test

Ce token appartient au téléphone de Fatou (valide tant que l'app n'est pas désinstallée) :

```
dZ9HDKc3SsWgaXaZ6Mexfp:APA91bEWzEVpkDFEVb9R4nMoZ-dPwTXn0GdKp72VTEgrVB-c9h85JHmg1K5vTO2m-xL5gyCVg1L_Cl2Rt8oftfO8ZCzancilGEP5uRM3-1XW_q4TL_si0OA
```

**Pour des tests locaux**, insérer manuellement dans la DB de dev :

```sql
INSERT INTO push_tokens (user_id, tenant_id, token, platform, created_at, last_used_at)
VALUES (
    <VOTRE_USER_ID>,
    <VOTRE_TENANT_ID>,
    'dZ9HDKc3SsWgaXaZ6Mexfp:APA91bEWzEVpkDFEVb9R4nMoZ-dPwTXn0GdKp72VTEgrVB-c9h85JHmg1K5vTO2m-xL5gyCVg1L_Cl2Rt8oftfO8ZCzancilGEP5uRM3-1XW_q4TL_si0OA',
    'android',
    NOW(),
    NOW()
);
```

Puis appeler manuellement `send_push()` pour tester.

---

## 🔒 Règles de sécurité à respecter

1. **Isolation tenant** : toute query filtre par `tenant_id` (cohérent avec le reste de Targetym)
2. **Authentification** : les endpoints utilisent `get_current_user` dependency
3. **Secrets** : `FIREBASE_CREDENTIALS_JSON` en variable d'env uniquement, jamais dans Git
4. **Migration manuelle** : pas d'exécution au démarrage, appliquer via CloudShell

---

## 📚 Références

- Documentation Firebase Admin Python : https://firebase.google.com/docs/admin/setup
- Documentation FCM messaging : https://firebase.google.com/docs/cloud-messaging/send-message
- Console Firebase : https://console.firebase.google.com (compte `targetym.playstore@gmail.com`)

---

**Fin du brief.**

Une fois la Tâche 9 validée, prévenir Fatou → elle testera sur son téléphone en conditions réelles.
