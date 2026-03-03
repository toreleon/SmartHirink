import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { loadEnv } from '../config.js';

const env = loadEnv();

export const roomService = new RoomServiceClient(
  env.LIVEKIT_URL.replace('ws://', 'http://').replace('wss://', 'https://'),
  env.LIVEKIT_API_KEY,
  env.LIVEKIT_API_SECRET,
);

export interface TokenGrants {
  roomName: string;
  identity: string;
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
}

export async function mintLiveKitToken(grants: TokenGrants): Promise<string> {
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: grants.identity,
    ttl: '4h',
  });

  at.addGrant({
    room: grants.roomName,
    roomJoin: true,
    canPublish: grants.canPublish,
    canSubscribe: grants.canSubscribe,
    canPublishData: grants.canPublishData,
  });

  return at.toJwt();
}

export async function ensureRoom(roomName: string): Promise<void> {
  try {
    const rooms = await roomService.listRooms([roomName]);
    if (rooms.length === 0) {
      await roomService.createRoom({
        name: roomName,
        emptyTimeout: 300, // 5 min
        maxParticipants: 5,
      });
    }
  } catch {
    // Room may already exist, that's fine
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 300,
      maxParticipants: 5,
    });
  }
}
