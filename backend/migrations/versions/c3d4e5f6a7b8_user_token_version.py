"""user token_version for JWT revocation

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-01 12:30:00.000000

给 users 增加 token_version:登出/封号时自增,签发的 JWT 内嵌 tv,
校验时比对,不一致即视为已吊销 —— 让无状态 JWT 具备「立即失效」能力。
server_default='0' → 现存用户既有 token 继续有效(tv 默认 0)。
"""
from alembic import op
import sqlalchemy as sa


revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('token_version', sa.Integer(),
                                      nullable=False, server_default='0'))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('token_version')
