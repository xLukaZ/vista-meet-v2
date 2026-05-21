"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { MatterportRuntimeImpl } from "@meet-vista/matterport-runtime";
import type { MatterportObjectLayer, CameraPose } from "@meet-vista/matterport-runtime";
import { LiveKitMeetingClient } from "@meet-vista/meeting-core";
import { LiveKitDataChannelTransport } from "@meet-vista/presence-core";
import type { AvatarState } from "@meet-vista/presence-core";
import { createAvatarObject } from "@meet-vista/matterport-objects";
import { useRoomStore } from "./useRoomStore";

const MP_SDK_KEY = process.env["NEXT_PUBLIC_MP_SDK_KEY"] ?? "";
const MP_MODEL_ID = process.env["NEXT_PUBLIC_MP_MODEL_ID"] ?? "SxQL3iGyoDo";
const MP_BUNDLE_URL = process.env["NEXT_PUBLIC_MP_BUNDLE_URL"] as string | undefined;

// ─────────────────────────────────────────────────────────────────────────────

export function MeetingCanvas({ roomId }: { roomId: string }) {
  const { status, livekitToken, livekitUrl, identity, isHost, hostSecret, reset } = useRoomStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const mpRef = useRef<MatterportRuntimeImpl | null>(null);
  const meetingRef = useRef<LiveKitMeetingClient | null>(null);
  const presenceRef = useRef<LiveKitDataChannelTransport | null>(null);
  const remoteTagIds = useRef<Map<string, string>>(new Map());
  const layerRef = useRef<MatterportObjectLayer | null>(null);

  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  // ── Mount Matterport + connect LiveKit once tokens are ready ──────────────
  useEffect(() => {
    if (status !== "connected" || !livekitToken || !livekitUrl || !containerRef.current) return;

    let disposed = false;

    (async () => {
      // 1. Mount Matterport
      const mp = new MatterportRuntimeImpl();
      mpRef.current = mp;
      await mp.mount(containerRef.current!, {
        sdkKey: MP_SDK_KEY,
        modelId: MP_MODEL_ID,
        ...(MP_BUNDLE_URL ? { bundleUrl: MP_BUNDLE_URL } : {}),
        options: { autoplay: true },
      });
      if (disposed) { await mp.dispose(); return; }
      layerRef.current = mp.getObjectLayer();

      // 2. Connect LiveKit
      const meeting = new LiveKitMeetingClient();
      meetingRef.current = meeting;
      await meeting.join(roomId, livekitToken, livekitUrl);
      if (disposed) { meeting.leave(); return; }

      // 3. Wire presence transport
      const room = meeting.getInternalRoom();
      const transport = new LiveKitDataChannelTransport(room);
      presenceRef.current = transport;

      transport.onRemoteState(async (states: Map<string, AvatarState>) => {
        if (!layerRef.current) return;
        // Add / update tags for each remote participant
        for (const [uid, state] of states) {
          const existingId = remoteTagIds.current.get(uid);
          const transform = {
            position: state.position,
            rotation: state.rotation,
            scale: { x: 1, y: 1, z: 1 },
          };
          if (existingId) {
            await layerRef.current.updateObject(existingId, transform);
          } else {
            const obj = createAvatarObject({
              userId: uid,
              displayName: uid,
              speaking: state.speaking,
              transform,
            });
            const id = await layerRef.current.addObject(obj);
            remoteTagIds.current.set(uid, id);
          }
        }
        // Remove departed participants
        for (const [uid, tagId] of remoteTagIds.current) {
          if (!states.has(uid)) {
            await layerRef.current.removeObject(tagId);
            remoteTagIds.current.delete(uid);
          }
        }
      });

      // 4. Broadcast own camera pose at 20 Hz
      mp.onCameraChanged((pose: CameraPose) => {
        if (!identity) return;
        const state: AvatarState = {
          userId: identity,
          roomId,
          position: pose.position,
          rotation: pose.rotation,
          animation: "idle",
          speaking: false,
          muted: micMuted,
          timestamp: Date.now(),
        };
        transport.broadcast(state);
      });
    })();

    return () => {
      disposed = true;
      presenceRef.current?.dispose();
      presenceRef.current = null;
      meetingRef.current?.leave();
      meetingRef.current = null;
      mpRef.current?.dispose();
      mpRef.current = null;
      layerRef.current = null;
      remoteTagIds.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, livekitToken, livekitUrl]);

  const toggleMic = useCallback(async () => {
    if (!meetingRef.current) return;
    const next = !micMuted;
    await meetingRef.current.setMicEnabled(!next);
    setMicMuted(next);
  }, [micMuted]);

  const toggleCam = useCallback(async () => {
    if (!meetingRef.current) return;
    const next = !camOff;
    await meetingRef.current.setCameraEnabled(!next);
    setCamOff(next);
  }, [camOff]);

  const leave = useCallback(async () => {
    if (isHost && hostSecret) {
      // End meeting for everyone
      await fetch(`${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001"}/dev/end-meeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, hostSecret }),
      }).catch(() => {});
    }
    presenceRef.current?.dispose();
    meetingRef.current?.leave();
    mpRef.current?.dispose();
    reset();
  }, [roomId, isHost, hostSecret, reset]);

  if (status !== "connected") return null;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Matterport viewer */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Controls bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-2xl bg-black/70 backdrop-blur-sm border border-white/10">
        {/* Mic */}
        <button
          onClick={() => void toggleMic()}
          className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-colors ${
            micMuted ? "bg-red-600 hover:bg-red-700" : "bg-white/10 hover:bg-white/20"
          }`}
          title={micMuted ? "Mikrofon einschalten" : "Mikrofon ausschalten"}
        >
          {micMuted ? "🔇" : "🎙️"}
        </button>

        {/* Camera */}
        <button
          onClick={() => void toggleCam()}
          className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-colors ${
            camOff ? "bg-red-600 hover:bg-red-700" : "bg-white/10 hover:bg-white/20"
          }`}
          title={camOff ? "Kamera einschalten" : "Kamera ausschalten"}
        >
          {camOff ? "📵" : "📹"}
        </button>

        {/* Room ID display */}
        <span className="px-3 py-1 rounded-lg bg-white/5 text-white/40 text-xs font-mono">
          {roomId}
        </span>

        {/* Leave */}
        <button
          onClick={() => void leave()}
          className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-lg transition-colors"
          title="Meeting verlassen"
        >
          📴
        </button>
      </div>

      {/* Host badge */}
      {isHost && (
        <div className="absolute top-4 left-4 px-2 py-1 rounded-full bg-brand-500/80 text-white text-xs font-semibold">
          Host
        </div>
      )}
    </div>
  );
}
