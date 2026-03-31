from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.models.base import TimestampMixin, TenantMixin
from app.core.database import Base


class MessageRole(str, enum.Enum):
    """Rôle du message dans la conversation"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatConversation(Base, TimestampMixin, TenantMixin):
    """Conversations du chatbot AI pour chaque employé"""
    __tablename__ = "chat_conversations"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    title = Column(String(255), nullable=True)  # Titre généré auto ou personnalisé
    is_active = Column(Integer, default=1)  # 1 = active, 0 = archivée
    
    # Relations
    employee = relationship("Employee", backref="chat_conversations")
    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan")


class ChatMessage(Base, TimestampMixin, TenantMixin):
    """Messages individuels dans les conversations"""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("chat_conversations.id"), nullable=False, index=True)
    role = Column(SQLEnum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    
    # Métadonnées optionnelles pour tracking
    tokens_used = Column(Integer, nullable=True)  # Pour monitoring coûts
    tool_calls = Column(Text, nullable=True)  # JSON stringifié des tools appelés
    
    # Relations
    conversation = relationship("ChatConversation", back_populates="messages")
