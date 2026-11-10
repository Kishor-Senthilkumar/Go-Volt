"""SQLite-compatible initial schema — no RLS, no PostgreSQL extensions."""

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            google_subject TEXT UNIQUE NOT NULL,
            display_name TEXT,
            email TEXT,
            avatar_url TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS threads (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            title TEXT NOT NULL DEFAULT 'New chat',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            CONSTRAINT uq_threads_id_user UNIQUE(id, user_id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_threads_user_id ON threads(user_id)")
    op.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            role VARCHAR(12) NOT NULL CHECK(role IN ('user','assistant','system')),
            parts TEXT NOT NULL DEFAULT '[]',
            request_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            CONSTRAINT uq_messages_request_id UNIQUE(thread_id, user_id, role, request_id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_messages_thread_created ON messages(thread_id, created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_messages_user_id ON messages(user_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS messages")
    op.execute("DROP TABLE IF EXISTS threads")
    op.execute("DROP TABLE IF EXISTS profiles")