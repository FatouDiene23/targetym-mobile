"""
Sync hooks — fire-and-forget integration syncs after DB operations.
Each function checks if the relevant integration is active before calling provider APIs.
Errors are logged but never raised to avoid breaking the main flow.
"""
from sqlalchemy.orm import Session
from datetime import timedelta

from app.services.integration_service import get_integration, get_valid_access_token, log_sync


def sync_leave_approved(db: Session, tenant_id: int, leave_request) -> None:
    """After a leave is approved, sync to Outlook/Google Calendar."""
    try:
        employee = leave_request.employee
        if not employee or not employee.email:
            return

        leave_data = {
            "type": leave_request.leave_type if hasattr(leave_request, 'leave_type') else "Congé",
            "start_date": leave_request.start_date.isoformat() if leave_request.start_date else None,
            "end_date": (leave_request.end_date + timedelta(days=1)).isoformat() if leave_request.end_date else None,
            "employee_name": f"{employee.first_name} {employee.last_name}",
        }

        if not leave_data["start_date"] or not leave_data["end_date"]:
            return

        # Try Teams/Outlook
        teams_int = get_integration(db, tenant_id, "teams")
        if teams_int:
            try:
                token = get_valid_access_token(db, teams_int)
                from app.services.teams_service import sync_leave_to_outlook
                result = sync_leave_to_outlook(token, employee.email, leave_data)
                log_sync(db, tenant_id, "teams", "leave", "push", "success", items_synced=1)
            except Exception as e:
                log_sync(db, tenant_id, "teams", "leave", "push", "error", error_details=str(e))

        # Try Google Calendar
        google_int = get_integration(db, tenant_id, "google")
        if google_int:
            try:
                token = get_valid_access_token(db, google_int)
                from app.services.google_service import sync_leave_to_calendar
                result = sync_leave_to_calendar(token, employee.email, leave_data)
                log_sync(db, tenant_id, "google", "leave", "push", "success", items_synced=1)
            except Exception as e:
                log_sync(db, tenant_id, "google", "leave", "push", "error", error_details=str(e))

    except Exception as e:
        print(f"[sync_hooks] sync_leave_approved error: {e}")


def sync_task_created(db: Session, tenant_id: int, task) -> None:
    """After a task is created, sync to Asana if connected."""
    try:
        asana_int = get_integration(db, tenant_id, "asana")
        if not asana_int:
            return

        token = get_valid_access_token(db, asana_int)
        metadata = asana_int.provider_metadata or {}
        workspaces = metadata.get("workspaces", [])
        if not workspaces:
            return

        workspace_id = workspaces[0].get("gid") or workspaces[0].get("id")
        if not workspace_id:
            return

        from app.services.asana_service import create_task as asana_create_task
        result = asana_create_task(
            token=token,
            workspace_id=workspace_id,
            name=task.title,
            notes=task.description or "",
            due_on=task.due_date.isoformat() if task.due_date else None,
        )

        # Store external reference
        if result.get("id"):
            task.external_id = result["id"]
            task.external_url = result.get("url")
            task.source = "asana"
            db.commit()

        log_sync(db, tenant_id, "asana", "task", "push", "success", items_synced=1)

    except Exception as e:
        log_sync(db, tenant_id, "asana", "task", "push", "error", error_details=str(e))
        print(f"[sync_hooks] sync_task_created error: {e}")


def sync_task_updated(db: Session, tenant_id: int, task) -> None:
    """After a task is updated, sync to Asana if it has an external_id."""
    try:
        if not task.external_id:
            return

        asana_int = get_integration(db, tenant_id, "asana")
        if not asana_int:
            return

        token = get_valid_access_token(db, asana_int)
        from app.services.asana_service import update_task as asana_update_task

        asana_update_task(
            token=token,
            task_id=task.external_id,
            name=task.title,
            notes=task.description or "",
            completed=task.status == "completed",
            due_on=task.due_date.isoformat() if task.due_date else None,
        )
        log_sync(db, tenant_id, "asana", "task", "push", "success", items_synced=1)

    except Exception as e:
        log_sync(db, tenant_id, "asana", "task", "push", "error", error_details=str(e))
        print(f"[sync_hooks] sync_task_updated error: {e}")


def sync_one_on_one_created(db: Session, tenant_id: int, one_on_one, manager_email: str, employee_email: str) -> None:
    """After a 1-on-1 is scheduled, sync to Teams/Google Calendar."""
    try:
        if not one_on_one.scheduled_date:
            return

        start = one_on_one.scheduled_date.isoformat()
        duration = one_on_one.duration_minutes or 30
        end = (one_on_one.scheduled_date + timedelta(minutes=duration)).isoformat()
        title = f"1-on-1: {one_on_one.topics or 'Suivi'}"

        meeting_data = {
            "title": title,
            "start": start,
            "end": end,
            "attendee_email": employee_email,
        }

        # Try Teams
        teams_int = get_integration(db, tenant_id, "teams")
        if teams_int:
            try:
                token = get_valid_access_token(db, teams_int)
                from app.services.teams_service import sync_one_on_one_to_outlook
                result = sync_one_on_one_to_outlook(token, manager_email, meeting_data)
                if result.get("join_url"):
                    one_on_one.location = result["join_url"]
                    db.commit()
                log_sync(db, tenant_id, "teams", "one_on_one", "push", "success", items_synced=1)
                return  # Don't also sync to Google if Teams worked
            except Exception as e:
                log_sync(db, tenant_id, "teams", "one_on_one", "push", "error", error_details=str(e))

        # Try Google Calendar
        google_int = get_integration(db, tenant_id, "google")
        if google_int:
            try:
                token = get_valid_access_token(db, google_int)
                from app.services.google_service import sync_one_on_one_to_calendar
                result = sync_one_on_one_to_calendar(token, manager_email, meeting_data)
                if result.get("meet_url"):
                    one_on_one.location = result["meet_url"]
                    db.commit()
                log_sync(db, tenant_id, "google", "one_on_one", "push", "success", items_synced=1)
            except Exception as e:
                log_sync(db, tenant_id, "google", "one_on_one", "push", "error", error_details=str(e))

    except Exception as e:
        print(f"[sync_hooks] sync_one_on_one_created error: {e}")


def sync_interview_created(db: Session, tenant_id: int, interview, organizer_email: str, candidate_name: str, attendee_emails: list) -> None:
    """After an interview is scheduled, sync to Teams/Google Calendar."""
    try:
        if not interview.scheduled_at:
            return

        start = interview.scheduled_at.isoformat()
        end = (interview.scheduled_at + timedelta(hours=1)).isoformat()

        interview_data = {
            "title": f"Entretien {interview.interview_type or ''}".strip(),
            "start": start,
            "end": end,
            "candidate_name": candidate_name,
            "attendees": attendee_emails,
        }

        # Try Teams
        teams_int = get_integration(db, tenant_id, "teams")
        if teams_int:
            try:
                token = get_valid_access_token(db, teams_int)
                from app.services.teams_service import sync_interview_to_outlook
                result = sync_interview_to_outlook(token, organizer_email, interview_data)
                if result.get("join_url"):
                    interview.meeting_link = result["join_url"]
                    db.commit()
                log_sync(db, tenant_id, "teams", "interview", "push", "success", items_synced=1)
                return
            except Exception as e:
                log_sync(db, tenant_id, "teams", "interview", "push", "error", error_details=str(e))

        # Try Google Calendar
        google_int = get_integration(db, tenant_id, "google")
        if google_int:
            try:
                token = get_valid_access_token(db, google_int)
                from app.services.google_service import sync_interview_to_calendar
                result = sync_interview_to_calendar(token, organizer_email, interview_data)
                if result.get("meet_url"):
                    interview.meeting_link = result["meet_url"]
                    db.commit()
                log_sync(db, tenant_id, "google", "interview", "push", "success", items_synced=1)
            except Exception as e:
                log_sync(db, tenant_id, "google", "interview", "push", "error", error_details=str(e))

    except Exception as e:
        print(f"[sync_hooks] sync_interview_created error: {e}")
