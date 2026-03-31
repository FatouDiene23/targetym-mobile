import httpx
from typing import Optional

ASANA_BASE = "https://app.asana.com/api/1.0"


def test_connection(token: str) -> dict:
    """Test the Asana connection."""
    resp = httpx.get(
        f"{ASANA_BASE}/users/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    resp.raise_for_status()
    me = resp.json().get("data", {})
    workspaces = me.get("workspaces", [])
    return {
        "status": "ok",
        "user": me.get("name"),
        "email": me.get("email"),
        "workspaces": [{"id": w["gid"], "name": w["name"]} for w in workspaces],
    }


def list_workspaces(token: str) -> list:
    """List Asana workspaces."""
    resp = httpx.get(
        f"{ASANA_BASE}/workspaces",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json().get("data", [])
    return [{"id": w["gid"], "name": w["name"]} for w in data]


def create_project(
    token: str,
    workspace_id: str,
    name: str,
    notes: str = "",
) -> dict:
    """Create an Asana project in a workspace."""
    resp = httpx.post(
        f"{ASANA_BASE}/projects",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={
            "data": {
                "workspace": workspace_id,
                "name": name,
                "notes": notes,
            }
        },
        timeout=30,
    )
    resp.raise_for_status()
    project = resp.json().get("data", {})
    return {
        "id": project["gid"],
        "name": project["name"],
        "url": project.get("permalink_url"),
    }


def create_task(
    token: str,
    workspace_id: str,
    name: str,
    notes: str = "",
    assignee_email: Optional[str] = None,
    due_on: Optional[str] = None,
    project_id: Optional[str] = None,
) -> dict:
    """Create a task in Asana."""
    task_data = {
        "workspace": workspace_id,
        "name": name,
        "notes": notes,
    }
    if assignee_email:
        task_data["assignee"] = assignee_email
    if due_on:
        task_data["due_on"] = due_on
    if project_id:
        task_data["projects"] = [project_id]

    resp = httpx.post(
        f"{ASANA_BASE}/tasks",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"data": task_data},
        timeout=30,
    )
    resp.raise_for_status()
    task = resp.json().get("data", {})
    return {
        "id": task["gid"],
        "name": task["name"],
        "url": task.get("permalink_url"),
    }


def update_task(
    token: str,
    task_id: str,
    name: Optional[str] = None,
    notes: Optional[str] = None,
    completed: Optional[bool] = None,
    due_on: Optional[str] = None,
) -> dict:
    """Update an existing Asana task."""
    data = {}
    if name is not None:
        data["name"] = name
    if notes is not None:
        data["notes"] = notes
    if completed is not None:
        data["completed"] = completed
    if due_on is not None:
        data["due_on"] = due_on

    resp = httpx.put(
        f"{ASANA_BASE}/tasks/{task_id}",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"data": data},
        timeout=30,
    )
    resp.raise_for_status()
    task = resp.json().get("data", {})
    return {
        "id": task["gid"],
        "name": task["name"],
        "completed": task.get("completed"),
        "url": task.get("permalink_url"),
    }


def get_task(token: str, task_id: str) -> dict:
    """Get a single Asana task by ID."""
    resp = httpx.get(
        f"{ASANA_BASE}/tasks/{task_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    resp.raise_for_status()
    task = resp.json().get("data", {})
    return {
        "id": task["gid"],
        "name": task["name"],
        "notes": task.get("notes", ""),
        "completed": task.get("completed"),
        "due_on": task.get("due_on"),
        "assignee": task.get("assignee"),
        "url": task.get("permalink_url"),
    }


def list_project_tasks(token: str, project_id: str) -> list:
    """List tasks in an Asana project."""
    resp = httpx.get(
        f"{ASANA_BASE}/projects/{project_id}/tasks",
        headers={"Authorization": f"Bearer {token}"},
        params={"opt_fields": "name,completed,due_on,assignee.name,permalink_url"},
        timeout=30,
    )
    resp.raise_for_status()
    tasks = resp.json().get("data", [])
    return [
        {
            "id": t["gid"],
            "name": t["name"],
            "completed": t.get("completed"),
            "due_on": t.get("due_on"),
            "assignee": t.get("assignee", {}).get("name") if t.get("assignee") else None,
            "url": t.get("permalink_url"),
        }
        for t in tasks
    ]
