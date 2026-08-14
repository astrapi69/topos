"""add containers.parent_container_id (physical nesting)

A folder stands in a shelf, a box in a cabinet: containers can nest.
The column is optional - top level stays the default - and references
the containers table itself with ON DELETE SET NULL, so deleting a
shelf detaches the folders standing in it instead of deleting them
(only a container's own items cascade, as before).

No backfill: every existing container is a top-level container, which
is exactly what NULL means.

Revision ID: d5b8c2e4a917
Revises: c3a7e1d9f402
Create Date: 2026-08-13

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "d5b8c2e4a917"
down_revision: Union[str, Sequence[str], None] = "c3a7e1d9f402"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite cannot ALTER TABLE ADD CONSTRAINT; batch_alter_table rebuilds
    # the table so the self-referencing FK actually exists (and with it
    # the ON DELETE SET NULL detach behaviour, PRAGMA foreign_keys=ON).
    with op.batch_alter_table("containers") as batch:
        batch.add_column(
            sa.Column("parent_container_id", sa.Integer(), nullable=True)
        )
        batch.create_foreign_key(
            "fk_containers_parent_container_id",
            "containers",
            ["parent_container_id"],
            ["id"],
            ondelete="SET NULL",
        )
    op.create_index(
        "ix_containers_parent_container_id",
        "containers",
        ["parent_container_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_containers_parent_container_id", table_name="containers")
    with op.batch_alter_table("containers") as batch:
        batch.drop_constraint(
            "fk_containers_parent_container_id", type_="foreignkey"
        )
        batch.drop_column("parent_container_id")
