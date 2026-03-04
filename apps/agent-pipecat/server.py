"""FastAPI signaling server for Pipecat SmallWebRTC interview agent.

Endpoints:
  POST  /api/offer          — WebRTC SDP offer/answer exchange
  PATCH /api/offer          — ICE candidate trickle
  GET   /health             — Health check
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import uvicorn
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from pipecat.transports.smallwebrtc.request_handler import (
    IceCandidate,
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)

from bot import run_bot
from config import get_settings
from db import get_prisma, get_session_by_id, disconnect_prisma
from queue_client import close_redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    settings = get_settings()
    logger.info(
        f"Agent starting on {settings.HOST}:{settings.PORT} "
        f"(LLM={settings.OPENAI_MODEL}, TTS={settings.DEEPGRAM_TTS_MODEL})"
    )
    # Eagerly connect to DB
    await get_prisma()
    yield
    # Cleanup
    await disconnect_prisma()
    await close_redis()
    await small_webrtc_handler.close()
    logger.info("Agent shutdown complete")


app = FastAPI(title="SmartHirink Interview Agent", lifespan=lifespan)

# CORS — allow the web frontend to connect directly if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SmallWebRTC signaling handler — manages peer connections
small_webrtc_handler = SmallWebRTCRequestHandler()


@app.post("/api/offer")
async def offer(request: Request, background_tasks: BackgroundTasks):
    """Handle WebRTC SDP offer — create a pipeline for this session.

    Expected JSON body:
      { "sdp": "...", "type": "offer", "session_id": "uuid" }

    Returns SDP answer:
      { "sdp": "...", "type": "answer", "pc_id": "..." }
    """
    body = await request.json()
    session_id = body.get("session_id")

    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    # Look up the interview session
    session_info = await get_session_by_id(session_id)
    if session_info is None:
        raise HTTPException(status_code=404, detail="Interview session not found")

    logger.info(
        f"WebRTC offer received for session {session_id} "
        f"(candidate={session_info.candidate_name})"
    )

    # Build the SmallWebRTC request (only sdp + type)
    webrtc_request = SmallWebRTCRequest(sdp=body["sdp"], type=body["type"])

    # Callback: spawn a bot pipeline when the connection is established
    async def webrtc_connection_callback(connection):
        background_tasks.add_task(run_bot, connection, session_info)

    # Handle the offer and return the SDP answer
    answer = await small_webrtc_handler.handle_web_request(
        request=webrtc_request,
        webrtc_connection_callback=webrtc_connection_callback,
    )

    return answer


@app.patch("/api/offer")
async def ice_candidate(request: Request):
    """Handle ICE candidate trickle.

    Expected JSON body:
      { "pc_id": "...", "candidates": [{ "candidate": "...", "sdp_mid": "...", "sdp_mline_index": 0 }] }
    """
    body = await request.json()
    candidates = [
        IceCandidate(
            candidate=c["candidate"],
            sdp_mid=c["sdp_mid"],
            sdp_mline_index=c["sdp_mline_index"],
        )
        for c in body.get("candidates", [])
    ]
    patch_request = SmallWebRTCPatchRequest(
        pc_id=body["pc_id"],
        candidates=candidates,
    )
    await small_webrtc_handler.handle_patch_request(patch_request)
    return {"status": "success"}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "interview-agent"}


if __name__ == "__main__":
    settings = get_settings()
    logger.info(f"Starting agent server on {settings.HOST}:{settings.PORT}")
    uvicorn.run(
        "server:app",
        host=settings.HOST,
        port=settings.PORT,
        log_level=settings.LOG_LEVEL,
    )
