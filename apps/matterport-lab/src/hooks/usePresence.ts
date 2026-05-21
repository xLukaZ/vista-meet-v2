import { useEffect, useRef, useCallback } from "react";
import { LocalPresenceTransport } from "@meet-vista/presence-core";
import type { AvatarState } from "@meet-vista/presence-core";
import type { MatterportObjectLayer, CameraPose } from "@meet-vista/matterport-runtime";
import { createAvatarObject } from "@meet-vista/matterport-objects";

/**
 * Wires the presence loop for matterport-lab:
 *   - Broadcasts our own camera pose as AvatarState (throttled to 20 Hz)
 *   - Receives remote AvatarStates and keeps TagObjectLayer in sync
 *
 * Uses LocalPresenceTransport for standalone testing.
 * Sprint 6 replaces this with LiveKitDataChannelTransport in apps/web.
 */
export function usePresence(
  userId: string,
  layer: MatterportObjectLayer | null,
  pose: CameraPose | null,
) {
  const transportRef = useRef<LocalPresenceTransport | null>(null);
  /** Maps remoteUserId → objectId in TagObjectLayer */
  const remoteTagIds = useRef<Map<string, string>>(new Map());
  const lastBroadcastRef = useRef<number>(0);

  // ── Initialise transport once ──────────────────────────────────────────────
  useEffect(() => {
    const transport = new LocalPresenceTransport(userId);
    transportRef.current = transport;

    return () => {
      transport.dispose();
      transportRef.current = null;
    };
  }, [userId]);

  // ── Subscribe to remote states → update tags ───────────────────────────────
  useEffect(() => {
    const transport = transportRef.current;
    if (!transport || !layer) return;

    const unsub = transport.onRemoteState(async (states: Map<string, AvatarState>) => {
      // Add / update tags for each remote participant
      for (const [uid, state] of states) {
        const existingId = remoteTagIds.current.get(uid);
        const transform = {
          position: state.position,
          rotation: state.rotation,
          scale: { x: 1, y: 1, z: 1 },
        };

        if (existingId) {
          await layer.updateObject(existingId, transform);
        } else {
          const obj = createAvatarObject({
            userId: uid,
            displayName: state.userId,
            speaking: state.speaking,
            transform,
          });
          const id = await layer.addObject(obj);
          remoteTagIds.current.set(uid, id);
        }
      }

      // Remove tags for participants that left
      for (const [uid, tagId] of remoteTagIds.current) {
        if (!states.has(uid)) {
          await layer.removeObject(tagId);
          remoteTagIds.current.delete(uid);
        }
      }
    });

    return unsub;
  }, [layer]);

  // ── Broadcast own pose at 20 Hz (throttled) ───────────────────────────────
  useEffect(() => {
    const transport = transportRef.current;
    if (!transport || !pose) return;

    const now = Date.now();
    if (now - lastBroadcastRef.current < 50) return; // 20 Hz cap
    lastBroadcastRef.current = now;

    const state: AvatarState = {
      userId,
      roomId: "matterport-lab",
      position: pose.position,
      rotation: pose.rotation,
      animation: "idle",
      speaking: false,
      muted: true,
      timestamp: now,
    };
    transport.broadcast(state);
  }, [pose, userId]);

  // ── Expose simulateRemote for the lab UI ──────────────────────────────────
  const simulateRemote = useCallback((state: AvatarState) => {
    transportRef.current?.simulateRemote(state);
  }, []);

  const removeSimulated = useCallback((uid: string) => {
    transportRef.current?.removeSimulated(uid);
  }, []);

  const clearSimulated = useCallback(() => {
    transportRef.current?.clearSimulated();
  }, []);

  return { simulateRemote, removeSimulated, clearSimulated };
}
