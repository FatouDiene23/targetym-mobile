"""
Service de génération du PDF final signé.

Processus :
  1. Décode le PDF original (base64).
  2. Ajoute une page de couverture des signatures (image canvas + métadonnées).
  3. Ajoute une page d'audit trail (qui, quand, IP, hash PDF original).
  4. Retourne les bytes du PDF final.
"""

import base64
import io
from datetime import datetime, timezone
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader
from PyPDF2 import PdfReader, PdfWriter

# ── Constantes mise en page ───────────────────────────────────────────────────

W, H = A4          # 595.28 x 841.89 pt
MARGIN = 2 * cm
PRIMARY = colors.HexColor("#2563eb")   # bleu
GRAY    = colors.HexColor("#6b7280")
LIGHT   = colors.HexColor("#f1f5f9")
DARK    = colors.HexColor("#1e293b")

FR_LOCALE_MONTHS = [
    "", "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]


def _fmt_date(dt: Optional[datetime]) -> str:
    if dt is None:
        return "—"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    m = FR_LOCALE_MONTHS[dt.month]
    return f"{dt.day} {m} {dt.year} à {dt.strftime('%H:%M')} UTC"


# ── Page "Signatures" ─────────────────────────────────────────────────────────

def _build_signatures_page(
    doc_title: str,
    requests: list,   # list of SignatureRequest ORM objects + employee names
    original_hash: Optional[str],
) -> bytes:
    """Génère une page PDF résumant toutes les signatures (images + métadonnées)."""
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)

    # ── En-tête ──────────────────────────────────────────────────────────────
    c.setFillColor(PRIMARY)
    c.rect(0, H - 3 * cm, W, 3 * cm, fill=True, stroke=False)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(MARGIN, H - 1.6 * cm, "Document signé électroniquement")
    c.setFont("Helvetica", 10)
    c.drawString(MARGIN, H - 2.4 * cm, doc_title[:90])

    # ── Sous-titre ───────────────────────────────────────────────────────────
    y = H - 3.8 * cm
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN, y, "Signatures des parties")
    y -= 0.4 * cm

    # ── Bloc par signataire ──────────────────────────────────────────────────
    BOX_H = 4.5 * cm

    for req in requests:
        emp_name  = getattr(req, "_employee_name", f"Employé #{req.employee_id}")
        status    = req.status.value if hasattr(req.status, "value") else req.status
        signed_at = req.signed_at
        ip        = req.ip_address or "—"
        sig_b64   = req.signature_image_b64

        y -= 0.3 * cm
        if y - BOX_H < MARGIN:
            c.showPage()
            y = H - MARGIN

        # Cadre
        c.setFillColor(LIGHT)
        c.roundRect(MARGIN, y - BOX_H, W - 2 * MARGIN, BOX_H, 6, fill=True, stroke=False)

        # Nom
        c.setFillColor(DARK)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(MARGIN + 0.4 * cm, y - 0.7 * cm, emp_name)

        # Status badge
        badge_color = colors.HexColor("#16a34a") if status == "signed" else colors.HexColor("#dc2626")
        label       = "✓ Signé" if status == "signed" else "✗ Refusé" if status == "rejected" else status
        c.setFillColor(badge_color)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(W - MARGIN - 4 * cm, y - 0.7 * cm, label)

        c.setFillColor(GRAY)
        c.setFont("Helvetica", 8)
        c.drawString(MARGIN + 0.4 * cm, y - 1.25 * cm, f"Date : {_fmt_date(signed_at)}")
        c.drawString(MARGIN + 0.4 * cm, y - 1.7 * cm,  f"IP   : {ip}")

        if req.rejection_reason:
            c.setFillColor(colors.HexColor("#dc2626"))
            c.setFont("Helvetica-Oblique", 8)
            c.drawString(MARGIN + 0.4 * cm, y - 2.15 * cm, f"Motif : {req.rejection_reason[:80]}")

        # Image signature
        if sig_b64 and status == "signed":
            try:
                sig_bytes = base64.b64decode(sig_b64)
                sig_img   = ImageReader(io.BytesIO(sig_bytes))
                # Zone dédiée à la signature : 6cm x 2cm, alignée à droite
                img_x = W - MARGIN - 6.5 * cm
                img_y = y - BOX_H + 0.4 * cm
                c.drawImage(sig_img, img_x, img_y, width=6 * cm, height=2 * cm,
                            preserveAspectRatio=True, mask="auto")
                # Ligne de signature
                c.setStrokeColor(GRAY)
                c.setLineWidth(0.5)
                c.line(img_x, img_y - 0.1 * cm, img_x + 6 * cm, img_y - 0.1 * cm)
            except Exception:
                pass

        y -= BOX_H + 0.2 * cm

    # ── Hash original ─────────────────────────────────────────────────────────
    if original_hash:
        y -= 0.6 * cm
        if y - 1.2 * cm < MARGIN:
            c.showPage()
            y = H - MARGIN
        c.setFillColor(GRAY)
        c.setFont("Helvetica", 7)
        c.drawString(MARGIN, y, f"Empreinte SHA-256 du document original : {original_hash}")

    c.save()
    buf.seek(0)
    return buf.read()


# ── Page "Audit Trail" ────────────────────────────────────────────────────────

def _build_audit_page(
    doc_title: str,
    doc_id: int,
    requests: list,
    original_hash: Optional[str],
    generated_at: datetime,
) -> bytes:
    """Génère une page d'audit trail complète."""
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)

    # En-tête gris foncé
    c.setFillColor(DARK)
    c.rect(0, H - 2.5 * cm, W, 2.5 * cm, fill=True, stroke=False)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(MARGIN, H - 1.4 * cm, "Audit Trail — Journal de signature")
    c.setFont("Helvetica", 9)
    c.drawString(MARGIN, H - 2.1 * cm, f"Document #{doc_id} · {doc_title[:70]}")

    y = H - 3.2 * cm

    # Infos document
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN, y, "Informations document")
    y -= 0.5 * cm
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN, y, f"Généré le : {_fmt_date(generated_at)}")
    y -= 0.4 * cm
    if original_hash:
        c.drawString(MARGIN, y, f"SHA-256 original : {original_hash}")
        y -= 0.4 * cm

    # Séparateur
    y -= 0.3 * cm
    c.setStrokeColor(colors.HexColor("#e2e8f0"))
    c.setLineWidth(0.5)
    c.line(MARGIN, y, W - MARGIN, y)
    y -= 0.5 * cm

    # Événements
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN, y, "Événements")
    y -= 0.5 * cm

    for req in requests:
        emp_name  = getattr(req, "_employee_name", f"Employé #{req.employee_id}")
        status    = req.status.value if hasattr(req.status, "value") else req.status

        events = []
        if req.viewed_at:
            events.append(("Consultation", req.viewed_at, req.ip_address))
        if req.signed_at and status == "signed":
            events.append(("Signature", req.signed_at, req.ip_address))
        if status == "rejected":
            events.append(("Refus", None, req.ip_address))

        for evt_label, evt_dt, evt_ip in events:
            if y - 0.8 * cm < MARGIN:
                c.showPage()
                y = H - MARGIN
            c.setFillColor(PRIMARY if evt_label == "Signature" else DARK)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(MARGIN, y, f"• {evt_label}")
            c.setFillColor(GRAY)
            c.setFont("Helvetica", 8)
            c.drawString(MARGIN + 2.5 * cm, y, emp_name)
            c.drawString(MARGIN + 8 * cm,   y, _fmt_date(evt_dt) if evt_dt else "—")
            c.drawString(MARGIN + 14.5 * cm, y, f"IP: {evt_ip or '—'}")
            y -= 0.55 * cm

    # Pied de page
    c.setFillColor(GRAY)
    c.setFont("Helvetica-Oblique", 7)
    c.drawString(MARGIN, MARGIN * 0.6,
                 "Ce document a valeur de preuve de signature. Conservez-le avec le document original.")

    c.save()
    buf.seek(0)
    return buf.read()


# ── Assemblage final ──────────────────────────────────────────────────────────

def build_final_pdf(
    document,       # SignatureDocument ORM
    requests: list, # list of SignatureRequest ORM (with ._employee_name injected)
) -> bytes:
    """
    Assemble le PDF final :
      - Pages du document original
      - Page de signatures (images + métadonnées)
      - Page audit trail

    Retourne les bytes du PDF complet.
    """
    writer = PdfWriter()

    # 1. Pages du document original
    try:
        original_bytes = base64.b64decode(document.file_data)
        reader = PdfReader(io.BytesIO(original_bytes))
        for page in reader.pages:
            writer.add_page(page)
    except Exception:
        pass   # fichier corrompu → on continue sans les pages originales

    # 2. Page signatures
    sig_pdf = _build_signatures_page(
        doc_title=document.title,
        requests=requests,
        original_hash=document.hash_sha256,
    )
    for page in PdfReader(io.BytesIO(sig_pdf)).pages:
        writer.add_page(page)

    # 3. Page audit trail
    audit_pdf = _build_audit_page(
        doc_title=document.title,
        doc_id=document.id,
        requests=requests,
        original_hash=document.hash_sha256,
        generated_at=datetime.utcnow(),
    )
    for page in PdfReader(io.BytesIO(audit_pdf)).pages:
        writer.add_page(page)

    # 4. Métadonnées PDF
    writer.add_metadata({
        "/Title": document.title,
        "/Author": "Targetym AI — Signatures Électroniques",
        "/Subject": f"Document signé — #{document.id}",
        "/Creator": "Targetym AI",
    })

    out = io.BytesIO()
    writer.write(out)
    out.seek(0)
    return out.read()
