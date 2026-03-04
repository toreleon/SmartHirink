"""InterviewProcessor — Custom FrameProcessor for interview orchestration.

Sits in the pipeline between the user aggregator and the LLM.
Manages interview state: intro, question progression, RAG injection, outro.
"""

from __future__ import annotations

import asyncio
import json

import redis.asyncio as aioredis
from loguru import logger
from pipecat.frames.frames import (
    Frame,
    LLMMessagesAppendFrame,
    LLMMessagesUpdateFrame,
    LLMSetToolsFrame,
    TextFrame,
    EndFrame,
    TTSSpeakFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from db import SessionInfo, update_session_phase
from prompts import (
    build_orchestrator_system_prompt,
    build_intro_message,
    build_outro_message,
    InterviewLanguage,
)
from queue_client import push_turn_persist, push_evaluation


class InterviewProcessor(FrameProcessor):
    """Manages interview flow by intercepting LLM context frames.

    Pipeline position:  user_aggregator → InterviewProcessor → LLM

    On each user turn completion (LLMMessagesAppendFrame with user role):
    - Records candidate turn
    - Checks question limit → speaks outro if done
    - Injects RAG context (ephemeral system message)
    - Injects question progress system message
    - Increments question counter
    """

    def __init__(
        self,
        session_info: SessionInfo,
        redis_client: aioredis.Redis,
        webrtc_connection=None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.session_info = session_info
        self.redis = redis_client
        self.webrtc_connection = webrtc_connection
        self.language: InterviewLanguage = session_info.language if session_info.language in ("en", "vi") else "en"

        # Interview state
        self.turns: list[dict] = []
        self.current_question_index = 0
        self.interview_ended = False
        self.intro_spoken = False
        self._ai_text_buffer = ""

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        # Intercept user messages being appended to LLM context
        if isinstance(frame, LLMMessagesAppendFrame) and direction == FrameDirection.DOWNSTREAM:
            messages = frame.messages
            if messages and len(messages) > 0:
                last_msg = messages[-1]
                role = last_msg.get("role", "")
                content = last_msg.get("content", "")

                if role == "user" and content and content.strip():
                    # Process user turn before passing to LLM
                    should_stop = await self._handle_user_turn(content.strip())
                    if should_stop:
                        # Don't pass to LLM — we already spoke the outro
                        return

        # Intercept LLM text output to record AI turns
        if isinstance(frame, TextFrame) and direction == FrameDirection.DOWNSTREAM:
            self._ai_text_buffer += frame.text

        # Always pass through
        await self.push_frame(frame, direction)

    async def _handle_user_turn(self, text: str) -> bool:
        """Process a completed user turn. Returns True if interview should stop."""
        if self.interview_ended:
            return True

        # Record candidate turn
        self.turns.append({"role": "CANDIDATE", "text": text})
        await self._persist_turn("CANDIDATE", text)

        # Send transcript to client
        self._send_to_client({
            "type": "transcript",
            "role": "CANDIDATE",
            "text": text,
            "isFinal": True,
            "turnIndex": len(self.turns) - 1,
        })

        # Check if we should end the interview
        if self.current_question_index >= self.session_info.question_count:
            await self._end_interview()
            return True

        # Inject question progress as ephemeral system message
        progress_msg = (
            f"You are now asking question {self.current_question_index + 1} "
            f"of {self.session_info.question_count}."
        )
        if self.current_question_index + 1 >= self.session_info.question_count:
            progress_msg += (
                " This is the last question. After this response, "
                "the interview will conclude."
            )

        # Push a system message into the LLM context
        await self.push_frame(
            LLMMessagesAppendFrame(
                messages=[{"role": "system", "content": progress_msg}]
            ),
            FrameDirection.DOWNSTREAM,
        )

        self.current_question_index += 1

        # Notify client of state
        self._send_to_client({
            "type": "state",
            "speaking": "AI",
            "phase": "IN_PROGRESS",
            "questionIndex": self.current_question_index,
            "questionCount": self.session_info.question_count,
        })

        return False

    async def _end_interview(self) -> None:
        """Speak the outro, update DB, and queue evaluation."""
        self.interview_ended = True

        outro = build_outro_message(self.session_info.candidate_name, self.language)
        self.turns.append({"role": "AI", "text": outro})
        await self._persist_turn("AI", outro)

        # Speak outro via TTS
        await self.push_frame(
            TTSSpeakFrame(text=outro),
            FrameDirection.DOWNSTREAM,
        )

        # Update phase
        await update_session_phase(self.session_info.session_id, "COMPLETED")

        # Queue evaluation
        await push_evaluation(self.redis, self.session_info.session_id)

        # Notify client
        self._send_to_client({
            "type": "state",
            "speaking": "AI",
            "phase": "COMPLETED",
        })
        self._send_to_client({
            "type": "transcript",
            "role": "AI",
            "text": outro,
            "isFinal": True,
            "turnIndex": len(self.turns) - 1,
        })

        logger.info(
            f"Interview {self.session_info.session_id} completed. "
            f"Total turns: {len(self.turns)}"
        )

        # Schedule pipeline end after outro finishes
        asyncio.get_event_loop().call_later(
            8.0,
            lambda: asyncio.ensure_future(
                self.push_frame(EndFrame(), FrameDirection.DOWNSTREAM)
            ),
        )

    async def record_ai_turn(self, text: str) -> None:
        """Called externally (from LLM response aggregator) to record AI output."""
        if not text.strip():
            return
        self.turns.append({"role": "AI", "text": text.strip()})
        await self._persist_turn("AI", text.strip())
        self._send_to_client({
            "type": "transcript",
            "role": "AI",
            "text": text.strip(),
            "isFinal": True,
            "turnIndex": len(self.turns) - 1,
        })

    async def _persist_turn(self, role: str, text: str) -> None:
        """Push turn to BullMQ queue for async persistence."""
        try:
            await push_turn_persist(
                self.redis,
                session_id=self.session_info.session_id,
                index=len(self.turns) - 1,
                role=role,
                text=text,
            )
        except Exception as e:
            logger.error(f"Failed to persist turn: {e}")

    def _send_to_client(self, message: dict) -> None:
        """Send a message to the browser via WebRTC data channel."""
        if self.webrtc_connection is not None:
            try:
                self.webrtc_connection.send_app_message(message)
            except Exception as e:
                logger.warning(f"Failed to send client message: {e}")
