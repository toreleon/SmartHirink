"""TranscriptSender — Relays STT transcription frames to the browser via data channel.

Pipeline position:  STT → TranscriptSender → user_aggregator
Intercepts TranscriptionFrame to send partial/final transcripts to the client.
Also sends AI speech status to the client for UI state management.
"""

from __future__ import annotations

import json

from loguru import logger
from pipecat.frames.frames import (
    Frame,
    TranscriptionFrame,
    InterimTranscriptionFrame,
    TTSStartedFrame,
    TTSStoppedFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor


class TranscriptSender(FrameProcessor):
    """Sends real-time transcripts and agent state to the browser client.

    Intercepts:
    - InterimTranscriptionFrame → partial candidate speech
    - TranscriptionFrame → final candidate speech
    - TTSStartedFrame / TTSStoppedFrame → agent speaking state
    """

    def __init__(self, webrtc_connection, **kwargs):
        super().__init__(**kwargs)
        self.webrtc_connection = webrtc_connection

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        # Partial (interim) transcription — show as streaming candidate text
        if isinstance(frame, InterimTranscriptionFrame):
            self._send({
                "type": "transcript",
                "role": "CANDIDATE",
                "text": frame.text,
                "isFinal": False,
            })

        # Final transcription — commit candidate text
        elif isinstance(frame, TranscriptionFrame):
            self._send({
                "type": "transcript",
                "role": "CANDIDATE",
                "text": frame.text,
                "isFinal": True,
            })

        # Agent started speaking
        elif isinstance(frame, TTSStartedFrame):
            self._send({
                "type": "state",
                "speaking": "AI",
                "phase": "IN_PROGRESS",
            })

        # Agent stopped speaking
        elif isinstance(frame, TTSStoppedFrame):
            self._send({
                "type": "state",
                "speaking": "NONE",
                "phase": "IN_PROGRESS",
            })

        # Always pass through — don't consume any frames
        await self.push_frame(frame, direction)

    def _send(self, message: dict) -> None:
        """Send JSON message via WebRTC data channel."""
        if self.webrtc_connection is not None:
            try:
                self.webrtc_connection.send_app_message(message)
            except Exception as e:
                logger.warning(f"Failed to send transcript message: {e}")
