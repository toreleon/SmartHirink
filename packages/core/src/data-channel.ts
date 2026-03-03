import {
  AgentDataMessageSchema,
  ClientDataMessageSchema,
  type AgentDataMessage,
  type ClientDataMessage,
} from './schemas.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Encode an agent data message to a Uint8Array for LiveKit data channel. */
export function encodeAgentMessage(msg: AgentDataMessage): Uint8Array {
  AgentDataMessageSchema.parse(msg);
  return encoder.encode(JSON.stringify(msg));
}

/** Decode a raw data channel payload into a validated AgentDataMessage. */
export function decodeAgentMessage(data: Uint8Array): AgentDataMessage {
  const parsed = JSON.parse(decoder.decode(data));
  return AgentDataMessageSchema.parse(parsed);
}

/** Encode a client data message to a Uint8Array for LiveKit data channel. */
export function encodeClientMessage(msg: ClientDataMessage): Uint8Array {
  ClientDataMessageSchema.parse(msg);
  return encoder.encode(JSON.stringify(msg));
}

/** Decode a raw data channel payload into a validated ClientDataMessage. */
export function decodeClientMessage(data: Uint8Array): ClientDataMessage {
  const parsed = JSON.parse(decoder.decode(data));
  return ClientDataMessageSchema.parse(parsed);
}
