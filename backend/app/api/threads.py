import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select

from app.core.context import LocalContext, local_context
from app.models import Message, Thread
from app.schemas.api import MessageOut, ThreadCreate, ThreadOut, ThreadRename
from app.services.chargers import find_chargers

router = APIRouter(prefix="/api", tags=["threads"])


@router.get("/threads", response_model=list[ThreadOut])
async def list_threads(limit: int = Query(default=50, ge=1, le=100), before: uuid.UUID | None = None, auth: LocalContext = Depends(local_context)):
    query = select(Thread).where(Thread.user_id == auth.profile.id).order_by(Thread.updated_at.desc()).limit(limit)
    if before:
        cursor = await auth.session.get(Thread, before)
        if cursor is not None and cursor.user_id == auth.profile.id:
            query = query.where(Thread.updated_at < cursor.updated_at)
    rows = await auth.session.scalars(query)
    return list(rows.all())


@router.post("/threads", response_model=ThreadOut, status_code=201)
async def create_thread(body: ThreadCreate, auth: LocalContext = Depends(local_context)):
    thread = Thread(user_id=auth.profile.id, title=body.title.strip() or "New chat")
    auth.session.add(thread)
    await auth.session.commit()
    await auth.session.refresh(thread)
    return thread


async def owned_thread(auth: LocalContext, thread_id: uuid.UUID) -> Thread:
    result = await auth.session.execute(select(Thread).where(Thread.id == thread_id, Thread.user_id == auth.profile.id))
    thread = result.scalar_one_or_none()
    if thread is None:
        thread = Thread(id=thread_id, user_id=auth.profile.id, title="New conversation")
        auth.session.add(thread)
        await auth.session.commit()
        await auth.session.refresh(thread)
    return thread


@router.patch("/threads/{thread_id}", response_model=ThreadOut)
async def rename_thread(thread_id: uuid.UUID, body: ThreadRename, auth: LocalContext = Depends(local_context)):
    thread = await owned_thread(auth, thread_id)
    thread.title = body.title.strip()
    await auth.session.commit()
    await auth.session.refresh(thread)
    return thread


@router.delete("/threads/{thread_id}", status_code=204)
async def delete_thread(thread_id: uuid.UUID, auth: LocalContext = Depends(local_context)):
    thread = await owned_thread(auth, thread_id)
    await auth.session.delete(thread)
    await auth.session.commit()
    return Response(status_code=204)


@router.get("/threads/{thread_id}/messages", response_model=list[MessageOut])
async def get_messages(thread_id: uuid.UUID, limit: int = Query(default=200, ge=1, le=500), before: uuid.UUID | None = None, auth: LocalContext = Depends(local_context)):
    await owned_thread(auth, thread_id)
    query = select(Message).where(Message.thread_id == thread_id, Message.user_id == auth.profile.id).order_by(Message.created_at.desc()).limit(limit)
    if before:
        cursor = await auth.session.get(Message, before)
        if cursor is not None and cursor.thread_id == thread_id:
            query = query.where(Message.created_at < cursor.created_at)
    messages = list((await auth.session.scalars(query)).all())
    return list(reversed(messages))


@router.get("/threads/{thread_id}/stations")
async def thread_stations(thread_id: uuid.UUID, auth: LocalContext = Depends(local_context)):
    await owned_thread(auth, thread_id)
    rows = await auth.session.scalars(select(Message.parts).where(Message.thread_id == thread_id, Message.user_id == auth.profile.id, Message.role == "assistant").order_by(Message.created_at))
    stations: dict[int, dict] = {}
    for parts in rows:
        for part in parts or []:
            if part.get("type") == "tool_result" and part.get("tool") == "find_chargers":
                for station in part.get("stations", []):
                    stations[station["id"]] = station
    return sorted(stations.values(), key=lambda item: item.get("distance_km", float("inf")))


@router.get("/me")
async def get_me(auth: LocalContext = Depends(local_context)):
    return {"display_name": auth.profile.display_name, "email": auth.profile.email, "avatar_url": auth.profile.avatar_url}