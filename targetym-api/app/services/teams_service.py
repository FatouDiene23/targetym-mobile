import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.core.config import settings

# Cache for app token to avoid requesting a new one every call
_app_token_cache: dict = {"token": None, "expires_at": None}


def _get_app_token() -> str:
    """Get a Microsoft Graph application token using client credentials flow.
    This token can act on any user in the tenant.
    """
    now = datetime.now(timezone.utc)
    if _app_token_cache["token"] and _app_token_cache["expires_at"] and _app_token_cache["expires_at"] > now:
        return _app_token_cache["token"]

    tenant_id = settings.MICROSOFT_TENANT_ID
    if not tenant_id:
        raise ValueError("MICROSOFT_TENANT_ID not configured")

    resp = httpx.post(
        f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token",
        data={
            "grant_type": "client_credentials",
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "client_secret": settings.MICROSOFT_CLIENT_SECRET,
            "scope": "https://graph.microsoft.com/.default",
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    _app_token_cache["token"] = data["access_token"]
    _app_token_cache["expires_at"] = now + timedelta(seconds=data.get("expires_in", 3600) - 60)

    return data["access_token"]


def test_connection(token: str) -> dict:
    """Test the Microsoft Teams/Outlook connection.
    Uses the user's delegated token for the test (from OAuth connect flow).
    """
    resp = httpx.get(
        "https://graph.microsoft.com/v1.0/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    resp.raise_for_status()
    me = resp.json()
    return {
        "status": "ok",
        "user": me.get("displayName"),
        "email": me.get("mail") or me.get("userPrincipalName"),
    }


def sync_leave_to_outlook(
    token: str,
    employee_email: str,
    leave: dict,
) -> dict:
    """Create an all-day event in Outlook Calendar for a leave.
    Uses app token to write to any user's calendar.
    """
    app_token = _get_app_token()

    event = {
        "subject": f"Congé - {leave['employee_name']} ({leave['type']})",
        "start": {
            "dateTime": leave["start_date"],
            "timeZone": "UTC",
        },
        "end": {
            "dateTime": leave["end_date"],
            "timeZone": "UTC",
        },
        "isAllDay": True,
        "showAs": "oof",
        "categories": ["Congé"],
    }

    resp = httpx.post(
        f"https://graph.microsoft.com/v1.0/users/{employee_email}/calendar/events",
        headers={
            "Authorization": f"Bearer {app_token}",
            "Content-Type": "application/json",
        },
        json=event,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    return {"event_id": data["id"], "web_link": data.get("webLink")}


def delete_outlook_event(token: str, employee_email: str, event_id: str):
    """Delete an Outlook Calendar event."""
    app_token = _get_app_token()
    resp = httpx.delete(
        f"https://graph.microsoft.com/v1.0/users/{employee_email}/calendar/events/{event_id}",
        headers={"Authorization": f"Bearer {app_token}"},
        timeout=15,
    )
    resp.raise_for_status()


def create_online_meeting(
    token: str,
    organizer_email: str,
    subject: str,
    start: str,
    end: str,
    attendees: list[str],
) -> dict:
    """Create a Teams online meeting with calendar event.
    Uses app token to create on the organizer's calendar.

    Returns: {event_id, join_url, web_link}
    """
    app_token = _get_app_token()

    attendee_list = [
        {
            "emailAddress": {"address": email},
            "type": "required",
        }
        for email in attendees
    ]

    event = {
        "subject": subject,
        "start": {"dateTime": start, "timeZone": "UTC"},
        "end": {"dateTime": end, "timeZone": "UTC"},
        "attendees": attendee_list,
        "isOnlineMeeting": True,
        "onlineMeetingProvider": "teamsForBusiness",
    }

    resp = httpx.post(
        f"https://graph.microsoft.com/v1.0/users/{organizer_email}/calendar/events",
        headers={
            "Authorization": f"Bearer {app_token}",
            "Content-Type": "application/json",
        },
        json=event,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    return {
        "event_id": data["id"],
        "join_url": data.get("onlineMeeting", {}).get("joinUrl"),
        "web_link": data.get("webLink"),
    }


def sync_interview_to_outlook(
    token: str,
    organizer_email: str,
    interview: dict,
) -> dict:
    """Sync a recruitment interview to Outlook + Teams meeting."""
    subject = f"Entretien - {interview['candidate_name']}: {interview.get('title', 'Entretien')}"
    return create_online_meeting(
        token=token,
        organizer_email=organizer_email,
        subject=subject,
        start=interview["start"],
        end=interview["end"],
        attendees=interview.get("attendees", []),
    )


def sync_one_on_one_to_outlook(
    token: str,
    organizer_email: str,
    one_on_one: dict,
) -> dict:
    """Sync a 1-on-1 meeting to Outlook + Teams."""
    return create_online_meeting(
        token=token,
        organizer_email=organizer_email,
        subject=one_on_one.get("title", "1-on-1"),
        start=one_on_one["start"],
        end=one_on_one["end"],
        attendees=[one_on_one["attendee_email"]],
    )


def list_calendar_events(
    token: str,
    user_email: str,
    start: str,
    end: str,
) -> list:
    """List Outlook Calendar events for a user in a date range."""
    app_token = _get_app_token()
    params = {
        "$filter": f"start/dateTime ge '{start}' and end/dateTime le '{end}'",
        "$orderby": "start/dateTime",
        "$top": 100,
    }
    resp = httpx.get(
        f"https://graph.microsoft.com/v1.0/users/{user_email}/calendar/events",
        headers={"Authorization": f"Bearer {app_token}"},
        params=params,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get("value", [])
