"""Database access via Prisma Python client."""

from __future__ import annotations

from dataclasses import dataclass
from prisma import Prisma
from loguru import logger

# Singleton Prisma client
_prisma: Prisma | None = None


async def get_prisma() -> Prisma:
    global _prisma
    if _prisma is None:
        _prisma = Prisma()
        await _prisma.connect()
        logger.info("Prisma client connected")
    return _prisma


async def disconnect_prisma() -> None:
    global _prisma
    if _prisma is not None:
        await _prisma.disconnect()
        _prisma = None
        logger.info("Prisma client disconnected")


@dataclass
class SessionInfo:
    """All context needed to run an interview pipeline."""

    session_id: str
    candidate_id: str
    candidate_name: str
    candidate_summary: str
    position: str
    level: str
    domain: str
    topics: list[str]
    question_count: int
    job_description: str
    language: str  # 'en' | 'vi'


async def get_session_by_id(session_id: str) -> SessionInfo | None:
    """Load an interview session with all relations needed for the agent."""
    prisma = await get_prisma()

    session = await prisma.interviewsession.find_unique(
        where={"id": session_id},
        include={
            "scenario": True,
            "candidate": True,
            "rubric": {"include": {"criteria": True}},
        },
    )

    if session is None:
        return None

    candidate = session.candidate  # type: ignore[union-attr]
    scenario = session.scenario  # type: ignore[union-attr]

    # Build candidate summary
    parts: list[str] = []
    if candidate.skills:
        parts.append(f"Skills: {', '.join(candidate.skills)}")
    if candidate.experienceYears:
        parts.append(f"Experience: {candidate.experienceYears} years")
    if candidate.resumeText:
        parts.append(f"Resume: {candidate.resumeText[:500]}")

    return SessionInfo(
        session_id=session.id,
        candidate_id=session.candidateId,
        candidate_name=candidate.fullName,
        candidate_summary="\n".join(parts),
        position=scenario.position,
        level=scenario.level,
        domain=scenario.domain,
        topics=scenario.topics or [],
        question_count=scenario.questionCount,
        job_description=scenario.description,
        language=scenario.language or "en",
    )


async def update_session_phase(session_id: str, phase: str) -> None:
    """Update the interview session phase in the database."""
    prisma = await get_prisma()
    await prisma.interviewsession.update(
        where={"id": session_id},
        data={"phase": phase},
    )
    logger.info(f"Session {session_id} phase updated to {phase}")
