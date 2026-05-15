import { useCallback, useEffect, useState } from "react";
import { LiveKitMeetingClient } from "@meet-vista/meeting-core";
import { useMeetingStore } from "../store/meetingStore.js";

const API_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:3001";
const LIVEKIT_URL = (import.meta.env["VITE_LIVEKIT_URL"] as string | undefined) ?? "";

export type MediaDevice = { deviceId: string; label: string };

export function useMeeting() {
  const {
    client,
    state,
    participants,
    roomId,
    meetingName,
    setClient,
    setState,
    setParticipants,
    setRoomId,
    setMeetingName,
    setLocalUserId,
    reset,
  } = useMeetingStore();

  const [audioInputs, setAudioInputs] = useState<MediaDevice[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDevice[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDevice[]>([]);
  const [permissionsVersion, setPermissionsVersion] = useState(0);

  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(
        devices
          .filter((d) => d.kind === "audioinput")
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Mikrofon ${i + 1}` }))
      );
      setAudioOutputs(
        devices
          .filter((d) => d.kind === "audiooutput")
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Lautsprecher ${i + 1}` }))
      );
      setVideoInputs(
        devices
          .filter((d) => d.kind === "videoinput")
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Kamera ${i + 1}` }))
      );
    } catch {
      // permissions not yet granted — will retry after join
    }
  }, []);

  const _connectToRoom = useCallback(
    async (roomToken: string, livekitToken: string, participantId: string, name: string) => {
      if (!LIVEKIT_URL) throw new Error("VITE_LIVEKIT_URL ist nicht gesetzt in .env");

      const meetingClient = new LiveKitMeetingClient({ serverUrl: LIVEKIT_URL });
      meetingClient.onConnectionStateChanged(setState);
      meetingClient.onParticipantsChanged(setParticipants);
      meetingClient.onPermissionsChanged(() => {
        setPermissionsVersion((v) => v + 1);
        void enumerateDevices();
      });

      setClient(meetingClient);
      setRoomId(roomToken);
      setMeetingName(name);
      setLocalUserId(participantId);

      await meetingClient.join(roomToken, livekitToken);
      await enumerateDevices();
    },
    [setClient, setRoomId, setMeetingName, setLocalUserId, setState, setParticipants, enumerateDevices],
  );

  // Guest join: fetches token from /dev/guest-token using the meeting token (UUID).
  const join = useCallback(
    async (meetingToken: string, displayName: string) => {
      const res = await fetch(`${API_URL}/dev/guest-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: meetingToken, displayName }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? "Token-Anfrage fehlgeschlagen");
      }

      const data = (await res.json()) as {
        livekitToken: string;
        participantId: string;
        meetingName?: string;
      };

      await _connectToRoom(meetingToken, data.livekitToken, data.participantId, data.meetingName ?? "");
    },
    [_connectToRoom],
  );

  // Host join: receives pre-fetched tokens from MeetingApp (after calling /dev/create-meeting).
  const joinAsHost = useCallback(
    async (meetingToken: string, name: string, livekitToken: string, participantId: string) => {
      await _connectToRoom(meetingToken, livekitToken, participantId, name);
    },
    [_connectToRoom],
  );

  const leave = useCallback(async () => {
    await client?.leave();
    client?.destroy();
    reset();
  }, [client, reset]);

  const setMicrophone = useCallback(
    (enabled: boolean) => client?.setMicrophone(enabled),
    [client]
  );

  const setCamera = useCallback((enabled: boolean) => client?.setCamera(enabled), [client]);

  const shareScreen = useCallback(
    (enabled: boolean) => client?.shareScreen(enabled) ?? Promise.resolve(),
    [client]
  );

  const switchDevice = useCallback(
    (kind: "audioinput" | "audiooutput" | "videoinput", deviceId: string) =>
      client?.switchDevice(kind, deviceId),
    [client]
  );

  const sendData = useCallback(
    (payload: Uint8Array, reliable: boolean) =>
      client?.sendData(payload, reliable) ?? Promise.resolve(),
    [client]
  );

  const onData = useCallback(
    (cb: (payload: Uint8Array, participantIdentity: string) => void) =>
      client?.onData(cb) ?? (() => undefined),
    [client]
  );

  useEffect(() => {
    return () => {
      client?.destroy();
    };
  }, [client]);

  const localUser = participants.find((p) => p.id === useMeetingStore.getState().localUserId);
  const isWaiting = localUser?.role === "waiting";

  useEffect(() => {
    if (permissionsVersion > 0 && !isWaiting && client) {
      void client.setMicrophone(true).catch(() => undefined);
      void client.setCamera(true).catch(() => undefined);
    }
  }, [permissionsVersion, isWaiting, client]);

  return {
    join,
    joinAsHost,
    leave,
    setMicrophone,
    setCamera,
    shareScreen,
    switchDevice,
    sendData,
    onData,
    state,
    participants,
    roomId,
    meetingName,
    audioInputs,
    audioOutputs,
    videoInputs,
    isConnected: state === "connected",
    isConnecting: state === "connecting" || state === "reconnecting",
    isFailed: state === "failed",
    isWaiting,
  };
}
