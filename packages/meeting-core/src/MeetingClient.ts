export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

export type ConnectionQuality = "excellent" | "good" | "poor" | "lost" | "unknown";

export type MeetingUser = {
  id: string;
  displayName: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  role: "host" | "guest" | "waiting";
  connectionQuality: ConnectionQuality;
  track?: MediaStreamTrack;
  screenTrack?: MediaStreamTrack;
};

export interface MeetingClient {
  join(roomId: string, token: string): Promise<void>;
  leave(): Promise<void>;
  destroy(): void;

  setMicrophone(enabled: boolean): Promise<void>;
  setCamera(enabled: boolean): Promise<void>;
  shareScreen(enabled: boolean): Promise<void>;
  switchDevice(kind: "audioinput" | "audiooutput" | "videoinput", deviceId: string): Promise<void>;

  getState(): ConnectionState;
  getLocalUser(): MeetingUser;
  getParticipants(): MeetingUser[];

  onConnectionStateChanged(cb: (state: ConnectionState) => void): () => void;
  onParticipantsChanged(cb: (users: MeetingUser[]) => void): () => void;

  onTokenExpiring(cb: () => Promise<string>): void;

  // Fires when the local participant's permissions change (e.g. admitted from waiting room)
  onPermissionsChanged(cb: () => void): () => void;

  // DataChannel — used for chat and other peer-to-peer messages
  sendData(payload: Uint8Array, reliable: boolean): Promise<void>;
  onData(cb: (payload: Uint8Array, participantIdentity: string) => void): () => void;
}
