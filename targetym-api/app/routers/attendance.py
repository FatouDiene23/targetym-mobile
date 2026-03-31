from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime, time
from decimal import Decimal
import io
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Employee, AttendanceRecord, AttendanceImport, UserRole
from app.schemas.attendance import (
    AttendanceRecordCreate,
    AttendanceRecordUpdate,
    AttendanceRecordResponse,
    AttendanceImportRequest,
    AttendanceImportResponse,
    AttendanceStats,
    EmployeeAttendanceStats,
)

router = APIRouter(prefix="/attendance", tags=["Pointage"])


# ==================== RECORDS ====================

@router.get("/records", response_model=List[AttendanceRecordResponse])
async def list_attendance_records(
    start_date: date = Query(...),
    end_date: date = Query(...),
    employee_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Liste des pointages"""
    query = db.query(AttendanceRecord).join(Employee).filter(
        AttendanceRecord.tenant_id == current_user.tenant_id,
        AttendanceRecord.date >= start_date,
        AttendanceRecord.date <= end_date
    )
    
    if employee_id:
        query = query.filter(AttendanceRecord.employee_id == employee_id)
    
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    
    if status_filter:
        query = query.filter(AttendanceRecord.status == status_filter)
    
    records = query.order_by(AttendanceRecord.date.desc()).all()
    
    result = []
    for r in records:
        result.append(AttendanceRecordResponse(
            id=r.id,
            tenant_id=r.tenant_id,
            employee_id=r.employee_id,
            employee_name=r.employee.full_name if r.employee else None,
            date=r.date,
            check_in=r.check_in,
            check_out=r.check_out,
            break_start=r.break_start,
            break_end=r.break_end,
            hours_worked=r.hours_worked,
            overtime_hours=r.overtime_hours,
            status=r.status,
            source=r.source,
            notes=r.notes,
            created_at=r.created_at
        ))
    
    return result


@router.get("/records/my", response_model=List[AttendanceRecordResponse])
async def get_my_attendance(
    start_date: date = Query(None),
    end_date: date = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mes pointages"""
    if not current_user.employee_id:
        raise HTTPException(status_code=404, detail="Profil employé non trouvé")
    
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.tenant_id == current_user.tenant_id,
        AttendanceRecord.employee_id == current_user.employee_id,
        AttendanceRecord.date >= start_date,
        AttendanceRecord.date <= end_date
    ).order_by(AttendanceRecord.date.desc()).all()
    
    result = []
    for r in records:
        result.append(AttendanceRecordResponse(
            id=r.id,
            tenant_id=r.tenant_id,
            employee_id=r.employee_id,
            employee_name=None,
            date=r.date,
            check_in=r.check_in,
            check_out=r.check_out,
            break_start=r.break_start,
            break_end=r.break_end,
            hours_worked=r.hours_worked,
            overtime_hours=r.overtime_hours,
            status=r.status,
            source=r.source,
            notes=r.notes,
            created_at=r.created_at
        ))
    
    return result


@router.post("/records", response_model=AttendanceRecordResponse)
async def create_attendance_record(
    data: AttendanceRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Créer un pointage manuel (RH/Admin)"""
    if current_user.role not in [UserRole.RH.value, UserRole.ADMIN.value, UserRole.DG.value]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    # Vérifier l'employé
    employee = db.query(Employee).filter(
        Employee.id == data.employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    # Vérifier si un pointage existe déjà
    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.tenant_id == current_user.tenant_id,
        AttendanceRecord.employee_id == data.employee_id,
        AttendanceRecord.date == data.date
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Un pointage existe déjà pour cette date")
    
    # Calculer les heures travaillées
    hours_worked = None
    if data.check_in and data.check_out:
        check_in_dt = datetime.combine(data.date, data.check_in)
        check_out_dt = datetime.combine(data.date, data.check_out)
        diff = (check_out_dt - check_in_dt).total_seconds() / 3600
        
        # Soustraire la pause
        if data.break_start and data.break_end:
            break_start_dt = datetime.combine(data.date, data.break_start)
            break_end_dt = datetime.combine(data.date, data.break_end)
            break_hours = (break_end_dt - break_start_dt).total_seconds() / 3600
            diff -= break_hours
        
        hours_worked = Decimal(str(round(diff, 2)))
    
    record = AttendanceRecord(
        tenant_id=current_user.tenant_id,
        employee_id=data.employee_id,
        date=data.date,
        check_in=data.check_in,
        check_out=data.check_out,
        break_start=data.break_start,
        break_end=data.break_end,
        hours_worked=hours_worked,
        status=data.status,
        source="manual",
        notes=data.notes
    )
    
    db.add(record)
    db.commit()
    db.refresh(record)
    
    return AttendanceRecordResponse(
        id=record.id,
        tenant_id=record.tenant_id,
        employee_id=record.employee_id,
        employee_name=employee.full_name,
        date=record.date,
        check_in=record.check_in,
        check_out=record.check_out,
        break_start=record.break_start,
        break_end=record.break_end,
        hours_worked=record.hours_worked,
        overtime_hours=record.overtime_hours,
        status=record.status,
        source=record.source,
        notes=record.notes,
        created_at=record.created_at
    )


# ==================== IMPORT EXCEL ====================

@router.post("/import", response_model=AttendanceImportResponse)
async def import_attendance(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Importer des pointages depuis Excel"""
    if current_user.role not in [UserRole.RH.value, UserRole.ADMIN.value, UserRole.DG.value]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    # Vérifier le type de fichier
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Format de fichier non supporté")
    
    try:
        import pandas as pd
        
        # Lire le fichier
        content = await file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        # Créer l'entrée d'import
        import_record = AttendanceImport(
            tenant_id=current_user.tenant_id,
            filename=file.filename,
            total_rows=len(df),
            imported_rows=0,
            failed_rows=0,
            status="processing",
            imported_by_id=current_user.id
        )
        db.add(import_record)
        db.commit()
        
        # Colonnes attendues (standard)
        # email ou matricule, date, heure_entree, heure_sortie, statut
        required_cols = ['email', 'date']
        
        # Vérifier les colonnes (insensible à la casse)
        df.columns = df.columns.str.lower().str.strip()
        
        if 'email' not in df.columns and 'matricule' not in df.columns:
            import_record.status = "failed"
            import_record.error_message = "Colonne 'email' ou 'matricule' requise"
            db.commit()
            raise HTTPException(status_code=400, detail="Colonne 'email' ou 'matricule' requise")
        
        if 'date' not in df.columns:
            import_record.status = "failed"
            import_record.error_message = "Colonne 'date' requise"
            db.commit()
            raise HTTPException(status_code=400, detail="Colonne 'date' requise")
        
        imported = 0
        failed = 0
        period_start = None
        period_end = None
        
        for _, row in df.iterrows():
            try:
                # Trouver l'employé
                if 'email' in df.columns:
                    employee = db.query(Employee).filter(
                        Employee.tenant_id == current_user.tenant_id,
                        Employee.email == str(row['email']).lower().strip()
                    ).first()
                else:
                    employee = db.query(Employee).filter(
                        Employee.tenant_id == current_user.tenant_id,
                        Employee.employee_number == str(row['matricule']).strip()
                    ).first()
                
                if not employee:
                    failed += 1
                    continue
                
                # Parser la date
                record_date = pd.to_datetime(row['date']).date()
                
                if period_start is None or record_date < period_start:
                    period_start = record_date
                if period_end is None or record_date > period_end:
                    period_end = record_date
                
                # Vérifier si existe déjà
                existing = db.query(AttendanceRecord).filter(
                    AttendanceRecord.tenant_id == current_user.tenant_id,
                    AttendanceRecord.employee_id == employee.id,
                    AttendanceRecord.date == record_date
                ).first()
                
                if existing:
                    # Mettre à jour
                    if 'heure_entree' in df.columns and pd.notna(row.get('heure_entree')):
                        existing.check_in = pd.to_datetime(row['heure_entree']).time()
                    if 'heure_sortie' in df.columns and pd.notna(row.get('heure_sortie')):
                        existing.check_out = pd.to_datetime(row['heure_sortie']).time()
                    if 'statut' in df.columns and pd.notna(row.get('statut')):
                        existing.status = str(row['statut']).lower()
                    existing.source = "excel_import"
                else:
                    # Créer nouveau
                    record = AttendanceRecord(
                        tenant_id=current_user.tenant_id,
                        employee_id=employee.id,
                        date=record_date,
                        status=str(row.get('statut', 'present')).lower() if pd.notna(row.get('statut')) else 'present',
                        source="excel_import"
                    )
                    
                    if 'heure_entree' in df.columns and pd.notna(row.get('heure_entree')):
                        record.check_in = pd.to_datetime(row['heure_entree']).time()
                    if 'heure_sortie' in df.columns and pd.notna(row.get('heure_sortie')):
                        record.check_out = pd.to_datetime(row['heure_sortie']).time()
                    
                    db.add(record)
                
                imported += 1
                
            except Exception as e:
                failed += 1
                continue
        
        # Mettre à jour l'import
        import_record.imported_rows = imported
        import_record.failed_rows = failed
        import_record.period_start = period_start
        import_record.period_end = period_end
        import_record.status = "completed"
        import_record.completed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(import_record)
        
        return AttendanceImportResponse(
            id=import_record.id,
            tenant_id=import_record.tenant_id,
            filename=import_record.filename,
            total_rows=import_record.total_rows,
            imported_rows=import_record.imported_rows,
            failed_rows=import_record.failed_rows,
            period_start=import_record.period_start,
            period_end=import_record.period_end,
            status=import_record.status,
            error_message=import_record.error_message,
            created_at=import_record.created_at,
            completed_at=import_record.completed_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'import: {str(e)}")


@router.get("/import/template")
async def get_import_template():
    """Récupérer le template Excel pour l'import"""
    return {
        "columns": [
            {"name": "email", "description": "Email de l'employé", "required": True, "example": "jean.martin@entreprise.com"},
            {"name": "date", "description": "Date du pointage", "required": True, "example": "2024-01-15"},
            {"name": "heure_entree", "description": "Heure d'entrée", "required": False, "example": "08:30"},
            {"name": "heure_sortie", "description": "Heure de sortie", "required": False, "example": "17:30"},
            {"name": "statut", "description": "Statut (present, absent, late, remote)", "required": False, "example": "present"},
        ],
        "notes": [
            "Le fichier doit être au format .xlsx, .xls ou .csv",
            "La première ligne doit contenir les noms des colonnes",
            "Utilisez 'email' OU 'matricule' pour identifier les employés",
            "Format de date recommandé: YYYY-MM-DD (ex: 2024-01-15)",
            "Format d'heure recommandé: HH:MM (ex: 08:30)"
        ]
    }


# ==================== STATS ====================

@router.get("/stats", response_model=AttendanceStats)
async def get_attendance_stats(
    start_date: date = Query(...),
    end_date: date = Query(...),
    department_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Statistiques de pointage"""
    query = db.query(AttendanceRecord).join(Employee).filter(
        AttendanceRecord.tenant_id == current_user.tenant_id,
        AttendanceRecord.date >= start_date,
        AttendanceRecord.date <= end_date
    )
    
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    
    records = query.all()
    
    total_employees = db.query(Employee).filter(
        Employee.tenant_id == current_user.tenant_id,
        Employee.is_active == True
    ).count()
    
    total_days = (end_date - start_date).days + 1
    
    present = sum(1 for r in records if r.status == 'present')
    absent = sum(1 for r in records if r.status == 'absent')
    late = sum(1 for r in records if r.status == 'late')
    remote = sum(1 for r in records if r.status == 'remote')
    
    total_hours = sum(float(r.hours_worked or 0) for r in records)
    avg_hours = total_hours / len(records) if records else 0
    
    attendance_rate = (present + late + remote) / len(records) * 100 if records else 0
    absenteeism_rate = absent / len(records) * 100 if records else 0
    
    return AttendanceStats(
        period_start=start_date,
        period_end=end_date,
        total_employees=total_employees,
        total_days=total_days,
        present_days=present,
        absent_days=absent,
        late_days=late,
        remote_days=remote,
        attendance_rate=round(attendance_rate, 1),
        absenteeism_rate=round(absenteeism_rate, 1),
        average_hours_per_day=round(avg_hours, 1)
    )
