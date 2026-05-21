import { AccessToken, RoomServiceClient, TrackSource, DataPacket_Kind } from "livekit-server-sdk";

export type LiveKitTokenOptions = {
  roomId: string;
  participantId: string;
  displayName: string;
  role: "host" | "guest" | "waiting";
  ttl?: number;
};

export class LiveKitService {
  private apiKey: string;
  private apiSecret: string;
  private host: string;
  readonly roomService: RoomServiceClient;

  constructor() {
    const key = process.env["LIVEKIT_API_KEY"];
    const secret = process.env["LIVEKIT_API_SECRET"];
    const url = process.env["LIVEKIT_URL"] ?? "";

    if (!key || !secret) throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set");

    this.apiKey = key;
    this.apiSecret = secret;
    this.host = url.replace(/^wss?:\/\//, "https://");
    this.roomService = new RoomServiceClient(this.host, key, secret);
  }

  async generateToken(options: LiveKitTokenOptions): Promise<string> {
    const ttl = options.ttl ?? 28800; // 8 hours — enough for a full-day live test
    const isWaiting = options.role === "waiting";

    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: options.participantId,
      name: options.displayName,
      ttl,
      metadata: JSON.stringify({ role: options.role }),
    });

    token.addGrant({
      roomJoin: true,
      room: options.roomId,
      // Waiting participants can join the room but cannot publish tracks
      canPublish: !isWaiting,
      canSubscribe: !isWaiting,
      canPublishData: !isWaiting,
      roomAdmin: options.role === "host",
    });

    return token.toJwt();
  }

  async removeParticipant(roomId: string, participantIdentity: string): Promise<void> {
    await this.roomService.removeParticipant(roomId, participantIdentity);
  }

  /** Delete the entire room — disconnects all participants immediately. */
  async deleteRoom(roomId: string): Promise<void> {
    await this.roomService.deleteRoom(roomId);
  }

  /** Mute or unmute a specific participant's microphone. */
  async muteParticipant(roomId: string, participantIdentity: string, muted: boolean): Promise<void> {
    const participant = await this.roomService.getParticipant(roomId, participantIdentity);
    const audioTrack = participant.tracks.find(
      (t) => t.source === TrackSource.MICROPHONE
    );
    if (!audioTrack) return;
    await this.roomService.mutePublishedTrack(roomId, participantIdentity, audioTrack.sid, muted);
  }

  /** Mute or unmute a specific participant's camera. */
  async muteCameraParticipant(roomId: string, participantIdentity: string, muted: boolean): Promise<void> {
    const participant = await this.roomService.getParticipant(roomId, participantIdentity);
    const videoTrack = participant.tracks.find((t) => t.source === TrackSource.CAMERA);
    if (!videoTrack) return;
    await this.roomService.mutePublishedTrack(roomId, participantIdentity, videoTrack.sid, muted);
  }

  /** Allow or revoke screen share capability for a participant. */
  async setScreenShareAllowed(roomId: string, participantIdentity: string, allowed: boolean): Promise<void> {
    if (allowed) {
      await this.roomService.updateParticipant(roomId, participantIdentity, {
        permission: {
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
          // Grant all sources (camera + mic + screen share)
          canPublishSources: [
            TrackSource.CAMERA,
            TrackSource.MICROPHONE,
            TrackSource.SCREEN_SHARE,
            TrackSource.SCREEN_SHARE_AUDIO,
          ],
        },
      });
    } else {
      await this.roomService.updateParticipant(roomId, participantIdentity, {
        permission: {
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
          // Only camera + mic — no screen share
          canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
        },
      });
    }
  }

  /**
   * Send a JSON data message to all participants (or specific ones) in a room.
   * Used to notify clients of server-initiated events (meeting ended, denied, etc.)
   */
  async sendData(roomId: string, payload: Record<string, unknown>, destinationIdentities?: string[]): Promise<void> {
    const data = new TextEncoder().encode(JSON.stringify(payload));
    await this.roomService.sendData(roomId, data, DataPacket_Kind.RELIABLE, {
      ...(destinationIdentities ? { destinationIdentities } : {}),
    });
  }

  /** Admit a waiting participant: grant full publish/subscribe permissions. */
  async admitParticipant(roomId: string, participantIdentity: string): Promise<void> {
    await this.roomService.updateParticipant(roomId, participantIdentity, {
      metadata: JSON.stringify({ role: "guest" }),
      permission: {
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    });
  }
}

export const livekitService = new LiveKitService();
