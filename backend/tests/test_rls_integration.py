import os
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


@pytest.mark.skipif(not os.getenv("VOLT_TEST_DATABASE_URL"), reason="Set VOLT_TEST_DATABASE_URL to a migrated database using the volt_app role")
@pytest.mark.asyncio
async def test_rls_blocks_cross_user_thread_and_message_access():
    engine = create_async_engine(os.environ["VOLT_TEST_DATABASE_URL"])
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    subject_a = f"rls-test-a-{uuid.uuid4()}"
    subject_b = f"rls-test-b-{uuid.uuid4()}"
    try:
        async with sessions() as session:
            async with session.begin():
                await session.execute(text("SELECT set_config('app.keycloak_sub', :subject, true)"), {"subject": subject_a})
                user_a = (await session.execute(text("INSERT INTO profiles(keycloak_subject) VALUES (:subject) RETURNING id"), {"subject": subject_a})).scalar_one()
                await session.execute(text("SELECT set_config('app.keycloak_sub', :subject, true)"), {"subject": subject_b})
                user_b = (await session.execute(text("INSERT INTO profiles(keycloak_subject) VALUES (:subject) RETURNING id"), {"subject": subject_b})).scalar_one()
                await session.execute(text("SELECT set_config('app.user_id', :identity, true)"), {"identity": str(user_a)})
                thread_a = (await session.execute(text("INSERT INTO threads(user_id) VALUES (:user_id) RETURNING id"), {"user_id": user_a})).scalar_one()
                await session.execute(text("INSERT INTO messages(thread_id, user_id, role) VALUES (:thread_id, :user_id, 'user')"), {"thread_id": thread_a, "user_id": user_a})
                await session.execute(text("SELECT set_config('app.user_id', :identity, true)"), {"identity": str(user_b)})
                visible = (await session.execute(text("SELECT id FROM threads WHERE id = :thread_id"), {"thread_id": thread_a})).all()
                assert visible == []
                with pytest.raises(Exception):
                    async with session.begin_nested():
                        await session.execute(text("INSERT INTO messages(thread_id, user_id, role) VALUES (:thread_id, :user_id, 'user')"), {"thread_id": thread_a, "user_id": user_b})
    finally:
        await engine.dispose()