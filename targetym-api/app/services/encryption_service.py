from typing import Optional
from app.core.config import settings


def get_fernet():
    """Get Fernet instance for token encryption."""
    from cryptography.fernet import Fernet
    key = settings.INTEGRATION_ENCRYPTION_KEY
    if not key:
        raise ValueError("INTEGRATION_ENCRYPTION_KEY not configured")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_token(token: str) -> str:
    """Encrypt an OAuth token for storage."""
    f = get_fernet()
    return f.encrypt(token.encode()).decode()


def decrypt_token(encrypted: str) -> str:
    """Decrypt an OAuth token from storage."""
    f = get_fernet()
    return f.decrypt(encrypted.encode()).decode()


def generate_encryption_key() -> str:
    """Generate a new Fernet key. Run once, store in env."""
    from cryptography.fernet import Fernet
    return Fernet.generate_key().decode()
