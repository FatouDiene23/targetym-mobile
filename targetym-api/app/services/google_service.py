import httpx
from typing import Optional

GCAL_BASE = "https://www.googleapis.com/calendar/v3"


def test_connection(token: str) -> dict:
    """Test the Google Workspace connection."""
    resp = httpx.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    resp.raise_for_status()
    me = resp.json()
    return {
        "status": "ok",
        "user": me.get("name"),
        "email": me.get("email"),
    }


def sync_leave_to_calendar(
    token: str,
    employee_email: str,
    leave: dict,
) -> dict:
    """Create an all-day event in Google Calendar for a leave.

    leave dict: {type, start_date, end_date, employee_name}
    """
    event = {
        "summary": f"Congé - {leave['employee_name']} ({leave['type']})",
        "start": {"date": leave["start_date"]},
        "end": {"date": leave["end_date"]},
        "transparency": "opaque",
        "status": "confirmed",
    }

    resp = httpx.post(
        f"{GCAL_BASE}/calendars/{employee_email}/events",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=event,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    return {"event_id": data["id"], "html_link": data.get("htmlLink")}


def delete_calendar_event(token: str, employee_email: str, event_id: str):
    """Delete a Google Calendar event."""
    resp = httpx.delete(
        f"{GCAL_BASE}/calendars/{employee_email}/events/{event_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    resp.raise_for_status()


def create_meeting(
    token: str,
    organizer_email: str,
    subject: str,
    start: str,
    end: str,
    attendees: list[str],
) -> dict:
    """Create a Google Calendar event with Google Meet link.

    Returns: {event_id, meet_url, html_link}
    """
    attendee_list = [{"email": email} for email in attendees]

    event = {
        "summary": subject,
        "start": {"dateTime": start, "timeZone": "UTC"},
        "end": {"dateTime": end, "timeZone": "UTC"},
        "attendees": attendee_list,
        "conferenceData": {
            "createRequest": {
                "requestId": f"targetym-{start}",
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
    }

    resp = httpx.post(
        f"{GCAL_BASE}/calendars/{organizer_email}/events",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        params={"conferenceDataVersion": 1},
        json=event,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    meet_url = None
    conference = data.get("conferenceData")
    if conference:
        for ep in conference.get("entryPoints", []):
            if ep.get("entryPointType") == "video":
                meet_url = ep.get("uri")
                break

    return {
        "event_id": data["id"],
        "meet_url": meet_url,
        "html_link": data.get("htmlLink"),
    }


def sync_interview_to_calendar(
    token: str,
    organizer_email: str,
    interview: dict,
) -> dict:
    """Sync a recruitment interview to Google Calendar + Meet.

    interview dict: {title, start, end, candidate_name, attendees}
    """
    subject = f"Entretien - {interview['candidate_name']}: {interview.get('title', 'Entretien')}"
    return create_meeting(
        token=token,
        organizer_email=organizer_email,
        subject=subject,
        start=interview["start"],
        end=interview["end"],
        attendees=interview.get("attendees", []),
    )


def sync_one_on_one_to_calendar(
    token: str,
    organizer_email: str,
    one_on_one: dict,
) -> dict:
    """Sync a 1-on-1 meeting to Google Calendar + Meet.

    one_on_one dict: {title, start, end, attendee_email}
    """
    return create_meeting(
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
    """List Google Calendar events for a user in a date range."""
    params = {
        "timeMin": start,
        "timeMax": end,
        "orderBy": "startTime",
        "singleEvents": True,
        "maxResults": 100,
    }
    resp = httpx.get(
        f"{GCAL_BASE}/calendars/{user_email}/events",
        headers={"Authorization": f"Bearer {token}"},
        params=params,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get("items", [])
