export type { ConnectionState, MeetingUser, MeetingClient } from "./MeetingClient.js";

export type JoinOptions = {
  roomId: string;
  token: string;
  displayName: string;
};

export type MediaDevices = {
  audioDeviceId?: string;
  videoDeviceId?: string;
};
