"""
Service d'envoi d'emails avec Resend
"""
import resend
import os
from typing import Optional, List
from datetime import datetime


# Configuration Resend
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@targetym.com")
APP_NAME = os.getenv("APP_NAME", "TARGETYM AI")
APP_URL = os.getenv("APP_URL", "https://app.targetym.com")


def init_resend():
    """Initialiser Resend avec la clé API"""
    if RESEND_API_KEY:
        resend.api_key = RESEND_API_KEY
    else:
        print("⚠️ RESEND_API_KEY non configurée - emails désactivés")


def send_invitation_email(
    to_email: str,
    first_name: str,
    company_name: str,
    temp_password: str,
    login_url: Optional[str] = None
) -> dict:
    """
    Envoyer un email d'invitation à un nouvel employé
    
    Args:
        to_email: Email du destinataire
        first_name: Prénom de l'employé
        company_name: Nom de l'entreprise
        temp_password: Mot de passe temporaire
        login_url: URL de connexion (optionnel)
    
    Returns:
        dict avec id de l'email envoyé ou erreur
    """
    if not RESEND_API_KEY:
        return {"error": "RESEND_API_KEY non configurée", "sent": False}
    
    init_resend()
    
    login_link = login_url or "https://www.targetym.ai/login"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitation {APP_NAME}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 40px 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">
                                    🎉 Bienvenue sur {APP_NAME}
                                </h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px;">
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                    Bonjour <strong>{first_name}</strong>,
                                </p>
                                
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                    Vous avez été invité(e) à rejoindre <strong>{company_name}</strong> sur {APP_NAME}, 
                                    la plateforme de gestion RH nouvelle génération.
                                </p>
                                
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                                    Voici vos identifiants de connexion :
                                </p>
                                
                                <!-- Credentials Box -->
                                <div style="background-color: #F3F4F6; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td style="padding-bottom: 12px;">
                                                <span style="color: #6B7280; font-size: 14px;">Email :</span><br>
                                                <strong style="color: #111827; font-size: 16px;">{to_email}</strong>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <span style="color: #6B7280; font-size: 14px;">Mot de passe temporaire :</span><br>
                                                <strong style="color: #111827; font-size: 18px; font-family: monospace; background-color: #ffffff; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 4px;">{temp_password}</strong>
                                            </td>
                                        </tr>
                                    </table>
                                </div>
                                
                                <!-- CTA Button -->
                                <div style="text-align: center; margin-bottom: 30px;">
                                    <a href="{login_link}" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                                        Se connecter maintenant
                                    </a>
                                </div>
                                
                                <!-- Security Note -->
                                <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
                                    <p style="color: #92400E; font-size: 14px; margin: 0;">
                                        <strong>🔒 Sécurité :</strong> Nous vous recommandons de changer votre mot de passe dès votre première connexion.
                                    </p>
                                </div>
                                
                                <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0;">
                                    Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #F9FAFB; padding: 24px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #E5E7EB;">
                                <p style="color: #9CA3AF; font-size: 12px; margin: 0; text-align: center;">
                                    © {datetime.now().year} {APP_NAME}. Tous droits réservés.<br>
                                    Cet email a été envoyé automatiquement, merci de ne pas y répondre.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    text_content = f"""
Bienvenue sur {APP_NAME}

Bonjour {first_name},

Vous avez été invité(e) à rejoindre {company_name} sur {APP_NAME}.

Vos identifiants de connexion :
- Email : {to_email}
- Mot de passe temporaire : {temp_password}

Connectez-vous ici : {login_link}

🔒 Sécurité : Nous vous recommandons de changer votre mot de passe dès votre première connexion.

Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.

---
© {datetime.now().year} {APP_NAME}. Tous droits réservés.
    """
    
    try:
        params = {
            "from": f"{APP_NAME} <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": f"🎉 Invitation à rejoindre {company_name} sur {APP_NAME}",
            "html": html_content,
            "text": text_content,
        }
        
        email = resend.Emails.send(params)
        
        return {
            "sent": True,
            "id": email.get("id"),
            "to": to_email
        }
        
    except Exception as e:
        print(f"❌ Erreur envoi email: {str(e)}")
        return {
            "sent": False,
            "error": str(e),
            "to": to_email
        }


def send_password_reset_email(
    to_email: str,
    first_name: str,
    reset_token: str,
    reset_url: Optional[str] = None
) -> dict:
    """
    Envoyer un email de réinitialisation de mot de passe
    """
    if not RESEND_API_KEY:
        return {"error": "RESEND_API_KEY non configurée", "sent": False}
    
    init_resend()
    
    reset_link = reset_url or f"{APP_URL}/reset-password?token={reset_token}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Réinitialisation mot de passe</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <tr>
                            <td style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">
                                    🔐 Réinitialisation du mot de passe
                                </h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 40px;">
                                <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                                    Bonjour <strong>{first_name}</strong>,
                                </p>
                                <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                                    Vous avez demandé la réinitialisation de votre mot de passe. 
                                    Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :
                                </p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="{reset_link}" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                                        Réinitialiser mon mot de passe
                                    </a>
                                </div>
                                <p style="color: #6B7280; font-size: 14px;">
                                    Ce lien expirera dans 24 heures. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="background-color: #F9FAFB; padding: 24px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #E5E7EB;">
                                <p style="color: #9CA3AF; font-size: 12px; margin: 0; text-align: center;">
                                    © {datetime.now().year} {APP_NAME}. Tous droits réservés.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    try:
        params = {
            "from": f"{APP_NAME} <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": f"🔐 Réinitialisation de votre mot de passe {APP_NAME}",
            "html": html_content,
        }
        
        email = resend.Emails.send(params)
        
        return {
            "sent": True,
            "id": email.get("id"),
            "to": to_email
        }
        
    except Exception as e:
        print(f"❌ Erreur envoi email reset: {str(e)}")
        return {
            "sent": False,
            "error": str(e)
        }


def send_trial_activation_email(
    to_email: str,
    first_name: str,
    company_name: str,
    trial_days: int = 30,
    login_url: Optional[str] = None
) -> dict:
    """
    Envoyer un email de bienvenue lors de l'activation du trial
    par le back-office (super-admin).
    """
    if not RESEND_API_KEY:
        return {"error": "RESEND_API_KEY non configurée", "sent": False}

    init_resend()

    login_link = login_url or f"{APP_URL}/login"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Compte activé — {APP_NAME}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <tr>
                            <td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">
                                    Votre compte est activé !
                                </h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 40px;">
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                    Bonjour <strong>{first_name}</strong>,
                                </p>
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                    Bonne nouvelle ! Votre espace <strong>{company_name}</strong> sur {APP_NAME}
                                    a été validé et activé par notre équipe.
                                </p>
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                    Vous disposez d'un <strong>essai gratuit de {trial_days} jours</strong> avec
                                    accès complet à toutes les fonctionnalités Premium :
                                </p>
                                <ul style="color: #374151; font-size: 15px; line-height: 1.8; margin: 0 0 24px; padding-left: 20px;">
                                    <li>Recrutement &amp; Onboarding</li>
                                    <li>Gestion du Personnel &amp; Congés</li>
                                    <li>OKR &amp; Objectifs</li>
                                    <li>Formation &amp; Développement</li>
                                    <li>Performance &amp; Feedback</li>
                                    <li>People Analytics</li>
                                    <li>Jusqu'à 50 employés</li>
                                </ul>
                                <div style="text-align: center; margin-bottom: 30px;">
                                    <a href="{login_link}" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                                        Se connecter maintenant
                                    </a>
                                </div>
                                <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0;">
                                    Votre essai expirera dans {trial_days} jours. Vous serez notifié avant
                                    l'échéance pour choisir le plan qui convient à votre entreprise.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="background-color: #F9FAFB; padding: 24px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #E5E7EB;">
                                <p style="color: #9CA3AF; font-size: 12px; margin: 0; text-align: center;">
                                    &copy; {datetime.now().year} {APP_NAME}. Tous droits réservés.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    try:
        params = {
            "from": f"{APP_NAME} <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": f"Votre espace {company_name} est activé — {APP_NAME}",
            "html": html_content,
        }

        email = resend.Emails.send(params)

        return {
            "sent": True,
            "id": email.get("id"),
            "to": to_email
        }

    except Exception as e:
        print(f"Erreur envoi email activation trial: {str(e)}")
        return {
            "sent": False,
            "error": str(e),
            "to": to_email
        }


def send_welcome_reminder_email(
    to_email: str,
    first_name: str,
    company_name: str,
    days_since_invitation: int
) -> dict:
    """
    Envoyer un rappel d'invitation (relance)
    """
    if not RESEND_API_KEY:
        return {"error": "RESEND_API_KEY non configurée", "sent": False}
    
    init_resend()
    
    login_link = f"{APP_URL}/login"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Rappel d'invitation</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <tr>
                            <td style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">
                                    ⏰ Rappel : Votre accès vous attend !
                                </h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 40px;">
                                <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                                    Bonjour <strong>{first_name}</strong>,
                                </p>
                                <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                                    Il y a {days_since_invitation} jours, vous avez reçu une invitation à rejoindre 
                                    <strong>{company_name}</strong> sur {APP_NAME}.
                                </p>
                                <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                                    Votre compte est prêt et n'attend que vous ! Connectez-vous pour découvrir 
                                    vos objectifs, vos tâches et collaborer avec votre équipe.
                                </p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="{login_link}" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                                        Se connecter maintenant
                                    </a>
                                </div>
                                <p style="color: #6B7280; font-size: 14px;">
                                    Si vous avez oublié votre mot de passe, utilisez la fonction "Mot de passe oublié" sur la page de connexion.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="background-color: #F9FAFB; padding: 24px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #E5E7EB;">
                                <p style="color: #9CA3AF; font-size: 12px; margin: 0; text-align: center;">
                                    © {datetime.now().year} {APP_NAME}. Tous droits réservés.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    try:
        params = {
            "from": f"{APP_NAME} <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": f"⏰ Rappel : Votre accès à {company_name} vous attend !",
            "html": html_content,
        }
        
        email = resend.Emails.send(params)
        
        return {
            "sent": True,
            "id": email.get("id"),
            "to": to_email
        }
        
    except Exception as e:
        print(f"❌ Erreur envoi rappel: {str(e)}")
        return {
            "sent": False,
            "error": str(e)
        }


def send_tenant_welcome_email(
    to_email: str,
    company_name: str,
    admin_first_name: str,
    trial_ends_at: datetime,
    login_url: Optional[str] = None
) -> dict:
    """
    Envoyer un email de bienvenue à l'admin d'un tenant lors de l'activation back-office.

    Args:
        to_email: Email de l'admin principal
        company_name: Nom de l'entreprise
        admin_first_name: Prénom de l'administrateur
        trial_ends_at: Date de fin de la période d'essai
        login_url: URL de connexion (optionnel)

    Returns:
        dict avec id de l'email ou erreur
    """
    if not RESEND_API_KEY:
        print("⚠️ RESEND_API_KEY non configurée - email bienvenue tenant non envoyé")
        return {"error": "RESEND_API_KEY non configurée", "sent": False}

    init_resend()

    login_link = login_url or f"{APP_URL}/login"
    trial_date_str = trial_ends_at.strftime("%d/%m/%Y")

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenue sur {APP_NAME}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
                                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">{APP_NAME}</h1>
                                <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0 0; font-size: 16px;">Votre compte est activé 🎉</p>
                            </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                            <td style="background-color: #ffffff; padding: 40px;">
                                <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
                                    Bonjour <strong>{admin_first_name}</strong>,
                                </p>
                                <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
                                    Nous avons le plaisir de vous informer que le compte de votre entreprise
                                    <strong>{company_name}</strong> sur <strong>{APP_NAME}</strong> est désormais activé.
                                </p>
                                <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
                                    Votre période d'essai de <strong>30 jours</strong> a démarré et se termine le <strong>{trial_date_str}</strong>.
                                </p>
                                <!-- CTA -->
                                <table cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
                                    <tr>
                                        <td align="center">
                                            <a href="{login_link}"
                                               style="background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; padding: 14px 36px;
                                                      border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                                                Accéder à ma plateforme →
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
                                <p style="color: #6B7280; font-size: 14px; margin: 0;">
                                    Pour toute question, contactez notre support :
                                    <a href="mailto:support@agiltym.com" style="color: #4F46E5;">support@agiltym.com</a>
                                    ou WhatsApp : <strong>+221 787 100 606</strong>
                                </p>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #F9FAFB; padding: 24px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #E5E7EB;">
                                <p style="color: #9CA3AF; font-size: 12px; margin: 0; text-align: center;">
                                    © {datetime.now().year} {APP_NAME}. Tous droits réservés.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    try:
        params = {
            "from": f"{APP_NAME} <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": f"🎉 Bienvenue sur {APP_NAME} — Votre accès est activé !",
            "html": html_content,
        }
        email = resend.Emails.send(params)
        print(f"✅ Email bienvenue tenant envoyé à {to_email}")
        return {"sent": True, "id": email.get("id"), "to": to_email}

    except Exception as e:
        print(f"❌ Erreur envoi email bienvenue tenant: {str(e)}")
        return {"sent": False, "error": str(e)}


# ============================================================
# HELPERS
# ============================================================

def _email_header(title: str, subtitle: str = "", color: str = "#3B82F6") -> str:
    return f"""
    <tr>
        <td style="background: linear-gradient(135deg, {color} 0%, #1D4ED8 100%); padding: 36px 40px 28px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">{title}</h1>
            {"" if not subtitle else f'<p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">{subtitle}</p>'}
        </td>
    </tr>"""


def _email_footer() -> str:
    return f"""
    <tr>
        <td style="background-color: #F9FAFB; padding: 20px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #E5E7EB;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0; text-align: center;">
                &copy; {datetime.now().year} {APP_NAME} &mdash; Cet email est généré automatiquement.
            </p>
        </td>
    </tr>"""


def _wrap_email(rows: str) -> str:
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    {rows}
    </table></td></tr></table></body></html>"""


def _send(to_email: str, subject: str, html: str, label: str = "email",
          attachments: Optional[list] = None) -> dict:
    if not RESEND_API_KEY:
        return {"error": "RESEND_API_KEY non configurée", "sent": False}
    init_resend()
    try:
        payload: dict = {
            "from": f"{APP_NAME} <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
        if attachments:
            payload["attachments"] = attachments
        result = resend.Emails.send(payload)
        print(f"✅ {label} envoyé à {to_email}")
        return {"sent": True, "id": result.get("id"), "to": to_email}
    except Exception as e:
        print(f"❌ Erreur {label}: {e}")
        return {"sent": False, "error": str(e)}


# ============================================================
# EMAIL D'ACCÈS EMPLOYÉ
# ============================================================

def send_access_ready_email(
    to_email: str,
    first_name: str,
    company_name: str,
    temp_password: str,
) -> dict:
    """Email envoyé à l'employé quand son accès est activé par RH/Admin."""
    login_url = "https://dashboard.targetym.ai"
    html = _wrap_email(
        _email_header("Vos accès TARGETYM AI sont prêts", company_name, "#3B82F6") +
        f"""<tr><td style="padding:36px 40px;">
        <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">Bonjour <strong>{first_name}</strong>,</p>
        <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
            Votre compte <strong>{APP_NAME}</strong> au sein de <strong>{company_name}</strong> vient d'être activé.
            Voici vos identifiants de connexion :
        </p>
        <div style="background:#F3F4F6;border-radius:8px;padding:24px;margin-bottom:28px;">
            <p style="margin:0 0 12px;"><span style="color:#6B7280;font-size:14px;">URL de connexion :</span><br>
            <a href="{login_url}" style="color:#3B82F6;font-weight:600;">{login_url}</a></p>
            <p style="margin:0 0 12px;"><span style="color:#6B7280;font-size:14px;">Email :</span><br>
            <strong style="color:#111827;">{to_email}</strong></p>
            <p style="margin:0;"><span style="color:#6B7280;font-size:14px;">Mot de passe temporaire :</span><br>
            <strong style="font-family:monospace;font-size:18px;background:#fff;padding:6px 12px;border-radius:4px;display:inline-block;margin-top:4px;color:#111827;">{temp_password}</strong></p>
        </div>
        <div style="text-align:center;margin-bottom:24px;">
            <a href="{login_url}" style="display:inline-block;background:linear-gradient(135deg,#3B82F6 0%,#1D4ED8 100%);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:600;">
                Se connecter maintenant
            </a>
        </div>
        <div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:14px 16px;border-radius:0 8px 8px 0;">
            <p style="color:#92400E;font-size:14px;margin:0;">
                <strong>Sécurité :</strong> Veuillez changer votre mot de passe dès votre première connexion.
            </p>
        </div>
        </td></tr>""" +
        _email_footer()
    )
    return _send(to_email, f"Vos accès {APP_NAME} sont prêts — {company_name}", html, "accès employé")


# ============================================================
# CONGÉS
# ============================================================

def send_leave_decision_email(
    to_email: str,
    first_name: str,
    approved: bool,
    leave_type: str,
    start_date: str,
    end_date: str,
    days: float,
    rejection_reason: Optional[str] = None,
) -> dict:
    """Email à l'employé lors de l'approbation ou du refus de sa demande de congé."""
    if approved:
        color, icon, title, body_extra = "#10B981", "✅", "Congé approuvé", ""
    else:
        color, icon, title = "#EF4444", "❌", "Demande de congé refusée"
        reason_html = f'<p style="color:#374151;font-size:15px;margin:16px 0 0;"><strong>Motif du refus :</strong> {rejection_reason}</p>' if rejection_reason else ""
        body_extra = reason_html

    html = _wrap_email(
        _email_header(f"{icon} {title}", leave_type, color) +
        f"""<tr><td style="padding:36px 40px;">
        <p style="color:#374151;font-size:16px;margin:0 0 16px;">Bonjour <strong>{first_name}</strong>,</p>
        <p style="color:#374151;font-size:16px;margin:0 0 20px;">
            {"Votre demande de congé a été <strong>approuvée</strong>." if approved else "Votre demande de congé a été <strong>refusée</strong>."}
        </p>
        <div style="background:#F3F4F6;border-radius:8px;padding:20px 24px;margin-bottom:20px;">
            <p style="margin:0 0 8px;color:#374151;"><strong>Type :</strong> {leave_type}</p>
            <p style="margin:0 0 8px;color:#374151;"><strong>Période :</strong> {start_date} → {end_date}</p>
            <p style="margin:0;color:#374151;"><strong>Durée :</strong> {days} jour(s)</p>
        </div>
        {body_extra}
        </td></tr>""" +
        _email_footer()
    )
    subject = f"{'Congé approuvé' if approved else 'Congé refusé'} — {leave_type} ({start_date})"
    return _send(to_email, subject, html, "décision congé")


def send_leave_request_manager_email(
    to_email: str,
    manager_first_name: str,
    employee_name: str,
    leave_type: str,
    start_date: str,
    end_date: str,
    days: float,
    reason: Optional[str] = None,
    dashboard_url: str = "https://dashboard.targetym.ai",
) -> dict:
    """Email au manager lors d'une nouvelle demande de congé."""
    reason_html = f'<p style="color:#374151;font-size:14px;margin:12px 0 0;"><strong>Motif :</strong> {reason}</p>' if reason else ""
    html = _wrap_email(
        _email_header("Nouvelle demande de congé", f"À valider pour {employee_name}", "#F59E0B") +
        f"""<tr><td style="padding:36px 40px;">
        <p style="color:#374151;font-size:16px;margin:0 0 16px;">Bonjour <strong>{manager_first_name}</strong>,</p>
        <p style="color:#374151;font-size:16px;margin:0 0 20px;">
            <strong>{employee_name}</strong> a soumis une demande de congé en attente de votre validation.
        </p>
        <div style="background:#F3F4F6;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
            <p style="margin:0 0 8px;color:#374151;"><strong>Type :</strong> {leave_type}</p>
            <p style="margin:0 0 8px;color:#374151;"><strong>Période :</strong> {start_date} → {end_date}</p>
            <p style="margin:0;color:#374151;"><strong>Durée :</strong> {days} jour(s)</p>
            {reason_html}
        </div>
        <div style="text-align:center;">
            <a href="{dashboard_url}/dashboard/leaves" style="display:inline-block;background:linear-gradient(135deg,#F59E0B 0%,#D97706 100%);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                Traiter la demande
            </a>
        </div>
        </td></tr>""" +
        _email_footer()
    )
    return _send(to_email, f"Demande de congé de {employee_name} — À valider", html, "demande congé manager")


# ============================================================
# SANCTIONS
# ============================================================

def send_sanction_notification_email(
    to_email: str,
    first_name: str,
    sanction_type: str,
    sanction_date: str,
    reason: str,
    notes: Optional[str] = None,
    attachment_bytes: Optional[bytes] = None,
    attachment_filename: Optional[str] = None,
) -> dict:
    """Email à l'employé lors de la création d'une sanction."""
    notes_html = f'<p style="color:#374151;font-size:14px;margin:12px 0 0;"><strong>Observations :</strong> {notes}</p>' if notes else ""
    html = _wrap_email(
        _email_header("Notification de sanction disciplinaire", "", "#EF4444") +
        f"""<tr><td style="padding:36px 40px;">
        <p style="color:#374151;font-size:16px;margin:0 0 16px;">Bonjour <strong>{first_name}</strong>,</p>
        <p style="color:#374151;font-size:16px;margin:0 0 20px;">
            Nous vous informons qu'une sanction disciplinaire a été enregistrée dans votre dossier.
        </p>
        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:20px 24px;margin-bottom:20px;">
            <p style="margin:0 0 8px;color:#374151;"><strong>Type de sanction :</strong> {sanction_type}</p>
            <p style="margin:0 0 8px;color:#374151;"><strong>Date :</strong> {sanction_date}</p>
            <p style="margin:0;color:#374151;"><strong>Motif :</strong> {reason}</p>
            {notes_html}
        </div>
        <p style="color:#6B7280;font-size:14px;">
            Pour toute question, veuillez vous rapprocher de votre responsable RH.
        </p>
        </td></tr>""" +
        _email_footer()
    )
    attachments = None
    if attachment_bytes and attachment_filename:
        import base64 as _b64
        attachments = [{
            "filename": attachment_filename,
            "content": _b64.b64encode(attachment_bytes).decode("utf-8"),
        }]
    return _send(to_email, f"Notification — {sanction_type} enregistré(e)", html, "notification sanction", attachments=attachments)


# ============================================================
# MISSIONS
# ============================================================

def send_mission_decision_email(
    to_email: str,
    first_name: str,
    mission_title: str,
    approved: bool,
    stage: str,
    comments: Optional[str] = None,
    rejection_reason: Optional[str] = None,
) -> dict:
    """Email à l'employé lors de la validation/rejet d'une mission."""
    if approved:
        color, icon = "#10B981", "✅"
        status_text = "approuvée" if stage == "rh" else "validée par votre manager"
    else:
        color, icon = "#EF4444", "❌"
        status_text = "refusée"

    detail_html = ""
    if not approved and rejection_reason:
        detail_html += f'<p style="color:#374151;font-size:14px;margin:12px 0 0;"><strong>Motif :</strong> {rejection_reason}</p>'
    if comments:
        detail_html += f'<p style="color:#374151;font-size:14px;margin:8px 0 0;"><strong>Commentaire :</strong> {comments}</p>'

    html = _wrap_email(
        _email_header(f"{icon} Mission {status_text}", mission_title, color) +
        f"""<tr><td style="padding:36px 40px;">
        <p style="color:#374151;font-size:16px;margin:0 0 16px;">Bonjour <strong>{first_name}</strong>,</p>
        <p style="color:#374151;font-size:16px;margin:0 0 20px;">
            Votre demande de mission <strong>« {mission_title} »</strong> a été <strong>{status_text}</strong>.
        </p>
        {detail_html}
        </td></tr>""" +
        _email_footer()
    )
    subject = f"Mission {'approuvée' if approved else 'refusée'} — {mission_title}"
    return _send(to_email, subject, html, "décision mission")


# ============================================================
# TÂCHES
# ============================================================

def send_task_assigned_email(
    to_email: str,
    first_name: str,
    task_title: str,
    due_date: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_by: Optional[str] = None,
    dashboard_url: str = "https://dashboard.targetym.ai",
) -> dict:
    """Email à l'employé lors de l'assignation d'une tâche."""
    priority_labels = {"high": "Haute", "medium": "Moyenne", "low": "Basse"}
    details = []
    if assigned_by:
        details.append(f'<p style="margin:0 0 8px;color:#374151;"><strong>Assignée par :</strong> {assigned_by}</p>')
    if due_date:
        details.append(f'<p style="margin:0 0 8px;color:#374151;"><strong>Échéance :</strong> {due_date}</p>')
    if priority:
        details.append(f'<p style="margin:0;color:#374151;"><strong>Priorité :</strong> {priority_labels.get(priority, priority)}</p>')

    html = _wrap_email(
        _email_header("Nouvelle tâche assignée", task_title, "#8B5CF6") +
        f"""<tr><td style="padding:36px 40px;">
        <p style="color:#374151;font-size:16px;margin:0 0 16px;">Bonjour <strong>{first_name}</strong>,</p>
        <p style="color:#374151;font-size:16px;margin:0 0 20px;">
            Une nouvelle tâche vous a été assignée : <strong>« {task_title} »</strong>
        </p>
        <div style="background:#F3F4F6;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
            {"".join(details)}
        </div>
        <div style="text-align:center;">
            <a href="{dashboard_url}/dashboard/tasks" style="display:inline-block;background:linear-gradient(135deg,#8B5CF6 0%,#6D28D9 100%);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                Voir mes tâches
            </a>
        </div>
        </td></tr>""" +
        _email_footer()
    )
    return _send(to_email, f"Tâche assignée — {task_title}", html, "tâche assignée")


# ============================================================
# FORMATIONS
# ============================================================

def send_training_assigned_email(
    to_email: str,
    first_name: str,
    course_title: str,
    deadline: Optional[str] = None,
    assigned_by: Optional[str] = None,
    dashboard_url: str = "https://dashboard.targetym.ai",
) -> dict:
    """Email à l'employé lors de l'assignation d'une formation."""
    details = []
    if assigned_by:
        details.append(f'<p style="margin:0 0 8px;color:#374151;"><strong>Assignée par :</strong> {assigned_by}</p>')
    if deadline:
        details.append(f'<p style="margin:0;color:#374151;"><strong>Date limite :</strong> {deadline}</p>')

    html = _wrap_email(
        _email_header("Formation assignée", course_title, "#0EA5E9") +
        f"""<tr><td style="padding:36px 40px;">
        <p style="color:#374151;font-size:16px;margin:0 0 16px;">Bonjour <strong>{first_name}</strong>,</p>
        <p style="color:#374151;font-size:16px;margin:0 0 20px;">
            Une nouvelle formation vous a été assignée : <strong>« {course_title} »</strong>
        </p>
        {"" if not details else f'<div style="background:#F3F4F6;border-radius:8px;padding:20px 24px;margin-bottom:24px;">{"".join(details)}</div>'}
        <div style="text-align:center;">
            <a href="{dashboard_url}/dashboard/training" style="display:inline-block;background:linear-gradient(135deg,#0EA5E9 0%,#0369A1 100%);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                Accéder à ma formation
            </a>
        </div>
        </td></tr>""" +
        _email_footer()
    )
    return _send(to_email, f"Nouvelle formation — {course_title}", html, "formation assignée")


# ============================================================
# RECRUTEMENT — ENTRETIENS
# ============================================================

def send_interview_scheduled_email(
    to_email: str,
    recipient_name: str,
    candidate_name: str,
    job_title: str,
    interview_type: str,
    scheduled_at: str,
    location: Optional[str] = None,
    meeting_link: Optional[str] = None,
    is_candidate: bool = True,
) -> dict:
    """Email au candidat et aux interviewers lors de la planification d'un entretien."""
    type_labels = {"phone": "téléphonique", "video": "vidéo", "onsite": "sur site", "technical": "technique"}
    type_label = type_labels.get(interview_type, interview_type)

    location_html = f'<p style="margin:0 0 8px;color:#374151;"><strong>Lieu :</strong> {location}</p>' if location else ""
    link_html = f'<p style="margin:0;color:#374151;"><strong>Lien :</strong> <a href="{meeting_link}" style="color:#3B82F6;">{meeting_link}</a></p>' if meeting_link else ""

    if is_candidate:
        intro = f"Un entretien <strong>{type_label}</strong> a été planifié pour le poste de <strong>{job_title}</strong>."
    else:
        intro = f"Vous êtes convié(e) à mener un entretien <strong>{type_label}</strong> avec le candidat <strong>{candidate_name}</strong> pour le poste <strong>{job_title}</strong>."

    html = _wrap_email(
        _email_header("Entretien planifié", f"{job_title} — {candidate_name}", "#6366F1") +
        f"""<tr><td style="padding:36px 40px;">
        <p style="color:#374151;font-size:16px;margin:0 0 16px;">Bonjour <strong>{recipient_name}</strong>,</p>
        <p style="color:#374151;font-size:16px;margin:0 0 20px;">{intro}</p>
        <div style="background:#F3F4F6;border-radius:8px;padding:20px 24px;margin-bottom:20px;">
            <p style="margin:0 0 8px;color:#374151;"><strong>Date & heure :</strong> {scheduled_at}</p>
            <p style="margin:0 0 8px;color:#374151;"><strong>Type :</strong> Entretien {type_label}</p>
            {location_html}
            {link_html}
        </div>
        </td></tr>""" +
        _email_footer()
    )
    subject = f"Entretien planifié — {job_title} le {scheduled_at[:10]}"
    return _send(to_email, subject, html, "entretien planifié")


def send_hired_email(
    to_email: str,
    candidate_name: str,
    job_title: str,
    company_name: str,
) -> dict:
    """Email de félicitations au candidat embauché."""
    html = _wrap_email(
        _email_header("Félicitations — Offre acceptée !", company_name, "#10B981") +
        f"""<tr><td style="padding:36px 40px;">
        <p style="color:#374151;font-size:16px;margin:0 0 16px;">Bonjour <strong>{candidate_name}</strong>,</p>
        <p style="color:#374151;font-size:16px;margin:0 0 20px;">
            Nous sommes ravis de vous accueillir au sein de <strong>{company_name}</strong> !<br>
            Votre candidature pour le poste de <strong>{job_title}</strong> a été retenue.
        </p>
        <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:20px 24px;margin-bottom:20px;">
            <p style="margin:0;color:#065F46;font-size:16px;font-weight:600;">
                Bienvenue dans l'équipe ! Vous recevrez prochainement les informations pour votre intégration.
            </p>
        </div>
        </td></tr>""" +
        _email_footer()
    )
    return _send(to_email, f"Bienvenue chez {company_name} — {job_title}", html, "candidat embauché")


# ============================================================
# ONBOARDING
# ============================================================

def send_onboarding_email(
    to_email: str,
    first_name: str,
    company_name: str,
    program_name: Optional[str] = None,
    start_date: Optional[str] = None,
    dashboard_url: str = "https://dashboard.targetym.ai",
) -> dict:
    """Email à l'employé lors du démarrage de son programme d'onboarding."""
    program_html = f'<p style="margin:0 0 8px;color:#374151;"><strong>Programme :</strong> {program_name}</p>' if program_name else ""
    date_html = f'<p style="margin:0;color:#374151;"><strong>Date de début :</strong> {start_date}</p>' if start_date else ""

    html = _wrap_email(
        _email_header("Votre programme d'intégration démarre !", company_name, "#F97316") +
        f"""<tr><td style="padding:36px 40px;">
        <p style="color:#374151;font-size:16px;margin:0 0 16px;">Bonjour <strong>{first_name}</strong>,</p>
        <p style="color:#374151;font-size:16px;margin:0 0 20px;">
            Bienvenue ! Votre programme d'intégration au sein de <strong>{company_name}</strong> a été activé.
            Suivez vos étapes d'onboarding directement sur la plateforme.
        </p>
        {"" if not (program_html or date_html) else f'<div style="background:#F3F4F6;border-radius:8px;padding:20px 24px;margin-bottom:24px;">{program_html}{date_html}</div>'}
        <div style="text-align:center;">
            <a href="{dashboard_url}/my-space/onboarding" style="display:inline-block;background:linear-gradient(135deg,#F97316 0%,#EA580C 100%);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                Voir mon onboarding
            </a>
        </div>
        </td></tr>""" +
        _email_footer()
    )
    return _send(to_email, f"Votre intégration démarre — {company_name}", html, "onboarding")


# ============================================================
# OKR
# ============================================================

def send_okr_assigned_email(
    to_email: str,
    first_name: str,
    objective_title: str,
    period: Optional[str] = None,
    end_date: Optional[str] = None,
    assigned_by: Optional[str] = None,
    dashboard_url: str = "https://dashboard.targetym.ai",
) -> dict:
    """Email à l'employé lors de l'assignation d'un objectif."""
    details = []
    if assigned_by:
        details.append(f'<p style="margin:0 0 8px;color:#374151;"><strong>Assigné par :</strong> {assigned_by}</p>')
    if period:
        details.append(f'<p style="margin:0 0 8px;color:#374151;"><strong>Période :</strong> {period}</p>')
    if end_date:
        details.append(f'<p style="margin:0;color:#374151;"><strong>Date d\'échéance :</strong> {end_date}</p>')

    html = _wrap_email(
        _email_header("Nouvel objectif assigné", objective_title, "#6366F1") +
        f"""<tr><td style="padding:36px 40px;">
        <p style="color:#374151;font-size:16px;margin:0 0 16px;">Bonjour <strong>{first_name}</strong>,</p>
        <p style="color:#374151;font-size:16px;margin:0 0 20px;">
            Un nouvel objectif vous a été assigné : <strong>« {objective_title} »</strong>
        </p>
        {"" if not details else f'<div style="background:#F3F4F6;border-radius:8px;padding:20px 24px;margin-bottom:24px;">{"".join(details)}</div>'}
        <div style="text-align:center;">
            <a href="{dashboard_url}/dashboard/okr" style="display:inline-block;background:linear-gradient(135deg,#6366F1 0%,#4338CA 100%);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                Voir mes objectifs
            </a>
        </div>
        </td></tr>""" +
        _email_footer()
    )
    return _send(to_email, f"Nouvel objectif — {objective_title}", html, "OKR assigné")
