"""Container CRUD + lookup-by-external-id."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ContainerType, Owner
from app.schemas.container import ContainerCreate, ContainerRead, ContainerUpdate
from app.services import containers as service

router = APIRouter(prefix="/containers", tags=["containers"])


@router.get("", response_model=list[ContainerRead])
def list_containers(
    owner: Owner | None = None,
    type: ContainerType | None = None,
    db: Session = Depends(get_db),
) -> list[ContainerRead]:
    rows = service.list_containers(db, owner=owner, type=type)
    return [ContainerRead.model_validate(row) for row in rows]


@router.get("/by-external-id/{external_id}", response_model=ContainerRead)
def get_by_external_id(external_id: int, db: Session = Depends(get_db)) -> ContainerRead:
    return ContainerRead.model_validate(service.get_container_by_external_id(db, external_id))


@router.get("/{container_id}", response_model=ContainerRead)
def get_container(container_id: int, db: Session = Depends(get_db)) -> ContainerRead:
    return ContainerRead.model_validate(service.get_container(db, container_id))


@router.post("", response_model=ContainerRead, status_code=status.HTTP_201_CREATED)
def create_container(payload: ContainerCreate, db: Session = Depends(get_db)) -> ContainerRead:
    return ContainerRead.model_validate(service.create_container(db, payload))


@router.patch("/{container_id}", response_model=ContainerRead)
def update_container(
    container_id: int, payload: ContainerUpdate, db: Session = Depends(get_db)
) -> ContainerRead:
    return ContainerRead.model_validate(service.update_container(db, container_id, payload))


@router.delete("/{container_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_container(container_id: int, db: Session = Depends(get_db)) -> Response:
    service.delete_container(db, container_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
