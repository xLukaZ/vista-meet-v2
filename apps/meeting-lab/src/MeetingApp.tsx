import { useState, useEffect, useCallback, useRef } from "react";
import { useMeeting } from "./hooks/useMeeting.js";
import { useMeetingStore } from "./store/meetingStore.js";
import { JoinForm } from "./components/JoinForm.js";
import { Controls } from "./components/Controls.js";
import { ConnectionBanner } from "./components/ConnectionBanner.js";
import { WaitingScreen } from "./components/WaitingScreen.js";
import { SpotlightLayout } from "./components/SpotlightLayout.js";
import { GridLayout } from "./components/GridLayout.js";
import { ChatPanel, type ChatMessage } from "./components/panels/ChatPanel.js";
import { SettingsPanel, SettingsToggle, type SettingsSection } from "./components/panels/SettingsPanel.js";
import type { LeftPanelDef } from "./components/LeftPanelOverlay.js";
import { Link, Users, ChatCircle, GearSix, SquaresFour, Sidebar, Check, X } from "@phosphor-icons/react";

const API_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:3001";

// ─── Data channel message types ───────────────────────────────────────────────

type ChatPayload = { type: "chat"; from: string; text: string; ts: number };
type HandPayload = { type: "hand"; raised: boolean; identity: string };
type DataPayload = ChatPayload | HandPayload;

function parsePayload(bytes: Uint8Array): DataPayload | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    if (p["type"] === "chat" && typeof p["text"] === "string") return p as unknown as ChatPayload;
    if (p["type"] === "hand" && typeof p["raised"] === "boolean") return p as unknown as HandPayload;
    return null;
  } catch {
    return null;
  }
}

// ─── Dev API helper ────────────────────────────────────────────────────────────

async function devApi(endpoint: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${API_URL}/dev/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `${endpoint} fehlgeschlagen`);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MeetingApp() {
  const {
    join, joinAsHost, leave, setMicrophone, setCamera, shareScreen, switchDevice,
    sendData, onData,
    state, participants, audioInputs, audioOutputs, videoInputs, isWaiting,
  } = useMeeting();
  const { roomId, meetingName, localUserId } = useMeetingStore();

  const [linkCopied, setLinkCopied] = useState(false);
  const [showStrip, setShowStrip] = useState(true);
  const [pendingDisplayName, setPendingDisplayName] = useState("");
  const [layout, setLayout] = useState<"spotlight" | "grid">("spotlight");

  const [activePanel, setActivePanel] = useState<"chat" | "settings" | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [roomClosed, setRoomClosed] = useState(false);

  const [raisedHands, setRaisedHands] = useState<ReadonlySet<string>>(new Set());
  const [localHandRaised, setLocalHandRaised] = useState(false);
  const localHandRaisedRef = useRef(false);

  // ─── Join handlers ─────────────────────────────────────────────────────────

  const handleGuestJoin = async (meetingToken: string, displayName: string) => {
    setPendingDisplayName(displayName);
    await join(meetingToken, displayName);
  };

  const handleHostCreate = async (name: string, displayName: string, requireApproval: boolean) => {
    setPendingDisplayName(displayName);
    const res = await fetch(`${API_URL}/dev/create-meeting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingName: name, displayName, requireApproval }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message ?? "Meeting-Erstellung fehlgeschlagen");
    }
    const data = (await res.json()) as {
      meetingToken: string;
      meetingName: string;
      livekitToken: string;
      participantId: string;
    };
    await joinAsHost(data.meetingToken, data.meetingName, data.livekitToken, data.participantId);
  };

  // ─── Data channel ──────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = onData((bytes) => {
      const msg = parsePayload(bytes);
      if (!msg) return;

      if (msg.type === "chat") {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), from: msg.from, text: msg.text, ts: msg.ts },
        ]);
        setUnreadCount((n) => (activePanel === "chat" ? 0 : n + 1));
      } else if (msg.type === "hand") {
        setRaisedHands((prev) => {
          const next = new Set(prev);
          if (msg.raised) next.add(msg.identity);
          else next.delete(msg.identity);
          return next;
        });
      }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onData]);

  useEffect(() => {
    if (activePanel === "chat") setUnreadCount(0);
  }, [activePanel]);

  const localUser = participants.find((p) => p.id === localUserId);
  const isHost = localUser?.role === "host";
  const waitingUsers = participants.filter((p) => p.role === "waiting");
  const activeParticipants = participants.filter((p) => p.role !== "waiting");

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const displayName = localUser?.displayName ?? pendingDisplayName;
      const payload: ChatPayload = { type: "chat", from: displayName, text, ts: Date.now() };
      void sendData(new TextEncoder().encode(JSON.stringify(payload)), true);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), from: displayName, text, ts: payload.ts },
      ]);
    },
    [localUser?.displayName, pendingDisplayName, sendData],
  );

  const toggleHand = useCallback(() => {
    const next = !localHandRaisedRef.current;
    localHandRaisedRef.current = next;
    setLocalHandRaised(next);
    const payload: HandPayload = { type: "hand", raised: next, identity: localUserId };
    void sendData(new TextEncoder().encode(JSON.stringify(payload)), true);
    setRaisedHands((prev) => {
      const s = new Set(prev);
      if (next) s.add(localUserId);
      else s.delete(localUserId);
      return s;
    });
  }, [localUserId, sendData]);

  // ─── Dev API actions ──────────────────────────────────────────────────────

  const kickParticipant = useCallback(async (participantId: string) => {
    await devApi("kick", { roomId, participantIdentity: participantId });
  }, [roomId]);

  const muteParticipant = useCallback(async (participantId: string, currentlyMuted: boolean) => {
    await devApi("mute-participant", { roomId, participantIdentity: participantId, muted: !currentlyMuted });
  }, [roomId]);

  const toggleCameraOff = useCallback(async (participantId: string, currentlyCameraOff: boolean) => {
    await devApi("camera-participant", { roomId, participantIdentity: participantId, cameraOff: !currentlyCameraOff });
  }, [roomId]);

  const toggleScreenSharePermission = useCallback(async (participantId: string, currentlySharing: boolean) => {
    await devApi("screenshare-permission", { roomId, participantIdentity: participantId, allowed: !currentlySharing });
  }, [roomId]);

  const admitParticipant = useCallback(async (participantId: string) => {
    await devApi("admit-participant", { roomId, participantIdentity: participantId });
  }, [roomId]);

  const denyParticipant = useCallback(async (participantId: string) => {
    await devApi("deny-participant", { roomId, participantIdentity: participantId });
  }, [roomId]);

  const toggleRoomClosed = useCallback(async (closed: boolean) => {
    setRoomClosed(closed);
    try {
      await devApi("set-room-config", { roomId, closed });
    } catch {
      setRoomClosed(!closed);
    }
  }, [roomId]);

  const handleLeave = useCallback(async () => {
    if (isHost) {
      // End the meeting: kick everyone + close the room, then disconnect
      try {
        await devApi("end-meeting", { roomId });
      } catch {
        // Continue with disconnect even if the API call fails
      }
    }
    await leave();
  }, [isHost, roomId, leave]);

  // ─── Render: pre-join / waiting ───────────────────────────────────────────

  if (state === "disconnected") {
    return <JoinForm onJoin={handleGuestJoin} onHost={handleHostCreate} />;
  }

  if (isWaiting) {
    return (
      <WaitingScreen
        displayName={pendingDisplayName || localUser?.displayName || "Du"}
        meetingName={meetingName}
        onLeave={() => void handleLeave()}
      />
    );
  }

  // ─── In-meeting ───────────────────────────────────────────────────────────

  const copyInviteLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}?room=${roomId}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const settingsSections: SettingsSection[] = [
    {
      id: "room",
      title: "Raum-Einstellungen",
      content: (
        <SettingsToggle
          label="Raum schließen"
          description="Keine neuen Teilnehmer können beitreten"
          value={roomClosed}
          onChange={(v) => void toggleRoomClosed(v)}
        />
      ),
    },
    {
      id: "participants",
      title: "Teilnehmer",
      content: (
        <div className="flex flex-col gap-2">
          {activeParticipants.filter((p) => p.id !== localUserId).length === 0 && (
            <p className="text-xs text-vista-muted">Keine anderen Teilnehmer</p>
          )}
          {activeParticipants
            .filter((p) => p.id !== localUserId)
            .map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-white/80 truncate">{p.displayName}</span>
                <SettingsToggle
                  label=""
                  value={p.isScreenSharing}
                  onChange={() => void toggleScreenSharePermission(p.id, p.isScreenSharing)}
                />
              </div>
            ))}
        </div>
      ),
    },
  ];

  const leftPanels: LeftPanelDef[] = [
    {
      id: "chat",
      label: "Chat",
      icon: <ChatCircle size={16} weight="fill" />,
      content: <ChatPanel messages={messages} onSend={sendMessage} />,
    },
    ...(isHost
      ? [
          {
            id: "settings",
            label: "Einstellungen",
            icon: <GearSix size={16} weight="fill" />,
            content: <SettingsPanel sections={settingsSections} />,
          } satisfies LeftPanelDef,
        ]
      : []),
  ];

  const togglePanel = (panel: "chat" | "settings") => {
    setActivePanel((current) => (current === panel ? null : panel));
  };

  const sharedLayoutProps = {
    participants: activeParticipants,
    localUserId,
    isHost,
    raisedHands,
    onKick: (id: string) => void kickParticipant(id),
    onMuteToggle: (id: string, muted: boolean) => void muteParticipant(id, muted),
    onCameraToggle: (id: string, cameraOff: boolean) => void toggleCameraOff(id, cameraOff),
    onScreenShareToggle: (id: string, sharing: boolean) => void toggleScreenSharePermission(id, sharing),
    activePanel,
    leftPanels,
  };

  return (
    <div className="h-screen flex flex-col bg-vista-bg overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-vista-surface border-b border-vista-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white tracking-tight">Vista Meet</span>
          <span className="text-xs text-vista-muted font-mono bg-vista-elevated px-2 py-0.5 rounded-lg truncate max-w-[200px]">
            {meetingName || roomId}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout toggle */}
          <div className="flex items-center gap-0.5 bg-vista-elevated rounded-xl p-0.5">
            <button
              onClick={() => setLayout("spotlight")}
              title="Spotlight-Ansicht"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${layout === "spotlight" ? "bg-brand-500 text-white" : "text-white/50 hover:text-white"}`}
            >
              <Sidebar size={13} weight="fill" />
            </button>
            <button
              onClick={() => setLayout("grid")}
              title="Kachel-Ansicht"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${layout === "grid" ? "bg-brand-500 text-white" : "text-white/50 hover:text-white"}`}
            >
              <SquaresFour size={13} weight="fill" />
            </button>
          </div>

          <button
            onClick={() => void copyInviteLink()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-vista-elevated hover:bg-vista-border text-white/70 hover:text-white rounded-xl transition-all"
          >
            <Link size={13} weight="bold" />
            {linkCopied ? "Kopiert!" : "Einladungslink"}
          </button>

          <button
            onClick={() => setShowStrip((v) => !v)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 text-xs bg-vista-elevated hover:bg-vista-border text-white/70 hover:text-white rounded-xl transition-all"
          >
            <Users size={13} weight="fill" />
            {activeParticipants.length}
            {waitingUsers.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {waitingUsers.length}
              </span>
            )}
          </button>

          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${
              state === "connected" ? "bg-green-500"
              : state === "reconnecting" ? "bg-yellow-500 animate-pulse"
              : "bg-red-500"
            }`} />
            <span className="text-xs text-vista-muted capitalize">{state}</span>
          </div>
        </div>
      </header>

      <ConnectionBanner state={state} onRetry={() => void leave()} />

      {layout === "spotlight" ? (
        <SpotlightLayout
          {...sharedLayoutProps}
          waitingUsers={waitingUsers}
          showStrip={showStrip}
          onAdmit={(id) => void admitParticipant(id)}
          onDeny={(id) => void denyParticipant(id)}
        />
      ) : (
        <GridLayout {...sharedLayoutProps} />
      )}

      {/* Admit popup overlay — shown in all layouts except spotlight (which has its own strip) */}
      {isHost && waitingUsers.length > 0 && layout !== "spotlight" && (
        <div className="absolute top-16 right-3 z-30 flex flex-col gap-2 w-44 pointer-events-none">
          {waitingUsers.map((user) => (
            <div
              key={user.id}
              className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl pointer-events-auto"
            >
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {user.displayName[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{user.displayName}</p>
                  <p className="text-[10px] text-vista-muted leading-tight mt-0.5">möchte beitreten</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => void admitParticipant(user.id)}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-brand-500 hover:bg-brand-400 text-white transition-colors flex items-center justify-center gap-1"
                >
                  <Check size={10} weight="bold" /> Zulassen
                </button>
                <button
                  onClick={() => void denyParticipant(user.id)}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-vista-elevated hover:bg-vista-border text-white/80 transition-colors flex items-center justify-center gap-1"
                >
                  <X size={10} weight="bold" /> Ablehnen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Controls
        isMicOn={!(localUser?.isMuted ?? false)}
        isCamOn={!(localUser?.isCameraOff ?? false)}
        isSharing={localUser?.isScreenSharing ?? false}
        onMicToggle={(enabled) => void setMicrophone(enabled)}
        onCameraToggle={(enabled) => void setCamera(enabled)}
        onScreenShare={(enabled) => shareScreen(enabled)}
        onLeave={() => void handleLeave()}
        onDeviceSwitch={(kind, deviceId) => void switchDevice(kind, deviceId)}
        audioInputs={audioInputs}
        audioOutputs={audioOutputs}
        videoInputs={videoInputs}
        onChatToggle={() => togglePanel("chat")}
        chatOpen={activePanel === "chat"}
        unreadCount={unreadCount}
        onHandToggle={toggleHand}
        handRaised={localHandRaised}
        {...(isHost ? { onSettingsToggle: () => togglePanel("settings"), settingsOpen: activePanel === "settings", isHost: true } : {})}
      />
    </div>
  );
}
