import { describe, it, expect } from 'vitest';
import {
  encodeAgentMessage,
  decodeAgentMessage,
  encodeClientMessage,
  decodeClientMessage,
} from '../data-channel.js';
import { InterviewPhase, SpeakerRole } from '../types.js';
import type { AgentDataMessage, ClientDataMessage } from '../schemas.js';

describe('encodeAgentMessage / decodeAgentMessage', () => {
  it('round-trips a state message', () => {
    const msg: AgentDataMessage = {
      type: 'state',
      phase: InterviewPhase.IN_PROGRESS,
      speaking: { who: SpeakerRole.AI },
      vad: false,
      t: 1700000000000,
    };
    const encoded = encodeAgentMessage(msg);
    expect(encoded).toBeInstanceOf(Uint8Array);
    const decoded = decodeAgentMessage(encoded);
    expect(decoded).toEqual(msg);
  });

  it('round-trips a partial_transcript message', () => {
    const msg: AgentDataMessage = {
      type: 'partial_transcript',
      turnId: 'turn-abc',
      text: 'Xin chao',
      isFinal: false,
      t: Date.now(),
    };
    const encoded = encodeAgentMessage(msg);
    const decoded = decodeAgentMessage(encoded);
    expect(decoded.type).toBe('partial_transcript');
    if (decoded.type === 'partial_transcript') {
      expect(decoded.text).toBe('Xin chao');
    }
  });

  it('rejects invalid agent message', () => {
    expect(() =>
      encodeAgentMessage({ type: 'invalid' } as any),
    ).toThrow();
  });

  it('rejects garbage data on decode', () => {
    const encoder = new TextEncoder();
    expect(() =>
      decodeAgentMessage(encoder.encode('not json')),
    ).toThrow();
  });
});

describe('encodeClientMessage / decodeClientMessage', () => {
  it('round-trips a client_event message', () => {
    const msg: ClientDataMessage = {
      type: 'client_event',
      action: 'stop',
      t: Date.now(),
    };
    const encoded = encodeClientMessage(msg);
    const decoded = decodeClientMessage(encoded);
    expect(decoded).toEqual(msg);
  });

  it('rejects invalid client message', () => {
    expect(() =>
      encodeClientMessage({ type: 'bad' } as any),
    ).toThrow();
  });
});
