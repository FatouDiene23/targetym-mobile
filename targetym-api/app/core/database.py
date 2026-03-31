from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError, SQLAlchemyError
import urllib.parse
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def _make_engine():
    """
    Parse DATABASE_URL avec urllib (qui décode %3C -> <, %7C -> |, etc.)
    puis reconstruit un URL SQLAlchemy propre via URL.create().
    Évite les problèmes de caractères spéciaux dans le mot de passe qui cassent
    le parsing natif de psycopg2.
    """
    raw = settings.DATABASE_URL
    p = urllib.parse.urlparse(raw)
    password = urllib.parse.unquote(p.password or "")
    username = urllib.parse.unquote(p.username or "")
    host = p.hostname
    port = p.port or 5432
    database = p.path.lstrip("/")

    # Diagnostic log (masqué) pour vérifier le décodage du mot de passe
    pw_diag = f"len={len(password)}, starts={password[:3]!r}, has<=({'<' in password}), has|=({'|' in password})"
    logger.info(f"[DB] Connecting to {host}:{port}/{database} user={username} pw_diag=({pw_diag})")

    connect_args = {}
    if host and "rds.amazonaws.com" in host:
        connect_args["sslmode"] = "require"

    url = URL.create(
        drivername="postgresql+psycopg2",
        username=username,
        password=password,
        host=host,
        port=port,
        database=database,
    )
    return create_engine(url, connect_args=connect_args)


engine = _make_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency pour obtenir une session DB"""
    from fastapi import HTTPException
    db = SessionLocal()
    try:
        # Rollback préventif pour nettoyer toute transaction en échec
        db.rollback()
        yield db
    except OperationalError as e:
        db.rollback()
        logger.error(f"[DB] OperationalError pendant la requête: {e}")
        raise HTTPException(
            status_code=503,
            detail="Database temporarily unavailable. Please retry."
        )
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"[DB] SQLAlchemyError: {e}")
        raise HTTPException(
            status_code=500,
            detail="Database error."
        )
    finally:
        db.close()
