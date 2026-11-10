"""SQLAlchemy ORM models — SQLite compatible (no PostgreSQL-specific types)."""

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, TypeDecorator, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class UUIDType(TypeDecorator):
    """Store UUID as TEXT in SQLite."""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return uuid.UUID(value)


class JSONType(TypeDecorator):
    """Store JSON as TEXT in SQLite (no JSONB)."""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return "[]"
        return json.dumps(value, ensure_ascii=False)

    def process_result_value(self, value, dialect):
        if value is None:
            return []
        return json.loads(value)


def _new_uuid() -> uuid.UUID:
    return uuid.uuid4()


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = (UniqueConstraint("google_subject"),)

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=_new_uuid)
    # Keep the existing SQLite column name so current local databases need no migration.
    local_key: Mapped[str] = mapped_column("google_subject", Text, nullable=False)
    display_name: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class Thread(Base):
    __tablename__ = "threads"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_threads_id_user"),
        Index("ix_threads_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=_new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False, default="New chat")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    messages: Mapped[list["Message"]] = relationship(back_populates="thread", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant', 'system')", name="ck_messages_role"),
        Index("ix_messages_thread_created", "thread_id", "created_at"),
        Index("ix_messages_user_id", "user_id"),
        UniqueConstraint("thread_id", "user_id", "role", "request_id", name="uq_messages_request_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=_new_uuid)
    thread_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("threads.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(12), nullable=False)
    parts: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, nullable=False, default=list)
    request_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    thread: Mapped[Thread] = relationship(back_populates="messages")