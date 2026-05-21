"use client";
import { create } from "zustand";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export type RoomStatus = "idle" | "joining" | "connected" | "error" | "ended";

type RoomStore = {
  displayName: string;
  isHost: boolean;
  status: RoomStatus;
  errorMsg: string | null;
  livekitToken: string | null;
  livekitUrl: string | null;
  hostSecret: string | null;
  /** The identity used when connecting (may differ from displayName) */
  identity: string | null;

  setDisplayName(name: string): void;
  setIsHost(v: boolean): void;
  joinRoom(roomId: string): Promise<void>;
  setStatus(s: RoomStatus): void;
  reset(): void;
};

export const useRoomStore = create<RoomStore>((set, get) => ({
  displayName: "",
  isHost: false,
  status: "idle",
  errorMsg: null,
  livekitToken: null,
  livekitUrl: null,
  hostSecret: null,
  identity: null,

  setDisplayName: (name) => set({ displayName: name }),
  setIsHost: (v) => set({ isHost: v }),
  setStatus: (status) => set({ status }),

  joinRoom: async (roomId) => {
    const { displayName, isHost } = get();
    if (!displayName.trim()) return;

    set({ status: "joining", errorMsg: null });

    try {
      const livekitUrl = process.env["NEXT_PUBLIC_LIVEKIT_URL"] ?? "";

      if (isHost) {
        // Create room + get host token + hostSecret
        const res = await fetch(`${API_URL}/dev/create-meeting`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, hostName: displayName }),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json() as {
          token: string;
          hostSecret: string;
          participantId: string;
        };
        set({
          livekitToken: data.token,
          livekitUrl,
          hostSecret: data.hostSecret,
          identity: data.participantId,
          status: "connected",
        });
      } else {
        // Join as guest
        const res = await fetch(`${API_URL}/dev/guest-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, participantName: displayName }),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json() as { token: string; participantId: string };
        set({
          livekitToken: data.token,
          livekitUrl,
          hostSecret: null,
          identity: data.participantId,
          status: "connected",
        });
      }
    } catch (err) {
      set({ status: "error", errorMsg: (err as Error).message });
    }
  },

  reset: () => set({
    status: "idle",
    errorMsg: null,
    livekitToken: null,
    livekitUrl: null,
    hostSecret: null,
    identity: null,
  }),
}));
