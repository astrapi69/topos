"""add container_photos

Revision ID: b2f4a9c7d1e3
Revises: 0b846e96f438
Create Date: 2026-08-06

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2f4a9c7d1e3"
down_revision: Union[str, Sequence[str], None] = "0b846e96f438"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "container_photos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("container_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("mime", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["container_id"], ["containers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("container_photos", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_container_photos_container_id"), ["container_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_container_photos_token"), ["token"], unique=True
        )


def downgrade() -> None:
    with op.batch_alter_table("container_photos", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_container_photos_token"))
        batch_op.drop_index(batch_op.f("ix_container_photos_container_id"))
    op.drop_table("container_photos")
