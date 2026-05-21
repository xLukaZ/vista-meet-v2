import {
  Room,
  RoomEvent,
  Track,
  ConnectionQuality as LKConnectionQuality,
  type Participant,
  ConnectionState as LKConnectionState,
  type RoomOptions,
} from "livekit-client";
import type { MeetingClient, ConnectionState, ConnectionQuality, MeetingUser } from "../../MeetingClient.js";

type ConnectionStateListener = (state: ConnectionState) => void;
type ParticipantsListener = (users: MeetingUser[]) => void;
type PermissionsListener = () => void;

function mapLKState(state: LKConnectionState): ConnectionState {
  switch (state) {
    case LKConnectionState.Disconnected: return "disconnected";
    case LKConnectionState.Connecting:   return "connecting";
    case LKConnectionState.Connected:    return "connected";
    case LKConnectionState.Reconnecting: return "reconnecting";
    default:                             return "disconnected";
  }
}

function mapConnectionQuality(q: LKConnectionQuality): ConnectionQuality {
  switch (q) {
    case LKConnectionQuality.Excellent: return "excellent";
    case LKConnectionQuality.Good:      return "good";
    case LKConnectionQuality.Poor:      return "poor";
    case LKConnectionQuality.Lost:      return "lost";
    default:                            return "unknown";
  }
}

function participantToUser(participant: Participant): MeetingUser {
  const metadata = participant.metadata
    ? (JSON.parse(participant.metadata) as { role?: string })
    : {};
  const rawRole = metadata.role;
  const role =
    rawRole === "host" ? ("host" as const) :
    rawRole === "waiting" ? ("waiting" as const) :
    ("guest" as const);

  const cameraPub = participant.getTrackPublication(Track.Source.Camera);
  const track = cameraPub?.track?.mediaStreamTrack;

  const screenPub = participant.getTrackPublication(Track.Source.ScreenShare);
  const screenTrack = screenPub?.track?.mediaStreamTrack;

  return {
    id: participant.identity,
    displayName: participant.name ?? participant.identity,
    isSpeaking: participant.isSpeaking,
    isMuted: !participant.isMicrophoneEnabled,
    isCameraOff: !participant.isCameraEnabled,
    isScreenSharing: participant.isScreenShareEnabled,
    connectionQuality: mapConnectionQuality(participant.connectionQuality),
    role,
    ...(track !== undefined ? { track } : {}),
    ...(screenTrack !== undefined ? { screenTrack } : {}),
  };
}

export type LiveKitClientOptions = RoomOptions & {
  serverUrl: string;
};

export class LiveKitMeetingClient implements MeetingClient {
  private room: Room;
  private serverUrl: string;
  private state: ConnectionState = "disconnected";
  private connectionListeners: Set<ConnectionStateListener> = new Set();
  private participantListeners: Set<ParticipantsListener> = new Set();
  private permissionsListeners: Set<PermissionsListener> = new Set();
  private tokenExpiringCb?: () => Promise<string>;
  // Tracks audio elements we've attached so we can clean them up on destroy
  private audioElements: Map<string, HTMLAudioElement[]> = new Map();

  constructor({ serverUrl, ...roomOptions }: LiveKitClientOptions) {
    this.serverUrl = serverUrl;
    this.room = new Room({ adaptiveStream: true, dynacast: true, ...roomOptions });
    this.bindRoomEvents();
  }

  private bindRoomEvents(): void {
    this.room.on(RoomEvent.ConnectionStateChanged, (lkState: LKConnectionState) => {
      this.state = mapLKState(lkState);
      for (const cb of this.connectionListeners) cb(this.state);
    });

    const notify = () => {
      const users = this.getParticipants();
      for (const cb of this.participantListeners) cb(users);
    };

    [
      RoomEvent.ParticipantConnected,    RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackPublished,          RoomEvent.TrackUnpublished,
      RoomEvent.TrackSubscribed,         RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,              RoomEvent.TrackUnmuted,
      RoomEvent.ActiveSpeakersChanged,
      RoomEvent.LocalTrackPublished,     RoomEvent.LocalTrackUnpublished,
      RoomEvent.ConnectionQualityChanged,
      // Fire for ALL participants so the host's UI updates when a waiting guest's
      // metadata changes to "guest" after admission (remote participant metadata change).
      RoomEvent.ParticipantMetadataChanged,
    ].forEach((ev) => this.room.on(ev, notify));

    this.room.on(RoomEvent.Disconnected, () => {
      this.state = "disconnected";
      for (const cb of this.connectionListeners) cb(this.state);
    });

    // Attach remote audio tracks so they actually play in the browser.
    // The raw LiveKit JS SDK does NOT auto-attach audio elements — you must call
    // track.attach() yourself. Without this, speaking indicators work (AudioContext
    // analysis) but the user hears nothing.
    this.room.on(RoomEvent.TrackSubscribed, (track, _pub, _participant) => {
      if (track.kind === Track.Kind.Audio && track.sid) {
        const el = track.attach() as HTMLAudioElement;
        el.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;";
        document.body.appendChild(el);
        const existing = this.audioElements.get(track.sid) ?? [];
        existing.push(el);
        this.audioElements.set(track.sid, existing);
      }
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Audio && track.sid) {
        const elements = this.audioElements.get(track.sid) ?? [];
        for (const el of elements) el.remove();
        this.audioElements.delete(track.sid);
        track.detach();
      }
    });

    // When local participant's permissions change (e.g. admitted from waiting room)
    this.room.on(RoomEvent.ParticipantPermissionsChanged, (_prev, participant) => {
      if (participant.identity === this.room.localParticipant.identity) {
        for (const cb of this.permissionsListeners) cb();
        notify();
      }
    });

    // ParticipantMetadataChanged is now handled in the batch above (fires for all participants).
  }

  async join(_roomId: string, token: string): Promise<void> {
    this.state = "connecting";
    for (const cb of this.connectionListeners) cb(this.state);

    await this.room.connect(this.serverUrl, token, { autoSubscribe: true });

    // Notify participants immediately after connect so the local participant (including
    // waiting-room role from metadata) is reflected in UI before any track events fire.
    const notifyParticipants = () => {
      const users = this.getParticipants();
      for (const cb of this.participantListeners) cb(users);
    };
    notifyParticipants();

    // Only publish mic/camera if we have publish permission (not in waiting room)
    if (this.room.localParticipant.permissions?.canPublish !== false) {
      await Promise.all([
        this.room.localParticipant.setMicrophoneEnabled(true),
        this.room.localParticipant.setCameraEnabled(true, {
          resolution: { width: 1280, height: 720, frameRate: 30 },
        }, {
          videoEncoding: { maxBitrate: 3_000_000, maxFramerate: 30 },
          simulcast: false,
        }),
      ]);
    }

    // Must be called from a user-gesture context to unblock browser audio autoplay
    await this.room.startAudio();
  }

  async leave(): Promise<void> {
    await this.room.disconnect();
  }

  destroy(): void {
    for (const elements of this.audioElements.values()) {
      for (const el of elements) el.remove();
    }
    this.audioElements.clear();
    this.room.removeAllListeners();
    void this.room.disconnect();
    this.connectionListeners.clear();
    this.participantListeners.clear();
    this.permissionsListeners.clear();
  }

  async setMicrophone(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
  }

  async setCamera(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setCameraEnabled(enabled, enabled ? {
      resolution: { width: 1280, height: 720, frameRate: 30 },
    } : undefined, {
      videoEncoding: { maxBitrate: 3_000_000, maxFramerate: 30 },
      simulcast: false,
    });
  }

  async shareScreen(enabled: boolean): Promise<void> {
    if (enabled) {
      await this.room.localParticipant.setScreenShareEnabled(true, {
        audio: true,
        contentHint: "detail",
        resolution: { width: 1920, height: 1080, frameRate: 30 },
      });
    } else {
      await this.room.localParticipant.setScreenShareEnabled(false);
    }
  }

  async switchDevice(kind: "audioinput" | "audiooutput" | "videoinput", deviceId: string): Promise<void> {
    await this.room.switchActiveDevice(kind, deviceId);

    if (kind === "audiooutput") {
      // Also set sinkId on all audio elements we're managing, since LiveKit's
      // switchActiveDevice may not reach manually-attached elements in all SDK versions
      for (const elements of this.audioElements.values()) {
        for (const el of elements) {
          if ("setSinkId" in el) {
            await (el as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId);
          }
        }
      }
      return;
    }

    if (kind === "videoinput") {
      await this.room.localParticipant.setCameraEnabled(false);
      await this.room.localParticipant.setCameraEnabled(true);
    } else if (kind === "audioinput") {
      await this.room.localParticipant.setMicrophoneEnabled(false);
      await this.room.localParticipant.setMicrophoneEnabled(true);
    }
  }

  getState(): ConnectionState { return this.state; }

  getLocalUser(): MeetingUser { return participantToUser(this.room.localParticipant); }

  getParticipants(): MeetingUser[] {
    const local = participantToUser(this.room.localParticipant);
    const remotes = Array.from(this.room.remoteParticipants.values()).map(participantToUser);
    return [local, ...remotes];
  }

  onConnectionStateChanged(cb: ConnectionStateListener): () => void {
    this.connectionListeners.add(cb);
    return () => this.connectionListeners.delete(cb);
  }

  onParticipantsChanged(cb: ParticipantsListener): () => void {
    this.participantListeners.add(cb);
    return () => this.participantListeners.delete(cb);
  }

  onPermissionsChanged(cb: PermissionsListener): () => void {
    this.permissionsListeners.add(cb);
    return () => this.permissionsListeners.delete(cb);
  }

  onTokenExpiring(cb: () => Promise<string>): void {
    this.tokenExpiringCb = cb;
  }

  getRawRoom(): Room { return this.room; }

  async sendData(payload: Uint8Array, reliable: boolean): Promise<void> {
    await this.room.localParticipant.publishData(payload, { reliable });
  }

  onData(cb: (payload: Uint8Array, participantIdentity: string) => void): () => void {
    const handler = (payload: Uint8Array, participant: Participant | undefined, _kind: unknown, _topic?: string) =>
      cb(payload, participant?.identity ?? "");
    this.room.on(RoomEvent.DataReceived, handler);
    return () => this.room.off(RoomEvent.DataReceived, handler);
  }

  /**
   * Exposes the underlying LiveKit Room instance for adapters that need direct
   * room access (e.g. LiveKitDataChannelTransport for presence sync).
   * @internal — only use in adapters within this monorepo.
   */
  getInternalRoom(): Room {
    return this.room;
  }
}
