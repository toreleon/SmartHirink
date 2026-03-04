"""BullMQ-compatible Redis queue client.

Pushes jobs to the same Redis queues that the existing Node.js worker processes.
BullMQ stores jobs as Redis hashes with a specific key structure.
"""

from __future__ import annotations

import json
import time
import uuid

import redis.asyncio as aioredis
from loguru import logger

_redis: aioredis.Redis | None = None


async def get_redis(url: str = "redis://localhost:6379") -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(url, decode_responses=True)
        logger.info("Redis client connected")
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


async def push_bullmq_job(
    redis_client: aioredis.Redis,
    queue_name: str,
    job_name: str,
    data: dict,
    job_id: str | None = None,
) -> str:
    """Push a job in BullMQ-compatible format.

    BullMQ uses the following Redis structure:
    - bull:<queue>:id  — job counter
    - bull:<queue>:<jobId> — hash with job data
    - bull:<queue>:wait — list of waiting job IDs
    - bull:<queue>:events — stream for job events
    """
    prefix = f"bull:{queue_name}"
    jid = job_id or str(uuid.uuid4())
    timestamp = int(time.time() * 1000)

    job_hash = {
        "id": jid,
        "name": job_name,
        "data": json.dumps(data),
        "opts": json.dumps({"attempts": 3, "delay": 0, "timestamp": timestamp}),
        "progress": "0",
        "delay": "0",
        "priority": "0",
        "timestamp": str(timestamp),
        "attemptsMade": "0",
        "processedOn": "0",
        "finishedOn": "0",
    }

    pipe = redis_client.pipeline()
    pipe.hset(f"{prefix}:{jid}", mapping=job_hash)  # type: ignore[arg-type]
    pipe.lpush(f"{prefix}:wait", jid)
    # Notify BullMQ workers via the events stream
    pipe.xadd(
        f"{prefix}:events",
        {"event": "waiting", "jobId": jid},
    )
    await pipe.execute()

    logger.debug(f"Pushed job {job_name}:{jid} to queue {queue_name}")
    return jid


async def push_turn_persist(
    redis_client: aioredis.Redis,
    session_id: str,
    index: int,
    role: str,
    text: str,
) -> str:
    """Push a turn persistence job to the turn-persist queue."""
    return await push_bullmq_job(
        redis_client,
        queue_name="turn-persist",
        job_name="persist-turn",
        data={
            "sessionId": session_id,
            "index": index,
            "role": role,
            "text": text,
            "latency": {},
        },
    )


async def push_evaluation(
    redis_client: aioredis.Redis,
    session_id: str,
) -> str:
    """Push an evaluation job to the evaluation queue."""
    return await push_bullmq_job(
        redis_client,
        queue_name="evaluation",
        job_name="evaluate",
        data={"sessionId": session_id},
        job_id=f"eval_{session_id}",
    )
