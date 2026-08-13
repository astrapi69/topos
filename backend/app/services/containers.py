"""Container service.

Plain functions, one per business operation. Routers stay thin and
delegate here. Errors flow through ``ToposError`` subclasses per
``.claude/rules/code-hygiene.md``.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.exceptions import ConflictError, NotFoundError, ValidationError
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


def _assert_valid_parent(db: Session, container_id: int | None, parent_id: int | None) -> None:
    """Nesting guard: the parent must exist, and linking must not close a
    cycle. Walks the parent chain upward from the target - if the chain
    reaches the container being moved (or the container IS the target),
    the move would make it its own ancestor."""
    if parent_id is None:
        return
    parent = db.query(Container).filter(Container.id == parent_id).one_or_none()
    if parent is None:
        raise NotFoundError(f"Parent container {parent_id} not found")
    if container_id is None:
        return
    current: Container | None = parent
    seen: set[int] = set()
    while current is not None:
        if current.id == container_id:
            raise ValidationError(
                f"Container {container_id} cannot be moved into {parent_id}: "
                "it would become its own ancestor"
            )
        if current.id in seen:  # pre-existing corruption; do not loop forever
            break
        seen.add(current.id)
        current = (
            db.query(Container).filter(Container.id == current.parent_container_id).one_or_none()
            if current.parent_container_id is not None
            else None
        )


def create_container(db: Session, payload: ContainerCreate) -> Container:
    existing = (
        db.query(Container).filter(Container.external_id == payload.external_id).one_or_none()
    )
    if existing is not None:
        raise ConflictError(f"Container with external_id={payload.external_id} already exists")
    _assert_valid_parent(db, None, payload.parent_container_id)
    container = Container(**payload.model_dump())
    db.add(container)
    db.commit()
    db.refresh(container)
    return container


def update_container(db: Session, container_id: int, payload: ContainerUpdate) -> Container:
    container = get_container(db, container_id)
    data = payload.model_dump(exclude_unset=True)
    if "parent_container_id" in data:
        _assert_valid_parent(db, container_id, data["parent_container_id"])
    for key, value in data.items():
        setattr(container, key, value)
    db.commit()
    db.refresh(container)
    return container


def delete_container(db: Session, container_id: int) -> None:
    container = get_container(db, container_id)
    db.delete(container)
    db.commit()
    # Photo rows cascade-delete with the container; remove their files too.
    from app.services.container_photos import remove_container_photo_dir

    remove_container_photo_dir(container_id)
