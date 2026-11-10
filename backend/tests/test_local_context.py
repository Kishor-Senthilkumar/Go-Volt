import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.database import get_session
from app.main import app
from app.models.entities import Base


@pytest.mark.asyncio
async def test_local_api_works_without_authorization_header():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async def override_session():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            profile = await client.get("/api/me")
            threads = await client.get("/api/threads")

        assert profile.status_code == 200
        assert profile.json()["display_name"] == "Volt driver"
        assert threads.status_code == 200
        assert threads.json() == []
    finally:
        app.dependency_overrides.pop(get_session, None)
        await engine.dispose()
