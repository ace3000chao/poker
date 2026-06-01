"""user avatar + alumni card link

Revision ID: a1b2c3d4e5f6
Revises: 93821a47fac1
Create Date: 2026-05-31 19:30:00.000000

给 users 增加:
  - avatar_url:用户个人头像
  - card_id:关联的校友牌(非空即"校友扑克用户")
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '93821a47fac1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('avatar_url', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('card_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_users_card_id', ['card_id'], unique=False)
        batch_op.create_foreign_key('fk_users_card_id_cards', 'cards', ['card_id'], ['id'])


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('fk_users_card_id_cards', type_='foreignkey')
        batch_op.drop_index('ix_users_card_id')
        batch_op.drop_column('card_id')
        batch_op.drop_column('avatar_url')
