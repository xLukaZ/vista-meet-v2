import { pack, unpack } from "msgpackr";
import type { Room } from "livekit-client";
import { RoomEvent, DataPacket_Kind } from "livekit-client";
import type { AvatarState, PresenceTransport } from "../../types.js";

type RemoteStateListener = (states: Map<string, AvatarState>) => void;

const PRESENCE_TOPIC = "vista:presence";

export class LiveKitDataChannelTransport implements PresenceTransport {
  private room: Room;
  private remoteStates: Map<string, AvatarState> = new Map();
  private listeners: Set<RemoteStateListener> = new Set();
  private updateIntervalMs: number = 50; // 20hz default
  private lastBroadcastAt: number = 0;
  private pendingState: AvatarState | null = null;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(room: Room) {
    this.room = room;
    this.bindDataEvents();
  }

  private bindDataEvents(): void {
    this.room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant) => {
      if (!participant) return;

      try {
        const state = unpack(payload) as AvatarState;
        if (typeof state !== "object" || !state.userId) return;

        this.remoteStates.set(state.userId, state);
        const snapshot = new Map(this.remoteStates);
        for (const cb of this.listeners) cb(snapshot);
      } catch {
        // malformed packet — silently ignore
      }
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      this.remoteStates.delete(participant.identity);
      const snapshot = new Map(this.remoteStates);
      for (const cb of this.listeners) cb(snapshot);
    });
  }

  broadcast(state: AvatarState): void {
    const now = Date.now();
    const elapsed = now - this.lastBroadcastAt;

    if (elapsed >= this.updateIntervalMs) {
      this.sendState(state);
    } else {
      this.pendingState = state;
      if (!this.throttleTimer) {
        this.throttleTimer = setTimeout(() => {
          this.throttleTimer = null;
          if (this.pendingState) {
            this.sendState(this.pendingState);
            this.pendingState = null;
          }
        }, this.updateIntervalMs - elapsed);
      }
    }
  }

  private sendState(state: AvatarState): void {
    this.lastBroadcastAt = Date.now();
    const payload = pack(state);
    this.room.localParticipant
      .publishData(payload, { reliable: false, topic: PRESENCE_TOPIC })
      .catch((err) => console.error("Presence broadcast failed:", err));
  }

  onRemoteState(cb: RemoteStateListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  setUpdateRate(hz: number): void {
    this.updateIntervalMs = Math.round(1000 / hz);
  }

  dispose(): void {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    this.listeners.clear();
    this.remoteStates.clear();
    this.room.removeAllListeners(RoomEvent.DataReceived);
  }
}
