from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Text, Date, Time, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class AttendanceRecord(Base):
    """
    Modèle AttendanceRecord - Enregistrement de pointage
    Peut être importé depuis Excel ou API externe
    """
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    
    # Date
    date = Column(Date, nullable=False, index=True)
    
    # Pointages
    check_in = Column(Time, nullable=True)  # Heure d'entrée
    check_out = Column(Time, nullable=True)  # Heure de sortie
    
    # Pause déjeuner (optionnel)
    break_start = Column(Time, nullable=True)
    break_end = Column(Time, nullable=True)
    
    # Heures calculées
    hours_worked = Column(Numeric(5, 2), nullable=True)  # Heures travaillées
    overtime_hours = Column(Numeric(5, 2), default=0)  # Heures supplémentaires
    
    # Statut
    status = Column(String(50), default="present")  # present, absent, late, half_day, remote
    
    # Source de données
    source = Column(String(50), default="manual")  # manual, excel_import, api_sync
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    employee = relationship("Employee")

    def __repr__(self):
        return f"<AttendanceRecord {self.employee_id} - {self.date}>"


class AttendanceImport(Base):
    """
    Modèle AttendanceImport - Historique des imports de pointage
    """
    __tablename__ = "attendance_imports"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Fichier
    filename = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=True)
    
    # Stats import
    total_rows = Column(Integer, default=0)
    imported_rows = Column(Integer, default=0)
    failed_rows = Column(Integer, default=0)
    
    # Période couverte
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    
    # Statut
    status = Column(String(50), default="pending")  # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)
    
    # Qui a importé
    imported_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<AttendanceImport {self.filename}>"