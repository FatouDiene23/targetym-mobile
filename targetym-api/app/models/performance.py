# =============================================
# MODELS - Performance & Feedback (avec 360° et Calibration)
# File: app/models/performance.py
# =============================================

from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime, Date, Numeric, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.core.database import Base


class Feedback(Base):
    """
    Feedback continu peer-to-peer
    Types: recognition (🎉), improvement (💡), general (💬)
    """
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    
    # Qui donne / reçoit
    from_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    to_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    
    # Contenu
    type = Column(String(20), nullable=False, default='general')  # 'recognition', 'improvement', 'general'
    interaction_type = Column(String(20), nullable=True)  # 'request', 'file', 'project', 'mission', 'other'
    message = Column(Text, nullable=False)
    is_public = Column(Boolean, default=True)
    
    # Engagement
    likes_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relations
    from_employee = relationship("Employee", foreign_keys=[from_employee_id], backref="feedbacks_given")
    to_employee = relationship("Employee", foreign_keys=[to_employee_id], backref="feedbacks_received")
    likes = relationship("FeedbackLike", back_populates="feedback", cascade="all, delete-orphan")
    
    __table_args__ = (
        CheckConstraint('from_employee_id != to_employee_id', name='different_employees'),
        {'schema': None}
    )


class FeedbackLike(Base):
    """
    Likes sur les feedbacks publics
    """
    __tablename__ = "feedback_likes"

    id = Column(Integer, primary_key=True, index=True)
    feedback_id = Column(Integer, ForeignKey("feedbacks.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    feedback = relationship("Feedback", back_populates="likes")
    employee = relationship("Employee")
    
    __table_args__ = (
        UniqueConstraint('feedback_id', 'employee_id', name='unique_feedback_like'),
    )


class FeedbackReply(Base):
    """
    Réponses aux feedbacks — privées entre expéditeur et destinataire
    """
    __tablename__ = "feedback_replies"

    id = Column(Integer, primary_key=True, index=True)
    feedback_id = Column(Integer, ForeignKey("feedbacks.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    feedback = relationship("Feedback", backref="replies")
    employee = relationship("Employee")


class EvaluationCampaign(Base):
    """
    Campagnes d'évaluation lancées par RH
    Types: annual, mid_year, 360, probation
    """
    __tablename__ = "evaluation_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    type = Column(String(20), nullable=False)  # 'annual', 'mid_year', '360', 'probation'
    
    # Période
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    
    # Status
    status = Column(String(20), default='draft')  # 'draft', 'active', 'completed', 'cancelled'
    
    # Template de questions (JSON flexible)
    template = Column(JSONB)
    
    # ============================================
    # OPTIONS 360° FEEDBACK
    # ============================================
    is_360 = Column(Boolean, default=False)
    
    # Mode de sélection des évaluateurs pairs
    peer_selection_mode = Column(String(20), default='rh_assigns')
    # 'rh_assigns' = RH choisit les évaluateurs
    # 'manager_assigns' = Manager choisit les évaluateurs  
    # 'employee_suggests' = Employé suggère, RH valide
    # 'auto' = Basé sur l'organigramme
    
    min_peer_evaluators = Column(Integer, default=1)
    max_peer_evaluators = Column(Integer, default=2)
    min_direct_report_evaluators = Column(Integer, default=1)
    max_direct_report_evaluators = Column(Integer, default=3)

    # Types d'évaluations à inclure
    include_self_evaluation = Column(Boolean, default=True)
    include_manager_evaluation = Column(Boolean, default=True)
    include_peer_evaluation = Column(Boolean, default=False)
    include_direct_report_evaluation = Column(Boolean, default=False)

    # ============================================
    # PÉRIODICITÉ ET PONDÉRATION
    # ============================================
    period = Column(String(20), default='annual')  # 'quarterly', 'semester', 'annual'
    quarter = Column(Integer, nullable=True)        # 1, 2, 3, 4 (si period='quarterly')

    # Pondération des 4 types d'évaluateurs (somme = 100)
    weight_self = Column(Integer, default=25)
    weight_manager = Column(Integer, default=25)
    weight_peer = Column(Integer, default=25)
    weight_direct_report = Column(Integer, default=25)

    # ============================================
    
    created_by = Column(Integer, ForeignKey("employees.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relations
    creator = relationship("Employee", foreign_keys=[created_by])
    evaluations = relationship("Evaluation", back_populates="campaign")
    assignments = relationship("EvaluationAssignment", back_populates="campaign")
    calibration_sessions = relationship("CalibrationSession", back_populates="campaign")


class EvaluationAssignment(Base):
    """
    Définit qui doit évaluer qui dans une campagne 360°
    Créé par RH lors du lancement de la campagne
    """
    __tablename__ = "evaluation_assignments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    campaign_id = Column(Integer, ForeignKey("evaluation_campaigns.id", ondelete="CASCADE"), nullable=False)
    
    # Qui est évalué
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    
    # Qui doit évaluer
    evaluator_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    
    # Type d'évaluateur
    evaluator_type = Column(String(20), nullable=False)  # 'self', 'manager', 'peer', 'direct_report'
    
    # Status
    status = Column(String(20), default='pending')  # 'pending', 'completed', 'skipped'
    
    # Lien vers l'évaluation créée
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"), nullable=True)
    
    # Dates
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    reminder_sent_at = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relations
    campaign = relationship("EvaluationCampaign", back_populates="assignments")
    employee = relationship("Employee", foreign_keys=[employee_id])
    evaluator = relationship("Employee", foreign_keys=[evaluator_id])
    evaluation = relationship("Evaluation", foreign_keys=[evaluation_id])
    
    __table_args__ = (
        UniqueConstraint('campaign_id', 'employee_id', 'evaluator_id', name='unique_assignment'),
        CheckConstraint(
            "evaluator_type = 'self' OR employee_id != evaluator_id",
            name='different_for_non_self'
        ),
    )


class Evaluation(Base):
    """
    Évaluations individuelles
    Types: self (auto-éval), manager, peer, direct_report
    """
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    campaign_id = Column(Integer, ForeignKey("evaluation_campaigns.id"), nullable=True)
    
    # Groupe d'évaluation (pour lier les évals 360° d'un même employé)
    evaluation_group_id = Column(UUID(as_uuid=True), default=uuid.uuid4)
    
    # Qui est évalué
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    
    # Qui évalue (NULL = auto-évaluation)
    evaluator_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    
    # Type d'évaluation
    type = Column(String(20), nullable=False)  # 'self', 'manager', 'peer', 'direct_report'
    
    # Status
    status = Column(String(20), default='pending')  # 'pending', 'in_progress', 'submitted', 'validated'
    
    # Scores (JSON pour flexibilité)
    scores = Column(JSONB)
    
    overall_score = Column(Numeric(3, 2))  # Score global sur 5 (ex: 4.25)
    
    # ============================================
    # CALIBRATION
    # ============================================
    calibrated_score = Column(Numeric(3, 2))  # Score après calibration
    is_calibrated = Column(Boolean, default=False)
    calibration_session_id = Column(Integer, ForeignKey("calibration_sessions.id"), nullable=True)
    
    # ============================================
    
    # Commentaires
    strengths = Column(Text)  # Points forts (peut être JSON array)
    improvements = Column(Text)  # Axes d'amélioration (peut être JSON array)
    goals = Column(Text)  # Objectifs pour la prochaine période (peut être JSON array)
    manager_comments = Column(Text)
    employee_comments = Column(Text)
    
    # Période (héritée de la campagne)
    period = Column(String(20), nullable=True)  # 'quarterly', 'semester', 'annual'

    # Score pondéré : contribution de cette évaluation au score final de l'employé
    # = overall_score * type_weight / 100 (divisé par nb d'évaluateurs du même type)
    weighted_score = Column(Numeric(5, 2), nullable=True)

    # Lien avec OKRs
    okr_achievement_score = Column(Numeric(5, 2))
    
    # Dates
    due_date = Column(Date)
    submitted_at = Column(DateTime(timezone=True))
    validated_at = Column(DateTime(timezone=True))
    validated_by = Column(Integer, ForeignKey("employees.id"))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relations
    campaign = relationship("EvaluationCampaign", back_populates="evaluations")
    employee = relationship("Employee", foreign_keys=[employee_id], backref="evaluations_received")
    evaluator = relationship("Employee", foreign_keys=[evaluator_id], backref="evaluations_given")
    validator = relationship("Employee", foreign_keys=[validated_by])
    calibration_session = relationship("CalibrationSession", back_populates="evaluations")
    score_adjustments = relationship("CalibrationScoreAdjustment", back_populates="evaluation")


class CalibrationSession(Base):
    """
    Sessions de calibration où managers + RH alignent les notes
    """
    __tablename__ = "calibration_sessions"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    campaign_id = Column(Integer, ForeignKey("evaluation_campaigns.id"), nullable=False)
    
    # Infos session
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Scope: département ou toute l'entreprise
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    
    # Planification
    scheduled_date = Column(DateTime(timezone=True))
    duration_minutes = Column(Integer, default=60)
    location = Column(String(255))
    
    # Status
    status = Column(String(20), default='scheduled')  # 'scheduled', 'in_progress', 'completed', 'cancelled'
    
    # Résultats
    notes = Column(Text)
    decisions = Column(JSONB)  # Liste des décisions prises
    
    # Facilitateur (généralement RH)
    facilitator_id = Column(Integer, ForeignKey("employees.id"))
    
    # Dates
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relations
    campaign = relationship("EvaluationCampaign", back_populates="calibration_sessions")
    department = relationship("Department")
    facilitator = relationship("Employee", foreign_keys=[facilitator_id])
    participants = relationship("CalibrationParticipant", back_populates="session", cascade="all, delete-orphan")
    evaluations = relationship("Evaluation", back_populates="calibration_session")
    score_adjustments = relationship("CalibrationScoreAdjustment", back_populates="session", cascade="all, delete-orphan")


class CalibrationParticipant(Base):
    """
    Qui participe à une session de calibration
    """
    __tablename__ = "calibration_participants"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("calibration_sessions.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    
    # Rôle dans la session
    role = Column(String(20), default='participant')  # 'facilitator', 'participant', 'observer'
    
    # Présence
    attended = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relations
    session = relationship("CalibrationSession", back_populates="participants")
    employee = relationship("Employee")
    
    __table_args__ = (
        UniqueConstraint('session_id', 'employee_id', name='unique_participant'),
    )


class CalibrationScoreAdjustment(Base):
    """
    Historique des ajustements de scores lors de la calibration
    """
    __tablename__ = "calibration_score_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("calibration_sessions.id", ondelete="CASCADE"), nullable=False)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"), nullable=False)
    
    # Scores
    original_score = Column(Numeric(3, 2), nullable=False)
    calibrated_score = Column(Numeric(3, 2), nullable=False)
    
    # Justification
    reason = Column(Text, nullable=False)
    
    # Qui a proposé l'ajustement
    proposed_by = Column(Integer, ForeignKey("employees.id"))
    
    # Validation
    approved = Column(Boolean, default=True)
    approved_by = Column(Integer, ForeignKey("employees.id"))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relations
    session = relationship("CalibrationSession", back_populates="score_adjustments")
    evaluation = relationship("Evaluation", back_populates="score_adjustments")
    proposer = relationship("Employee", foreign_keys=[proposed_by])
    approver = relationship("Employee", foreign_keys=[approved_by])


class OneOnOne(Base):
    """
    Entretiens 1-on-1 Manager/Employé
    """
    __tablename__ = "one_on_ones"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    
    # Participants
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    
    # Planification
    scheduled_date = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, default=30)
    location = Column(String(255))
    
    # Status
    status = Column(String(20), default='scheduled')  # 'scheduled', 'completed', 'cancelled', 'rescheduled'
    
    # Notes (après le meeting)
    notes = Column(Text)
    action_items = Column(JSONB)
    mood = Column(String(20))  # 'positive', 'neutral', 'concerned'

    # Évaluation finale (au moment de clôturer le 1-on-1)
    evaluation_score = Column(Integer, nullable=True)   # 1-5
    evaluation_comment = Column(Text, nullable=True)

    # Tâches / formations assignées lors du 1-on-1
    # Format : [{id, title, type (task|training), assignee (manager|employee),
    #            due_date, status (pending|done), completed_at}]
    tasks = Column(JSONB, nullable=True)
    
    # Topics à discuter (avant le meeting)
    topics = Column(JSONB)
    
    # Récurrence
    is_recurring = Column(Boolean, default=False)
    recurrence_pattern = Column(String(20))  # 'weekly', 'biweekly', 'monthly'
    parent_id = Column(Integer, ForeignKey("one_on_ones.id"), nullable=True)
    
    completed_at = Column(DateTime(timezone=True))
    cancelled_at = Column(DateTime(timezone=True))
    cancel_reason = Column(String(255))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relations
    employee = relationship("Employee", foreign_keys=[employee_id], backref="one_on_ones_as_employee")
    manager = relationship("Employee", foreign_keys=[manager_id], backref="one_on_ones_as_manager")
    parent = relationship("OneOnOne", remote_side=[id], backref="recurrences")