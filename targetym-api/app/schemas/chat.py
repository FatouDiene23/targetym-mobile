from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class MessageRole(str, Enum):
    """Rôle du message dans la conversation"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessageCreate(BaseModel):
    """Schéma pour créer un nouveau message"""
    content: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[int] = None  # Si None, nouvelle conversation


class ChatMessageResponse(BaseModel):
    """Schéma pour la réponse d'un message"""
    id: int
    conversation_id: int
    role: MessageRole
    content: str
    created_at: datetime
    tokens_used: Optional[int] = None
    
    class Config:
        from_attributes = True


class ChatConversationCreate(BaseModel):
    """Schéma pour créer une nouvelle conversation"""
    title: Optional[str] = None
    initial_message: Optional[str] = None


class ChatConversationResponse(BaseModel):
    """Schéma pour la réponse d'une conversation"""
    id: int
    employee_id: int
    title: Optional[str]
    is_active: int
    created_at: datetime
    updated_at: Optional[datetime]
    message_count: Optional[int] = 0  # Calculé dynamiquement
    
    class Config:
        from_attributes = True


class ChatConversationWithMessages(ChatConversationResponse):
    """Conversation complète avec tous les messages"""
    messages: List[ChatMessageResponse] = []


class ChatStreamResponse(BaseModel):
    """Réponse en streaming du chatbot"""
    type: str  # "token", "tool_call", "done", "error"
    content: Optional[str] = None
    tool_name: Optional[str] = None
    tool_result: Optional[dict] = None
    error: Optional[str] = None


class HumanEscalationResponse(BaseModel):
    """Réponse lorsqu'une escalade humaine est nécessaire"""
    needs_human: bool = True
    reason: str
    contact_email: str = "support@targetym.com"
    contact_whatsapp: str = "+33 X XX XX XX XX"
    message: str
