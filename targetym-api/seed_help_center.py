"""
Script pour peupler le centre d'aide avec des articles utiles
Usage: python seed_help_center.py
"""
import sys
import os

# Ajouter le répertoire parent au path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.help_center import HelpCategory, HelpArticle


def seed_help_center():
    """Ajoute les catégories et articles d'aide"""
    
    db = SessionLocal()
    
    try:
        # Vérifier si des catégories existent déjà
        existing = db.query(HelpCategory).first()
        
        if existing:
            print("❌ Des catégories existent déjà. Nettoyage...")
            # Supprimer les articles et catégories existants
            db.query(HelpArticle).delete()
            db.query(HelpCategory).delete()
            db.commit()
        
        print("✅ Création des catégories...")
        
        # Créer les catégories
        categories_data = [
            {
                "name": "Premiers Pas",
                "slug": "premiers-pas",
                "icon": "Rocket",
                "description": "Découvrez comment utiliser Targetym pour la première fois",
                "display_order": 1
            },
            {
                "name": "Gestion des Employés",
                "slug": "gestion-employes",
                "icon": "Users",
                "description": "Tout sur la gestion des profils employés, départements et services",
                "display_order": 2
            },
            {
                "name": "Congés et Absences",
                "slug": "conges-absences",
                "icon": "Calendar",
                "description": "Gérer les demandes de congés et suivre les absences",
                "display_order": 3
            },
            {
                "name": "Performance et Évaluations",
                "slug": "performance",
                "icon": "TrendingUp",
                "description": "Évaluations 360°, scores de performance et suivi des objectifs",
                "display_order": 4
            },
            {
                "name": "Formation et Développement",
                "slug": "formation",
                "icon": "GraduationCap",
                "description": "Gestion des formations, certifications et parcours de développement",
                "display_order": 5
            },
            {
                "name": "Recrutement",
                "slug": "recrutement",
                "icon": "Briefcase",
                "description": "Gérer vos offres d'emploi et candidatures",
                "display_order": 6
            },
            {
                "name": "Chat IA et Assistance",
                "slug": "chat-ia",
                "icon": "MessageSquare",
                "description": "Utiliser l'assistant IA pour obtenir des réponses rapides",
                "display_order": 7
            }
        ]
        
        categories = {}
        for cat_data in categories_data:
            category = HelpCategory(**cat_data)
            db.add(category)
            db.flush()  # Pour obtenir l'ID
            categories[cat_data["slug"]] = category.id
        
        db.commit()
        print(f"✅ {len(categories)} catégories créées")
        
        print("✅ Création des articles...")
        
        # Créer les articles
        articles_data = [
            # PREMIERS PAS
            {
                "category_slug": "premiers-pas",
                "title": "Bienvenue sur Targetym - Guide de démarrage rapide",
                "slug": "guide-demarrage-rapide",
                "excerpt": "Découvrez les fonctionnalités essentielles de Targetym en 5 minutes",
                "content": """# Bienvenue sur Targetym ! 🎉

Targetym est votre plateforme complète de gestion des ressources humaines. Ce guide vous aidera à maîtriser les fonctionnalités essentielles.

## 🔑 Première Connexion

1. Utilisez les identifiants fournis par votre administrateur
2. Vous serez invité à changer votre mot de passe lors de la première connexion
3. Complétez votre profil dans **Mon Profil**

## 📊 Le Tableau de Bord

Le tableau de bord vous donne une vue d'ensemble :
- **Statistiques clés** : Employés actifs, congés en attente, taux de présence
- **Graphiques** : Évolution des effectifs, répartition par département
- **Notifications** : Alertes importantes et actions à effectuer

## 🧭 Navigation

La barre latérale (sidebar) vous permet d'accéder à :
- 👥 **Employés** : Gestion des profils
- 📅 **Congés** : Demandes et planning
- 📈 **Performance** : Évaluations et objectifs
- 🎓 **Formation** : Catalogues et inscriptions
- 💬 **Chat IA** : Assistant intelligent

## 💡 Astuces

- Utilisez le **Chat IA** pour poser des questions sur vos données
- Le bouton **Aide & Support** (en bas de la sidebar) vous ramène ici
- Activez les notifications pour ne rien manquer

## 🆘 Besoin d'aide ?

Consultez les autres articles de ce centre d'aide ou contactez votre administrateur.
""",
                "is_published": True,
                "display_order": 1
            },
            {
                "category_slug": "premiers-pas",
                "title": "Comment compléter votre profil employé",
                "slug": "completer-profil-employe",
                "excerpt": "Renseignez vos informations personnelles et professionnelles",
                "content": """# Compléter votre Profil Employé

Un profil complet permet une meilleure gestion RH et facilite la communication dans l'entreprise.

## 📝 Informations Personnelles

1. Accédez à **Mon Profil** depuis la sidebar
2. Renseignez :
   - Nom et prénom
   - Email professionnel
   - Numéro de téléphone
   - Date de naissance
   - Nationalité

## 💼 Informations Professionnelles

- **Poste** : Votre fonction dans l'entreprise
- **Département** : Votre département d'affectation
- **Manager** : Votre responsable hiérarchique
- **Date d'embauche** : Date de début de contrat
- **Type de contrat** : CDI, CDD, Stage, etc.

## 📸 Photo de Profil

Une photo professionnelle aide vos collègues à vous identifier :
1. Cliquez sur l'avatar
2. Téléchargez une photo (format JPG/PNG, max 2MB)
3. Recadrez si nécessaire

## 🔒 Confidentialité

Certaines informations sont visibles uniquement par les RH et votre manager. Vos coordonnées personnelles restent privées.

## ✅ Vérification

Un profil complet est indiqué par une coche verte. Assurez-vous que toutes les informations obligatoires sont renseignées.
""",
                "is_published": True,
                "display_order": 2
            },
            
            # GESTION DES EMPLOYÉS
            {
                "category_slug": "gestion-employes",
                "title": "Ajouter un nouvel employé",
                "slug": "ajouter-nouvel-employe",
                "excerpt": "Guide étape par étape pour créer un profil employé (RH uniquement)",
                "content": """# Ajouter un Nouvel Employé

*Cette fonctionnalité est réservée aux utilisateurs RH et Administrateurs.*

## 🆕 Création d'un Profil

1. Allez dans **Employés** > **Liste des employés**
2. Cliquez sur **+ Ajouter un employé**
3. Remplissez le formulaire :

### Informations Obligatoires
- Nom et prénom
- Email professionnel (unique)
- Poste
- Département
- Date d'embauche
- Type de contrat

### Informations Optionnelles
- Numéro de téléphone
- Adresse
- Nationalité
- Manager direct

## 📧 Invitation

Après création, l'employé reçoit :
- Un email d'invitation
- Un lien pour définir son mot de passe
- Un guide de bienvenue

## 👔 Attribution du Rôle

Définissez les permissions :
- **Employé** : Accès standard
- **Manager** : Gestion d'équipe
- **RH** : Accès complet RH
- **Admin** : Administration système

## 📋 Documents

Vous pouvez attacher :
- Contrat de travail
- Fiche de poste
- Documents d'identité
- Certificats

## ⚠️ Points d'Attention

- L'email doit être unique dans le système
- Le département doit exister au préalable
- Le manager doit avoir le rôle "Manager" ou supérieur
""",
                "is_published": True,
                "display_order": 1
            },
            {
                "category_slug": "gestion-employes",
                "title": "Gérer les départements et services",
                "slug": "gerer-departements-services",
                "excerpt": "Organisation de la structure de l'entreprise",
                "content": """# Gérer les Départements et Services

Organisez votre entreprise en départements et services pour une meilleure visibilité.

## 🏢 Créer un Département

1. Accédez à **Configuration** > **Départements**
2. Cliquez sur **+ Nouveau département**
3. Renseignez :
   - Nom du département
   - Code (ex: IT, RH, COMM)
   - Responsable de département
   - Budget (optionnel)

## 🔀 Affectation d'Employés

Pour affecter un employé :
1. Allez dans le profil de l'employé
2. Section **Informations professionnelles**
3. Sélectionnez le département dans la liste

## 📊 Statistiques par Département

Le système calcule automatiquement :
- Nombre d'employés par département
- Répartition hommes/femmes
- Ancienneté moyenne
- Taux de rotation

## 🔄 Restructuration

Pour modifier l'organisation :
1. Les employés peuvent être transférés entre départements
2. L'historique des affectations est conservé
3. Les statistiques sont recalculées automatiquement

## 💡 Bonnes Pratiques

- Utilisez des codes courts et explicites
- Désignez un responsable pour chaque département
- Revoyez la structure trimestriellement
""",
                "is_published": True,
                "display_order": 2
            },
            
            # CONGÉS ET ABSENCES
            {
                "category_slug": "conges-absences",
                "title": "Faire une demande de congés",
                "slug": "demande-conges",
                "excerpt": "Comment soumettre et suivre vos demandes de congés",
                "content": """# Faire une Demande de Congés

Gérez vos congés facilement depuis la plateforme Targetym.

## 📅 Soumettre une Demande

1. Accédez à **Congés** dans la sidebar
2. Cliquez sur **+ Nouvelle demande**
3. Remplissez le formulaire :
   - **Type de congé** : Payé, RTT, Maladie, Sans solde
   - **Date de début**
   - **Date de fin**
   - **Motif** (optionnel)

## 📝 Types de Congés

- **Congés payés** : Jours de vacances annuels
- **RTT** : Réduction du temps de travail
- **Congé maladie** : Arrêt maladie (certificat requis)
- **Congé sans solde** : Non rémunéré
- **Congé parental** : Naissance, adoption

## ⏱️ Délais

Respectez les délais de prévenance :
- Congés payés : 2 semaines minimum
- RTT : 1 semaine minimum
- Urgences : Contactez votre manager

## 🔔 Suivi de Demande

Vous recevez des notifications :
- ✅ Demande validée
- ❌ Demande refusée (avec motif)
- ⏳ En attente de validation

## 📊 Solde de Congés

Consultez votre solde dans **Mon Profil** :
- Jours acquis
- Jours pris
- Jours en attente
- Solde restant

## 💼 Validation

Selon votre entreprise :
1. **Manager direct** : Validation de premier niveau
2. **RH** : Validation finale (optionnel)

## ⚠️ Annulation

Pour annuler une demande :
- Si non validée : annulation directe
- Si validée : contactez votre manager ou RH
""",
                "is_published": True,
                "display_order": 1
            },
            {
                "category_slug": "conges-absences",
                "title": "Valider les demandes de congés (Managers)",
                "slug": "valider-conges-manager",
                "excerpt": "Guide pour les managers : valider ou refuser les demandes",
                "content": """# Valider les Demandes de Congés

*Guide destiné aux Managers*

## 📥 Recevoir une Demande

Vous êtes notifié par :
- Email
- Notification sur la plateforme
- Badge sur l'icône Congés

## ✅ Processus de Validation

1. Accédez à **Congés** > **Demandes en attente**
2. Consultez les détails :
   - Employé demandeur
   - Type et durée
   - Dates
   - Solde disponible
3. Vérifiez la disponibilité de l'équipe
4. Validez ou refusez

## 🔍 Critères de Décision

Éléments à considérer :
- **Planning d'équipe** : Pas trop d'absences simultanées
- **Charge de travail** : Projets en cours
- **Solde** : Jours disponibles
- **Délai de prévenance** : Respecté ou non

## ❌ Refuser une Demande

Si nécessaire :
1. Cliquez sur **Refuser**
2. **Obligatoire** : Indiquez un motif clair
3. Contactez l'employé pour discuter d'alternatives

## 📊 Vue d'Ensemble

Le planning équipe montre :
- Absences en cours
- Congés planifiés
- Disponibilité par semaine

## 🤝 Communication

Bonnes pratiques :
- Répondez dans les 48h
- Expliquez les refus
- Proposez des alternatives si possible
- Anticipez les périodes chargées

## ⚙️ Délégation

Si absent, déléguez la validation :
1. **Configuration** > **Délégation**
2. Désignez un remplaçant temporaire
""",
                "is_published": True,
                "display_order": 2
            },
            
            # PERFORMANCE
            {
                "category_slug": "performance",
                "title": "Comprendre l'évaluation 360°",
                "slug": "evaluation-360-degres",
                "excerpt": "Tout savoir sur le système d'évaluation à 360 degrés",
                "content": """# Évaluation 360°

L'évaluation 360° permet une appréciation complète des compétences depuis plusieurs perspectives.

## 🎯 Principe

Vous êtes évalué par :
- **Votre manager** (hiérarchique)
- **Vos collègues** (pairs)
- **Vos subordonnés** (si manager)
- **Vous-même** (auto-évaluation)

## 📋 Processus

### 1. Lancement de la Campagne
RH définit :
- Période d'évaluation
- Compétences à évaluer
- Évaluateurs

### 2. Auto-évaluation
- Remplissez votre grille
- Soyez objectif et factuel
- Donnez des exemples concrets

### 3. Évaluation par les Pairs
- Anonyme ou nominative (selon config)
- Sur invitation uniquement
- Délai : généralement 2 semaines

### 4. Synthèse
Manager et RH compilent :
- Notes moyennes
- Écarts perception
- Points forts / axes d'amélioration

## 📊 Critères Évalués

Exemples de compétences :
- Communication
- Travail d'équipe
- Leadership
- Expertise technique
- Gestion du temps
- Créativité

## 🔒 Confidentialité

- Les évaluations individuelles restent anonymes
- Seule la synthèse est partagée
- RH et manager ont accès complet

## 💡 Utilisation des Résultats

Les notes servent à :
- Identifier les besoins en formation
- Définir un plan de développement
- Préparer les promotions
- Ajuster les objectifs

## 📈 Suivi

- Entretien de restitution avec le manager
- Plan d'action personnalisé
- Réévaluation 6-12 mois après
""",
                "is_published": True,
                "display_order": 1
            },
            
            # FORMATION
            {
                "category_slug": "formation",
                "title": "S'inscrire à une formation",
                "slug": "inscription-formation",
                "excerpt": "Comment consulter le catalogue et s'inscrire aux formations",
                "content": """# S'Inscrire à une Formation

Développez vos compétences grâce au catalogue de formations Targetym.

## 📚 Catalogue de Formations

1. Accédez à **Formation** > **Catalogue**
2. Filtrez par :
   - Domaine (technique, management, soft skills)
   - Format (présentiel, e-learning, hybride)
   - Durée
   - Niveau

## 🔍 Détails d'une Formation

Chaque formation affiche :
- **Description** et objectifs
- **Programme** détaillé
- **Prérequis**
- **Durée** et dates disponibles
- **Formateur** et organisme
- **Places disponibles**

## ✍️ Inscription

1. Cliquez sur **S'inscrire**
2. Choisissez une session
3. Validez votre demande
4. Validation manager (selon paramétrage)

## 📧 Confirmation

Vous recevez :
- Email de confirmation
- Convocation (avec lieu/lien)
- Documents pré-formation
- Rappel 48h avant

## 📝 Évaluation Post-Formation

Après la formation :
- Questionnaire de satisfaction
- Quiz d'évaluation des acquis
- Attestation de participation
- Certificat (si formation certifiante)

## 📊 Mon Parcours

Consultez votre historique :
- Formations suivies
- Formations planifiées
- Certificats obtenus
- Temps de formation (jours/an)

## 💡 Demande Personnalisée

Formation non au catalogue ?
1. **Formation** > **Faire une demande**
2. Décrivez vos besoins
3. Validation manager + RH
4. Recherche de prestataire
""",
                "is_published": True,
                "display_order": 1
            },
            
            # RECRUTEMENT
            {
                "category_slug": "recrutement",
                "title": "Publier une offre d'emploi",
                "slug": "publier-offre-emploi",
                "excerpt": "Créer et diffuser une offre d'emploi (RH/Managers)",
                "content": """# Publier une Offre d'Emploi

*Fonctionnalité accessible aux RH et Managers autorisés*

## 📝 Créer une Offre

1. **Recrutement** > **Offres d'emploi** > **+ Nouvelle offre**
2. Remplissez :
   - **Titre du poste**
   - **Département**
   - **Type de contrat**
   - **Lieu de travail**
   - **Salaire** (optionnel)
   - **Description du poste**
   - **Profil recherché**

## 🎯 Description Efficace

Incluez :
- **Missions principales**
- **Responsabilités**
- **Compétences requises**
- **Compétences souhaitées**
- **Avantages** (télétravail, tickets resto, etc.)

## 🌐 Diffusion

L'offre peut être :
- Publiée sur votre site carrière
- Partagée sur les réseaux sociaux
- Envoyée sur les jobboards
- Diffusée en interne

## 📥 Réception des Candidatures

Les candidats peuvent :
- Postuler en ligne
- Uploader CV et lettre motivation
- Répondre à un questionnaire de pré-qualification

## 📊 Suivi des Candidatures

Dashboard de recrutement :
- Nouvelles candidatures
- En cours de traitement
- Entretiens planifiés
- Refusées / Acceptées

## 🤝 Workflow de Validation

1. **Tri CV** : RH présélectionne
2. **Entretien RH** : Premier contact
3. **Entretien Manager** : Évaluation technique
4. **Décision finale** : Embauche ou refus

## 📧 Communication

Templates d'emails disponibles :
- Accusé de réception
- Invitation à entretien
- Refus poli
- Proposition d'embauche
""",
                "is_published": True,
                "display_order": 1
            },
            
            # CHAT IA
            {
                "category_slug": "chat-ia",
                "title": "Utiliser l'assistant IA pour analyser vos données RH",
                "slug": "utiliser-assistant-ia",
                "excerpt": "Posez des questions en langage naturel et obtenez des réponses instantanées",
                "content": """# Assistant IA Targetym

L'assistant IA vous permet d'interroger vos données RH en langage naturel.

## 💬 Accéder au Chat

1. Cliquez sur **Chat IA** dans la sidebar
2. Ou utilisez le bouton flottant 💬 en bas à droite

## 🎯 Que Peut-il Faire ?

### Statistiques et Analyses
- "Combien d'employés dans l'entreprise ?"
- "Quel est le taux de présence ce mois-ci ?"
- "Montre-moi l'évolution des effectifs"

### Congés et Absences
- "Qui est en congé cette semaine ?"
- "Combien de jours de congés me reste-t-il ?"
- "Liste des demandes de congés en attente"

### Performance
- "Quel est le score moyen de mon équipe ?"
- "Montre les employés avec les meilleures évaluations"

### Informations Employés
- "Trouve les employés du département IT"
- "Qui a rejoint l'entreprise ce mois-ci ?"
- "Liste des managers"

## 📊 Graphiques Automatiques

L'IA génère des graphiques pour :
- Évolution temporelle
- Répartitions (camemberts)
- Comparaisons (barres)

## 🔒 Sécurité et Permissions

- Vous **ne voyez que vos données autorisées**
- Managers : données de leur équipe
- RH : vue globale entreprise
- Employés : leurs propres données

## 💡 Astuces

### Questions Efficaces
✅ "Montre-moi les congés de mon équipe en juillet"
✅ "Quel est le taux de turnover cette année ?"
✅ "Liste les formations suivies par Jean Dupont"

### À Éviter
❌ Questions trop vagues : "Dis-moi tout"
❌ Hors périmètre : "Quelle est la météo ?"

## 🚀 Fonctionnalités Avancées

- **Historique** : Vos conversations sont sauvegardées
- **Export** : Exportez les réponses en PDF
- **Suggestions** : L'IA propose des questions pertinentes

## 🆘 Problèmes ?

Si l'IA ne comprend pas :
- Reformulez votre question
- Soyez plus spécifique
- Utilisez des termes métier (département, congé, évaluation)
""",
                "is_published": True,
                "display_order": 1
            },
            {
                "category_slug": "chat-ia",
                "title": "Exemples de questions pour l'assistant IA",
                "slug": "exemples-questions-ia",
                "excerpt": "Liste de questions types pour tirer le meilleur parti de l'IA",
                "content": """# Exemples de Questions pour l'Assistant IA

Voici des exemples concrets de questions que vous pouvez poser à l'assistant IA.

## 👥 Gestion des Employés

**Pour les RH et Managers :**
- "Combien d'employés avons-nous au total ?"
- "Liste les nouveaux employés de ce mois"
- "Qui travaille dans le département Marketing ?"
- "Montre-moi les employés embauchés en 2025"
- "Quel est le ratio hommes/femmes dans l'entreprise ?"

## 📅 Congés et Absences

**Pour tous :**
- "Quel est mon solde de congés ?"
- "Mes congés prévus ce trimestre"

**Pour Managers :**
- "Qui est absent aujourd'hui dans mon équipe ?"
- "Congés planifiés pour la semaine prochaine"
- "Combien de jours de RTT restent dans mon équipe ?"

**Pour RH :**
- "Statistiques des congés de l'année"
- "Demandes de congés en attente de validation"
- "Taux d'absence par département"

## 📈 Performance et Évaluations

**Pour Managers :**
- "Score moyen de performance de mon équipe"
- "Qui a les meilleures évaluations ?"
- "Liste des évaluations à réaliser"

**Pour RH :**
- "Distribution des scores de performance"
- "Employés avec score inférieur à 60%"
- "Taux de complétion des évaluations 360°"

## 🎓 Formations

**Pour tous :**
- "Formations auxquelles je suis inscrit"
- "Certificats que j'ai obtenus"

**Pour RH :**
- "Budget formation consommé cette année"
- "Formations les plus populaires"
- "Taux de participation aux formations"

## 📊 Statistiques RH

**Pour Direction et RH :**
- "Évolution des effectifs sur 12 mois"
- "Taux de turnover cette année"
- "Ancienneté moyenne des employés"
- "Répartition des employés par type de contrat"
- "Graphique de la pyramide des âges"

## 🎯 Objectifs et OKR

**Pour Managers :**
- "Progression des OKR de mon équipe"
- "Objectifs de Jean Dupont pour Q1 2026"

**Pour RH :**
- "Taux d'atteinte des objectifs globaux"
- "Départements avec les meilleurs OKR"

## 💼 Recrutement

**Pour RH :**
- "Offres d'emploi actives"
- "Nombre de candidatures reçues ce mois"
- "Temps moyen de recrutement"
- "Postes les plus difficiles à pourvoir"

## 🔔 Alertes et Notifications

- "Quelles sont mes tâches en attente ?"
- "Notifications non lues"
- "Actions urgentes à traiter"

## 💡 Combiner Plusieurs Critères

L'IA comprend les requêtes complexes :
- "Employés du département IT embauchés en CDI avec plus de 2 ans d'ancienneté"
- "Congés validés en août pour les managers"
- "Formations techniques suivies par les développeurs en 2025"

## 📉 Analyses Comparatives

- "Compare le taux d'absence entre les départements"
- "Évolution du turnover vs année dernière"
- "Performance moyenne par ancienneté"

---

**Astuce** : N'hésitez pas à poser des questions de suivi pour affiner les résultats !
""",
                "is_published": True,
                "display_order": 2
            }
        ]
        
        # Créer les articles
        for article_data in articles_data:
            category_slug = article_data.pop("category_slug")
            article = HelpArticle(
                category_id=categories[category_slug],
                **article_data
            )
            db.add(article)
        
        db.commit()
        print(f"✅ {len(articles_data)} articles créés")
        
        print("\n🎉 Centre d'aide peuplé avec succès!")
        print(f"📚 {len(categories)} catégories")
        print(f"📄 {len(articles_data)} articles")
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_help_center()
