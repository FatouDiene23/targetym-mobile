from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database — obligatoire, pas de défaut (définir dans .env)
    DATABASE_URL: str

    # Security — obligatoire, pas de défaut (définir dans .env)
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30   # 30 min (was 24h)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = False  # False par défaut, True uniquement en dev via .env

    # Super Admin — obligatoire, pas de défaut (définir dans .env)
    SUPER_ADMIN_EMAIL: str = "admin@targetym.com"
    SUPER_ADMIN_PASSWORD: str
    
    # Tech Super Admin — Équipe Targetym (gestion plateforme)
    TECH_SUPER_ADMIN_EMAIL: str = "software@hcexecutive.net"
    TECH_SUPER_ADMIN_PASSWORD: str = "ChangeMe!2024#Targetym"
    
    # AI Chatbot — Anthropic Claude
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"
    AI_CHAT_ENABLED: bool = True
    
    # Support Contact Info
    SUPPORT_EMAIL: str = "software@hcexecutive.net"
    SUPPORT_WHATSAPP: str = "+221 77 397 80 44"

    # Integrations — Microsoft Teams (Azure AD)
    MICROSOFT_CLIENT_ID: Optional[str] = None
    MICROSOFT_CLIENT_SECRET: Optional[str] = None
    MICROSOFT_TENANT_ID: Optional[str] = None
    MICROSOFT_REDIRECT_URI: str = "https://api.targetym.ai/api/integrations/teams/callback"

    # Integrations — Asana
    ASANA_CLIENT_ID: Optional[str] = None
    ASANA_CLIENT_SECRET: Optional[str] = None
    ASANA_REDIRECT_URI: str = "https://api.targetym.ai/api/integrations/asana/callback"

    # Integrations — Google Workspace
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "https://api.targetym.ai/api/integrations/google/callback"

    # Token encryption key (Fernet) for OAuth tokens
    INTEGRATION_ENCRYPTION_KEY: Optional[str] = None

    # AWS S3 (Contentieux — documents juridiques)
    AWS_S3_BUCKET_LEGAL: str = "targetym-legal-docs"
    AWS_REGION: str = "eu-west-1"
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None

    # Frontend URL (redirect after OAuth callback)
    FRONTEND_URL: str = "https://targetym-dashboard.vercel.app"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
