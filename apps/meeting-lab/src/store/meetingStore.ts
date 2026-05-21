import { create } from "zustand";
import type { ConnectionState, MeetingUser } from "@meet-vista/meeting-core";
import type { LiveKitMeetingClient } from "@meet-vista/meeting-core";

type MeetingStore = {
  client: LiveKitMeetingClient | null;
  state: ConnectionState;
  participants: MeetingUser[];
  roomId: string;
  meetingName: string;
  localUserId: string;
  hostSecret: string;

  setClient: (client: LiveKitMeetingClient) => void;
  setState: (state: ConnectionState) => void;
  setParticipants: (participants: MeetingUser[]) => void;
  setRoomId: (roomId: string) => void;
  setMeetingName: (name: string) => void;
  setLocalUserId: (id: string) => void;
  setHostSecret: (secret: string) => void;
  reset: () => void;
};

export const useMeetingStore = create<MeetingStore>((set) => ({
  client: null,
  state: "disconnected",
  participants: [],
  roomId: "",
  meetingName: "",
  localUserId: "",
  hostSecret: "",

  setClient: (client) => set({ client }),
  setState: (state) => set({ state }),
  setParticipants: (participants) => set({ participants }),
  setRoomId: (roomId) => set({ roomId }),
  setMeetingName: (meetingName) => set({ meetingName }),
  setLocalUserId: (localUserId) => set({ localUserId }),
  setHostSecret: (hostSecret) => set({ hostSecret }),
  reset: () =>
    set({ client: null, state: "disconnected", participants: [], roomId: "", meetingName: "", localUserId: "", hostSecret: "" }),
}));
