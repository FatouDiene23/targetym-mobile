from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime


# Types de niveaux hiérarchiques
OrganizationalLevel = Literal[
    "president",           # Président
    "vice_president",      # Vice-Président
    "dg",                  # Direction Générale
    "dga",                 # Direction Générale Adjointe
    "direction_centrale",  # Direction Centrale
    "direction",           # Direction
    "departement",         # Département
    "service"              # Service
]


class DepartmentCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    color: str = "#3B82F6"
    level: OrganizationalLevel = "departement"
    parent_id: Optional[int] = None
    head_id: Optional[int] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    level: Optional[OrganizationalLevel] = None
    parent_id: Optional[int] = None
    head_id: Optional[int] = None
    is_active: Optional[bool] = None


class DepartmentResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    color: str = "#3B82F6"
    level: str = "departement"
    parent_id: Optional[int] = None
    head_id: Optional[int] = None
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    has_open_manager_position: bool = False

    class Config:
        from_attributes = True

    def model_post_init(self, __context: object) -> None:
        self.has_open_manager_position = self.head_id is None


class DepartmentWithChildren(DepartmentResponse):
    children: List["DepartmentWithChildren"] = []
    employee_count: int = 0


# Update forward reference
DepartmentWithChildren.model_rebuild()