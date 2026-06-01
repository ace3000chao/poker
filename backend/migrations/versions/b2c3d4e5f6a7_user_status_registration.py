"""user approval status + registration fields

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-31 20:30:00.000000

给 users 增加:
  - status:注册审核状态 pending/approved/rejected
    (server_default='approved' → 现存用户一律视为已通过,不被锁;
     新用户经 ORM 插入时用模型默认 'pending')
  - real_name / grade / reg_major:注册填写,供管理员核验校友身份
"""
from alembic import op
import sqlalchemy as sa


revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('status', sa.String(length=20),
                                      nullable=False, server_default='approved'))
        batch_op.add_column(sa.Column('real_name', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('grade', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('reg_major', sa.String(length=100), nullable=True))
        batch_op.create_index('ix_users_status', ['status'], unique=False)


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index('ix_users_status')
        batch_op.drop_column('reg_major')
        batch_op.drop_column('grade')
        batch_op.drop_column('real_name')
        batch_op.drop_column('status')
