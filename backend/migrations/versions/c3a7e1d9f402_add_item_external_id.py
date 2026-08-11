"""add items.external_id (per-container item number)

Containers already carry a user-facing ``external_id`` ("Nr. 42"); items
get one too, counted per container, so an entry can be referenced the
way it is found physically: third entry in folder 42 is "42-3".

The column is nullable and backfilled here in creation order per
container. The service also backfills lazily on read, so a row inserted
by an older build (or a raw insert) still ends up numbered.

Revision ID: c3a7e1d9f402
Revises: b2f4a9c7d1e3
Create Date: 2026-08-11

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3a7e1d9f402"
down_revision: Union[str, Sequence[str], None] = "b2f4a9c7d1e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("items", sa.Column("external_id", sa.Integer(), nullable=True))
    op.create_index("ix_items_external_id", "items", ["external_id"])

    # Backfill: number each container's items 1..n in creation order.
    connection = op.get_bind()
    rows = connection.execute(
        sa.text("SELECT id, container_id FROM items ORDER BY container_id, id")
    ).fetchall()
    counters: dict[int, int] = {}
    for item_id, container_id in rows:
        counters[container_id] = counters.get(container_id, 0) + 1
        connection.execute(
            sa.text("UPDATE items SET external_id = :number WHERE id = :id"),
            {"number": counters[container_id], "id": item_id},
        )


def downgrade() -> None:
    op.drop_index("ix_items_external_id", table_name="items")
    op.drop_column("items", "external_id")
