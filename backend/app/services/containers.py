"""Container service.

Plain functions, one per business operation. Routers stay thin and
delegate here. Errors flow through ``ToposError`` subclasses per
``.claude/rules/code-hygiene.md``.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.exceptions import ConflictError, NotFoundError
from app.models import Container, ContainerType, Owner
from app.schemas.container import ContainerCreate, ContainerUpdate


def list_containers(
    db: Session,
    owner: Owner | None = None,
    type: ContainerType | None = None,
) -> list[Container]:
    query = db.query(Container)
    if owner is not None:
        query = query.filter(Container.owner == owner)
    if type is not None:
        query = query.filter(Container.type == type)
    return query.order_by(Container.external_id).all()


def get_container(db: Session, container_id: int) -> Container:
    container = db.get(Container, container_id)
    if container is None:
        raise NotFoundError(f"Container {container_id} not found")
    return container


def get_container_by_external_id(db: Session, external_id: int) -> Container:
    container = db.query(Container).filter(Container.external_id == external_id).one_or_none()
    if container is None:
        raise NotFoundError(f"Container with external_id={external_id} not found")
    return container


def create_container(db: Session, payload: ContainerCreate) -> Container:
    existing = (
        db.query(Container).filter(Container.external_id == payload.external_id).one_or_none()
    )
    if existing is not None:
        raise ConflictError(f"Container with external_id={payload.external_id} already exists")
    container = Container(**payload.model_dump())
    db.add(container)
    db.commit()
    db.refresh(container)
    return container


def update_container(db: Session, container_id: int, payload: ContainerUpdate) -> Container:
    container = get_container(db, container_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(container, key, value)
    db.commit()
    db.refresh(container)
    return container


def delete_container(db: Session, container_id: int) -> None:
    container = get_container(db, container_id)
    db.delete(container)
    db.commit()
