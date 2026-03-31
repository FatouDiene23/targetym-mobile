# app/api/certificate.py
"""
API pour la génération du certificat de travail (ex-employés uniquement)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, Column, Integer, String, DateTime, ForeignKey, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import relationship
from datetime import datetime, date
from io import BytesIO
import uuid

# ReportLab imports
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib import colors

from app.core.database import get_db, Base
from app.api.deps import get_current_user
from app.models.user import User
from app.models.employee import Employee
from app.models.tenant import Tenant
from app.core.plan_guard import require_feature
from app.core.plan_features import FEATURE_CERTIFICATES

router = APIRouter(prefix="/api/certificates", tags=["Certificates"], dependencies=[Depends(require_feature(FEATURE_CERTIFICATES))])


# ============================================
# MODÈLE du WorkCertificate & HELPER SQL 
# ============================================

class WorkCertificate(Base):
    __tablename__ = "work_certificates"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    reference_number = Column(String(50), unique=True, nullable=False)
    generated_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    generated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    generation_type = Column(String(20), default="rh")

    # Relations
    employee = relationship("Employee", foreign_keys=[employee_id])
    generated_by = relationship("User", foreign_keys=[generated_by_id])


# ============================================
# HELPERS
# ============================================

def get_employee_name(employee: Employee) -> str:
    """Retourne le nom complet de l'employé"""
    if employee.first_name and employee.last_name:
        return f"{employee.first_name} {employee.last_name}"
    return employee.first_name or employee.last_name or "N/A"


def get_gender_prefix(employee: Employee) -> str:
    """Retourne M. ou Mme selon le genre"""
    gender = getattr(employee, 'gender', None)
    if gender == 'female' or gender == 'F':
        return "Mme"
    return "M."


def format_date_fr(d) -> str:
    """Formate une date en français"""
    if not d:
        return "N/A"
    if isinstance(d, str):
        try:
            d = date.fromisoformat(d)
        except Exception:
            return d
    mois = [
        "", "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre"
    ]
    return f"{d.day} {mois[d.month]} {d.year}"


def generate_reference_number(db: Session, tenant_id: int, doc_type: str = 'attestation') -> str:
    """
    Génère un numéro de référence unique:
    ATT-{ANNÉE}-{SEQUENCE} pour les attestations
    CERT-{ANNÉE}-{SEQUENCE} pour les certificats
    En cas de collision (race condition), ajoute un suffixe aléatoire.
    """
    year = datetime.now().year
    prefix = "ATT" if doc_type == 'attestation' else "CERT"

    count = db.query(func.count(WorkCertificate.id)).filter(
        WorkCertificate.tenant_id == tenant_id,
        extract('year', WorkCertificate.generated_at) == year
    ).scalar() or 0

    sequence = count + 1
    reference_number = f"{prefix}-{year}-{sequence:04d}"

    # Vérifier si ce numéro existe déjà (collision cross-tenant ou race condition)
    exists = db.query(WorkCertificate.id).filter(
        WorkCertificate.reference_number == reference_number
    ).first()

    if exists:
        reference_number = f"{prefix}-{year}-{sequence:04d}-{uuid.uuid4().hex[:4].upper()}"

    return reference_number


def get_tenant_info(db: Session, tenant_id: int) -> Tenant:
    """Récupère le tenant"""
    return db.query(Tenant).filter(Tenant.id == tenant_id).first()


def get_certificate_settings(db: Session, tenant_id: int) -> dict:
    """Récupère les paramètres de certificat via SQL direct"""
    result = db.execute(text("""
        SELECT
            certificate_logo,
            certificate_signature,
            certificate_stamp,
            certificate_company_name,
            certificate_company_address,
            certificate_company_city,
            certificate_signatory_name,
            certificate_signatory_title,
            name
        FROM tenants
        WHERE id = :tenant_id
    """), {"tenant_id": tenant_id}).fetchone()

    if result:
        return {
            "certificate_logo": result[0],
            "certificate_signature": result[1],
            "certificate_stamp": result[2],
            "certificate_company_name": result[3],
            "certificate_company_address": result[4],
            "certificate_company_city": result[5],
            "certificate_signatory_name": result[6],
            "certificate_signatory_title": result[7],
            "name": result[8]
        }
    return {}


def get_signatory(db: Session, tenant_id: int, cert_settings: dict) -> tuple:
    """Retourne le signataire (nom, poste)"""
    signatory_name = cert_settings.get('certificate_signatory_name')
    signatory_title = cert_settings.get('certificate_signatory_title')
    if signatory_name and signatory_title:
        return signatory_name, signatory_title

    try:
        result = db.execute(text("""
            SELECT e.first_name, e.last_name, e.job_title
            FROM users u
            JOIN employees e ON u.employee_id = e.id
            WHERE u.tenant_id = :tenant_id
            AND u.is_active = true
            AND e.id IS NOT NULL
            ORDER BY
                CASE
                    WHEN LOWER(u.role::text) IN ('admin', 'dg') THEN 1
                    WHEN LOWER(u.role::text) IN ('rh', 'drh', 'dga') THEN 2
                    ELSE 3
                END
            LIMIT 1
        """), {"tenant_id": tenant_id}).fetchone()

        if result:
            name = f"{result[0]} {result[1]}"
            title = result[2] or "Directeur des Ressources Humaines"
            return name, title
    except Exception as e:
        print(f"Error finding signatory: {e}")

    return "La Direction", "Direction Générale"


def get_career_history(db: Session, employee_id: int, hire_date, departure_date) -> list:
    """
    Reconstruit l'historique des postes occupés via les promotions approuvées.
    Retourne une liste de dicts: {title, start, end}
    """
    try:
        rows = db.execute(text("""
            SELECT
                cl_from.title AS from_title,
                cl_to.title AS to_title,
                pr.decision_date
            FROM promotion_requests pr
            JOIN employee_careers ec ON ec.id = pr.employee_career_id
            JOIN career_levels cl_from ON cl_from.id = pr.from_level_id
            JOIN career_levels cl_to ON cl_to.id = pr.to_level_id
            WHERE ec.employee_id = :eid
            AND pr.status = 'approved'
            ORDER BY pr.decision_date ASC
        """), {"eid": employee_id}).fetchall()
    except Exception as e:
        print(f"Error fetching career history: {e}")
        return []

    if not rows:
        return []

    entries = [dict(r._mapping) for r in rows]
    history = []

    # Premier poste: from_title de la 1ère promotion, de hire_date jusqu'à cette promotion
    history.append({
        "title": entries[0]["from_title"] or "N/A",
        "start": hire_date,
        "end": entries[0]["decision_date"]
    })

    # Postes suivants
    for i, entry in enumerate(entries):
        next_date = entries[i + 1]["decision_date"] if i + 1 < len(entries) else departure_date
        history.append({
            "title": entry["to_title"] or "N/A",
            "start": entry["decision_date"],
            "end": next_date
        })

    return history


# ============================================
# GÉNÉRATION PDF
# doc_type = 'attestation' → attestation de travail (employé actif, self-service)
# doc_type = 'certificat'  → certificat de travail (ex-employé, RH, avec parcours)
# ============================================

def generate_certificate_pdf(
    employee: Employee,
    cert_settings: dict,
    reference_number: str,
    signatory_name: str,
    signatory_title: str,
    career_history: list = None,
    departure_date=None,
    doc_type: str = 'attestation'
) -> BytesIO:
    """Génère le PDF de l'attestation ou du certificat de travail"""
    from reportlab.platypus import Image, Table, TableStyle
    import os

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()

    style_header = ParagraphStyle(
        'Header',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
    )

    style_title = ParagraphStyle(
        'CertTitle',
        parent=styles['Heading1'],
        fontSize=18,
        alignment=TA_CENTER,
        spaceAfter=20,
        spaceBefore=30,
        textColor=colors.HexColor('#1a365d'),
    )

    style_reference = ParagraphStyle(
        'Reference',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_CENTER,
        textColor=colors.gray,
        spaceAfter=30,
    )

    style_body = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=12,
        leading=18,
        alignment=TA_JUSTIFY,
        spaceBefore=12,
        spaceAfter=12,
    )

    style_section_title = ParagraphStyle(
        'SectionTitle',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        spaceBefore=20,
        spaceAfter=8,
        textColor=colors.HexColor('#1a365d'),
    )

    style_signature = ParagraphStyle(
        'Signature',
        parent=styles['Normal'],
        fontSize=11,
        alignment=TA_RIGHT,
        spaceBefore=40,
    )

    style_footer = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        alignment=TA_CENTER,
        textColor=colors.gray,
    )

    story = []

    # === LOGO ===
    logo_path = cert_settings.get('certificate_logo')
    if logo_path:
        full_logo_path = f"/app{logo_path}"
        if os.path.exists(full_logo_path):
            try:
                logo = Image(full_logo_path, width=4*cm, height=2*cm)
                logo.hAlign = 'LEFT'
                story.append(logo)
                story.append(Spacer(1, 0.5*cm))
            except Exception as e:
                print(f"Erreur chargement logo: {e}")

    # === EN-TÊTE ENTREPRISE ===
    company_name = cert_settings.get('certificate_company_name') or cert_settings.get('name') or "Entreprise"
    company_address = cert_settings.get('certificate_company_address') or ""
    company_city = cert_settings.get('certificate_company_city') or "Dakar"

    story.append(Paragraph(f"<b>{company_name.upper()}</b>", style_header))
    if company_address:
        story.append(Paragraph(company_address, style_header))

    story.append(Spacer(1, 1*cm))

    # === TITRE ===
    doc_title = "ATTESTATION DE TRAVAIL" if doc_type == 'attestation' else "CERTIFICAT DE TRAVAIL"
    story.append(Paragraph(doc_title, style_title))
    story.append(Paragraph(f"Réf : {reference_number}", style_reference))

    # === CORPS ===
    gender_prefix = get_gender_prefix(employee)
    employee_name = get_employee_name(employee)
    hire_date_fr = format_date_fr(employee.hire_date) if employee.hire_date else "N/A"
    departure_date_fr = format_date_fr(departure_date) if departure_date else "N/A"
    today_date = format_date_fr(date.today())
    job_title = employee.job_title or "Employé(e)"

    # Paragraphe d'introduction
    intro = (
        f"Je soussigné(e), <b>{signatory_name}</b>, agissant en qualité de <b>{signatory_title}</b> "
        f"de la société <b>{company_name}</b>, certifie par la présente que :"
    )
    story.append(Paragraph(intro, style_body))
    story.append(Spacer(1, 0.5*cm))

    # Identité employé
    story.append(Paragraph(f"<b>{gender_prefix} {employee_name.upper()}</b>", ParagraphStyle(
        'EmployeeName',
        parent=styles['Normal'],
        fontSize=14,
        alignment=TA_CENTER,
        spaceBefore=10,
        spaceAfter=10,
    )))
    story.append(Spacer(1, 0.5*cm))

    if doc_type == 'attestation':
        # ── Attestation : employé ACTIF ──
        details = (
            f"Est employé(e) au sein de notre entreprise depuis le <b>{hire_date_fr}</b>, "
            f"en qualité de <b>{job_title}</b>."
        )
        story.append(Paragraph(details, style_body))
        confirmation = (
            f"À la date de délivrance de la présente attestation, {gender_prefix} {employee_name} "
            f"fait toujours partie de nos effectifs."
        )
        story.append(Paragraph(confirmation, style_body))
    else:
        # ── Certificat : ex-employé ──
        last_title = career_history[-1]["title"] if career_history else job_title
        employment_details = (
            f"A été employé(e) au sein de notre entreprise du <b>{hire_date_fr}</b> "
            f"au <b>{departure_date_fr}</b>, occupant en dernier lieu le poste de <b>{last_title}</b>."
        )
        story.append(Paragraph(employment_details, style_body))

    # === HISTORIQUE DES POSTES (certificat uniquement) ===
    if doc_type == 'certificat' and career_history:
        story.append(Paragraph("<b>PARCOURS AU SEIN DE L'ENTREPRISE</b>", style_section_title))

        # En-têtes du tableau
        table_data = [
            [
                Paragraph("<b>Poste occupé</b>", ParagraphStyle('TH', parent=styles['Normal'], fontSize=10)),
                Paragraph("<b>Du</b>", ParagraphStyle('TH', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER)),
                Paragraph("<b>Au</b>", ParagraphStyle('TH', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER)),
            ]
        ]

        for entry in career_history:
            table_data.append([
                Paragraph(entry["title"], ParagraphStyle('TD', parent=styles['Normal'], fontSize=10)),
                Paragraph(format_date_fr(entry["start"]), ParagraphStyle('TD', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER)),
                Paragraph(format_date_fr(entry["end"]) if entry["end"] else "—", ParagraphStyle('TD', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER)),
            ])

        col_widths = [9*cm, 4*cm, 4*cm]
        career_table = Table(table_data, colWidths=col_widths)
        career_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e8edf5')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fc')]),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(career_table)
        story.append(Spacer(1, 0.5*cm))

    # Formule légale
    if doc_type == 'attestation':
        legal = "La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit."
    else:
        legal = "Le présent certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit."
    story.append(Paragraph(legal, style_body))
    story.append(Spacer(1, 1*cm))

    # === DATE ET LIEU ===
    story.append(Paragraph(f"Fait à {company_city}, le {today_date}", style_signature))
    story.append(Spacer(1, 1*cm))

    # === SIGNATURE (texte) ===
    story.append(Paragraph(f"<b>{signatory_name}</b>", style_signature))
    story.append(Paragraph(signatory_title, style_signature))

    # === SIGNATURE IMAGE + CACHET ===
    signature_path = cert_settings.get('certificate_signature')
    stamp_path = cert_settings.get('certificate_stamp')
    sig_elements = []

    if signature_path:
        full_sig_path = f"/app{signature_path}"
        if os.path.exists(full_sig_path):
            try:
                sig_img = Image(full_sig_path, width=4*cm, height=2*cm)
                sig_elements.append(sig_img)
            except Exception as e:
                print(f"Erreur chargement signature: {e}")

    if stamp_path:
        full_stamp_path = f"/app{stamp_path}"
        if os.path.exists(full_stamp_path):
            try:
                stamp_img = Image(full_stamp_path, width=3*cm, height=3*cm)
                sig_elements.append(stamp_img)
            except Exception as e:
                print(f"Erreur chargement cachet: {e}")

    if sig_elements:
        story.append(Spacer(1, 0.5*cm))
        if len(sig_elements) == 2:
            sig_table = Table([[sig_elements[0], sig_elements[1]]], colWidths=[5*cm, 4*cm])
            sig_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
            ]))
            sig_table.hAlign = 'RIGHT'
            story.append(sig_table)
        else:
            for elem in sig_elements:
                elem.hAlign = 'RIGHT'
                story.append(elem)

    story.append(Spacer(1, 1.5*cm))

    # === SIGNATURE DE L'EMPLOYÉ (attestation self-service uniquement) ===
    if doc_type == 'attestation' and getattr(employee, 'signature_url', None):
        try:
            import base64 as _b64
            sig_url: str = employee.signature_url
            raw_b64 = sig_url.split(',', 1)[1] if ',' in sig_url else sig_url
            img_bytes = _b64.b64decode(raw_b64)
            from io import BytesIO as _BytesIO
            style_emp_sig = ParagraphStyle(
                'EmpSig',
                parent=styles['Normal'],
                fontSize=9,
                leading=12,
                alignment=TA_LEFT,
            )
            story.append(Paragraph("Lu et approuvé par l'intéressé(e) :", style_emp_sig))
            story.append(Spacer(1, 0.3*cm))
            emp_sig_img = Image(_BytesIO(img_bytes), width=4*cm, height=1.5*cm)
            emp_sig_img.hAlign = 'LEFT'
            story.append(emp_sig_img)
            emp_name = f"{employee.first_name} {employee.last_name}"
            story.append(Paragraph(f"<b>{emp_name}</b>", style_emp_sig))
            story.append(Spacer(1, 0.5*cm))
        except Exception as _e:
            print(f"Erreur signature employé dans PDF: {_e}")

    # === PIED DE PAGE ===
    footer_text = f"Document généré électroniquement le {today_date} • Réf: {reference_number}"
    story.append(Paragraph(footer_text, style_footer))

    doc.build(story)
    buffer.seek(0)
    return buffer


# ============================================
# ENDPOINTS
# ============================================

@router.get("/me/work-certificate")
async def generate_my_work_certificate(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Génère l'attestation de travail de l'employé connecté (self-service).
    L'employé doit être actif.
    """
    if not current_user.employee_id:
        raise HTTPException(status_code=400, detail="Votre compte n'est pas lié à un profil employé")

    employee = db.query(Employee).filter(Employee.id == current_user.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Profil employé non trouvé")

    employee_status = str(employee.status.value if hasattr(employee.status, 'value') else employee.status).lower()
    if employee_status != "active":
        raise HTTPException(
            status_code=403,
            detail="Seuls les employés actifs peuvent générer leur attestation de travail"
        )

    cert_settings = get_certificate_settings(db, current_user.tenant_id)
    if not cert_settings:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")

    reference_number = generate_reference_number(db, current_user.tenant_id, doc_type='attestation')
    signatory_name, signatory_title = get_signatory(db, current_user.tenant_id, cert_settings)

    pdf_buffer = generate_certificate_pdf(
        employee=employee,
        cert_settings=cert_settings,
        reference_number=reference_number,
        signatory_name=signatory_name,
        signatory_title=signatory_title,
        doc_type='attestation'
    )

    certificate_record = WorkCertificate(
        tenant_id=current_user.tenant_id,
        employee_id=employee.id,
        reference_number=reference_number,
        generated_by_id=current_user.id,
        generation_type="self"
    )
    db.add(certificate_record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Race condition: le numéro a été pris entre la vérification et l'insert
        reference_number = f"ATT-{datetime.now().year}-{uuid.uuid4().hex[:8].upper()}"
        certificate_record.reference_number = reference_number
        db.add(certificate_record)
        db.commit()

    full_name = f"{employee.last_name}_{employee.first_name}".replace(' ', '_')
    filename = f"Attestation_Travail_{full_name}_{reference_number}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/employee/{employee_id}/work-certificate")
async def generate_employee_work_certificate(
    employee_id: int,
    doc_type: str = Query('attestation', description="'attestation' ou 'certificat'"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Génère une attestation ou un certificat de travail pour un employé (réservé RH/Admin/DG).
    - attestation : employé actif, texte au présent, sans historique de postes
    - certificat  : ex-employé, texte au passé, avec historique complet des postes
    """
    # Permissions
    user_role = current_user.role.value.lower() if hasattr(current_user.role, 'value') else str(current_user.role).lower()
    if user_role not in ('admin', 'dg', 'dga', 'rh', 'drh'):
        raise HTTPException(status_code=403, detail="Seul le service RH peut générer ces documents")

    if doc_type not in ('attestation', 'certificat'):
        raise HTTPException(status_code=400, detail="doc_type doit être 'attestation' ou 'certificat'")

    # Récupérer l'employé
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")

    # Date de départ et historique (certificat uniquement)
    departure_date = getattr(employee, 'end_date', None)
    career_history = (
        get_career_history(db, employee_id, employee.hire_date, departure_date)
        if doc_type == 'certificat' else None
    )

    # Paramètres de l'entreprise
    cert_settings = get_certificate_settings(db, current_user.tenant_id)
    if not cert_settings:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")

    reference_number = generate_reference_number(db, current_user.tenant_id, doc_type=doc_type)
    signatory_name, signatory_title = get_signatory(db, current_user.tenant_id, cert_settings)

    # Générer le PDF
    pdf_buffer = generate_certificate_pdf(
        employee=employee,
        cert_settings=cert_settings,
        reference_number=reference_number,
        signatory_name=signatory_name,
        signatory_title=signatory_title,
        career_history=career_history,
        departure_date=departure_date,
        doc_type=doc_type
    )

    # Historique
    certificate_record = WorkCertificate(
        tenant_id=current_user.tenant_id,
        employee_id=employee.id,
        reference_number=reference_number,
        generated_by_id=current_user.id,
        generation_type="rh"
    )
    db.add(certificate_record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        prefix = "ATT" if doc_type == 'attestation' else "CERT"
        reference_number = f"{prefix}-{datetime.now().year}-{uuid.uuid4().hex[:8].upper()}"
        certificate_record.reference_number = reference_number
        db.add(certificate_record)
        db.commit()

    full_name = f"{employee.last_name}_{employee.first_name}".replace(' ', '_')
    doc_label = "Attestation_Travail" if doc_type == 'attestation' else "Certificat_Travail"
    filename = f"{doc_label}_{full_name}_{reference_number}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/history")
async def get_certificates_history(
    employee_id: int = None,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Historique des certificats générés (RH/Admin uniquement).
    """
    user_role = current_user.role.value.lower() if hasattr(current_user.role, 'value') else str(current_user.role).lower()
    allowed_roles = ['admin', 'dg', 'dga', 'rh', 'drh']

    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès réservé au service RH")

    query = db.query(WorkCertificate).filter(
        WorkCertificate.tenant_id == current_user.tenant_id
    )

    if employee_id:
        query = query.filter(WorkCertificate.employee_id == employee_id)

    total = query.count()
    certificates = query.order_by(WorkCertificate.generated_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    result = []
    for cert in certificates:
        employee = db.query(Employee).filter(Employee.id == cert.employee_id).first()
        generated_by = db.query(User).filter(User.id == cert.generated_by_id).first() if cert.generated_by_id else None

        result.append({
            "id": cert.id,
            "reference_number": cert.reference_number,
            "employee_id": cert.employee_id,
            "employee_name": get_employee_name(employee) if employee else "N/A",
            "generated_at": cert.generated_at.isoformat() if cert.generated_at else None,
            "generated_by": generated_by.email if generated_by else "N/A",
            "generation_type": cert.generation_type
        })

    return {"items": result, "total": total, "page": page, "page_size": page_size}
