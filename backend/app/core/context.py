"""Local single-user context for the self-hosted app."""

from dataclasses import dataclass

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.models import Profile

LOCAL_PROFILE_KEY = "local"


@dataclass
class LocalContext:
    profile: Profile
    session: AsyncSession


async def local_context(session: AsyncSession = Depends(get_session)) -> LocalContext:
    profile = await session.scalar(select(Profile).where(Profile.local_key == LOCAL_PROFILE_KEY))
    if profile is None:
        profile = Profile(local_key=LOCAL_PROFILE_KEY, display_name="Volt driver")
        session.add(profile)
        await session.commit()
        await session.refresh(profile)
    return LocalContext(profile=profile, session=session)
