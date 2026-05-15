import type { Vec3, Quat } from "@meet-vista/core";

export type { Vec3, Quat };

export type AvatarAnimation = "idle" | "walking" | "talking" | "waving";

export type AvatarState = {
  userId: string;
  roomId: string;
  position: Vec3;
  rotation: Quat;
  animation: AvatarAnimation;
  speaking: boolean;
  muted: boolean;
  timestamp: number;
};

export interface PresenceTransport {
  broadcast(state: AvatarState): void;
  onRemoteState(cb: (states: Map<string, AvatarState>) => void): () => void;
  setUpdateRate(hz: number): void;
  dispose(): void;
}
