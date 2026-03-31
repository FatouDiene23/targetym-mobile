"""
Script de migration pour créer les tables du chatbot AI
À exécuter une seule fois sur la base de données de production
"""

from app.core.database import SessionLocal, Base, engine
from app.models.chat import ChatConversation, ChatMessage

def create_chat_tables():
    """Crée les tables chat_conversations et chat_messages"""
    print("🔄 Création des tables du chatbot AI...")
    
    # Créer uniquement les tables de chat
    ChatConversation.__table__.create(bind=engine, checkfirst=True)
    ChatMessage.__table__.create(bind=engine, checkfirst=True)
    
    print("✅ Tables chat_conversations et chat_messages créées avec succès !")

if __name__ == "__main__":
    create_chat_tables()
