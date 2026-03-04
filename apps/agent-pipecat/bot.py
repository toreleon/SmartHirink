"""Pipecat pipeline factory — creates and runs an interview bot for each session.

Pipeline:
  transport.input() → STT → TranscriptSender → user_aggregator
  → InterviewProcessor → LLM → TTS → transport.output() → assistant_aggregator
"""

from __future__ import annotations

import os

import redis.asyncio as aioredis
from deepgram import LiveOptions
from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMMessagesFrame, TTSSpeakFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.deepgram.tts import DeepgramTTSService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport

from config import get_settings
from db import SessionInfo, update_session_phase
from interview_processor import InterviewProcessor
from prompts import (
    build_orchestrator_system_prompt,
    build_intro_message,
    InterviewLanguage,
)
from queue_client import get_redis, push_turn_persist
from transcript_sender import TranscriptSender


async def run_bot(webrtc_connection, session_info: SessionInfo) -> None:
    """Create and run a Pipecat interview pipeline for one session."""
    settings = get_settings()
    lang: InterviewLanguage = session_info.language if session_info.language in ("en", "vi") else "en"

    logger.info(
        f"Starting interview bot for session {session_info.session_id} "
        f"(candidate={session_info.candidate_name}, position={session_info.position})"
    )

    # ── Transport ──────────────────────────────────────────────
    transport = SmallWebRTCTransport(
        webrtc_connection=webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            audio_out_10ms_chunks=2,
        ),
    )

    # ── STT (Deepgram) ────────────────────────────────────────
    stt = DeepgramSTTService(
        api_key=settings.DEEPGRAM_API_KEY,
        live_options=LiveOptions(
            model="nova-3-general",
            language=lang,
            punctuate=True,
            smart_format=True,
            interim_results=True,
            profanity_filter=False,
        ),
    )

    # ── LLM (OpenAI) ──────────────────────────────────────────
    system_prompt = build_orchestrator_system_prompt(
        position=session_info.position,
        level=session_info.level,
        domain=session_info.domain,
        topics=session_info.topics,
        candidate_name=session_info.candidate_name,
        candidate_summary=session_info.candidate_summary,
        question_count=session_info.question_count,
        current_question_index=0,
        language=lang,
    )

    llm = OpenAILLMService(
        api_key=settings.OPENAI_API_KEY,
        model=settings.OPENAI_MODEL,
        params=OpenAILLMService.InputParams(
            temperature=0.7,
            max_completion_tokens=512,
        ),
    )
    if settings.OPENAI_BASE_URL:
        llm._client.base_url = settings.OPENAI_BASE_URL

    # ── TTS (Deepgram) ────────────────────────────────────────
    tts = DeepgramTTSService(
        api_key=settings.DEEPGRAM_API_KEY,
        voice=settings.DEEPGRAM_TTS_MODEL,
    )

    # ── Context & Aggregators ─────────────────────────────────
    messages = [{"role": "system", "content": system_prompt}]
    context = LLMContext(messages)
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(),
        ),
    )

    # ── Redis for queue persistence ───────────────────────────
    redis_client = await get_redis(settings.REDIS_URL)

    # ── Custom Processors ─────────────────────────────────────
    interview_proc = InterviewProcessor(
        session_info=session_info,
        redis_client=redis_client,
        webrtc_connection=webrtc_connection,
    )
    transcript_sender = TranscriptSender(
        webrtc_connection=webrtc_connection,
    )

    # ── Pipeline ──────────────────────────────────────────────
    pipeline = Pipeline(
        [
            transport.input(),       # Audio from browser microphone
            stt,                     # Deepgram STT (streaming)
            transcript_sender,       # Relay transcripts to client via data channel
            user_aggregator,         # Collect user speech into LLM context
            interview_proc,          # Interview logic (question tracking, RAG, outro)
            llm,                     # OpenAI LLM (streaming)
            tts,                     # Deepgram TTS (streaming)
            transport.output(),      # Audio back to browser speakers
            assistant_aggregator,    # Collect assistant responses into context
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
    )

    # ── Event Handlers ────────────────────────────────────────
    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info(f"Client connected for session {session_info.session_id}")

        # Update phase to IN_PROGRESS
        await update_session_phase(session_info.session_id, "IN_PROGRESS")

        # Send initial state to client
        webrtc_connection.send_app_message({
            "type": "state",
            "speaking": "AI",
            "phase": "IN_PROGRESS",
        })

        # Speak intro greeting
        intro = build_intro_message(
            session_info.candidate_name,
            session_info.position,
            lang,
        )

        # Record intro as first turn
        interview_proc.turns.append({"role": "AI", "text": intro})
        await push_turn_persist(
            redis_client,
            session_id=session_info.session_id,
            index=0,
            role="AI",
            text=intro,
        )

        # Send intro transcript to client
        webrtc_connection.send_app_message({
            "type": "transcript",
            "role": "AI",
            "text": intro,
            "isFinal": True,
            "turnIndex": 0,
        })

        # Add intro to context and trigger LLM (the intro itself is spoken via TTS)
        messages.append({"role": "assistant", "content": intro})
        await task.queue_frames([TTSSpeakFrame(text=intro)])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Client disconnected for session {session_info.session_id}")
        await task.cancel()

    @transport.event_handler("on_app_message")
    async def on_app_message(transport, message, sender):
        """Handle data channel messages from the browser client."""
        if isinstance(message, dict):
            action = message.get("action")
            if action == "stop":
                logger.info(f"Client requested stop for session {session_info.session_id}")
                if not interview_proc.interview_ended:
                    await interview_proc._end_interview()

    # ── Run ────────────────────────────────────────────────────
    runner = PipelineRunner(handle_sigint=False)
    await runner.run(task)

    logger.info(f"Bot pipeline ended for session {session_info.session_id}")
