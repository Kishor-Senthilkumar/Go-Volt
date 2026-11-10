from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router
from app.api.threads import router as threads_router
from app.api.trips import router as trips_router
from app.core.config import get_settings
from app.core.database import engine
from app.models.entities import Base


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Auto-create all tables on startup (SQLite — no separate migration step needed for dev)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


settings = get_settings()
app = FastAPI(title="Volt API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Last-Event-ID"],
)
app.include_router(threads_router)
app.include_router(chat_router)
app.include_router(trips_router)


@app.get("/health")
async def health():
    """Health check — verifies Ollama is reachable."""
    model_status = "ok"
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            response = await client.get(f"{settings.ollama_base_url.rstrip('/')}/api/tags")
            response.raise_for_status()
    except httpx.HTTPError:
        model_status = "unavailable"
    return {
        "status": "ok",
        "service": "volt-api",
        "ollama": model_status,
        "model": settings.ollama_model,
    }