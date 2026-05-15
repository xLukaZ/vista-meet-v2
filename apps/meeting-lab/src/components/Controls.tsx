import { useState, useRef, useEffect } from "react";
import {
  Microphone, MicrophoneSlash,
  VideoCamera, VideoCameraSlash,
  Monitor, MonitorArrowUp,
  SpeakerHigh,
  SignOut,
  CaretUp,
  Circle,
  ChatCircle,
  GearSix,
  Hand,
} from "@phosphor-icons/react";
import type { MediaDevice } from "../hooks/useMeeting.js";

type Props = {
  isMicOn: boolean;
  isCamOn: boolean;
  isSharing: boolean;
  onMicToggle: (enabled: boolean) => void;
  onCameraToggle: (enabled: boolean) => void;
  onScreenShare: (enabled: boolean) => Promise<void>;
  onLeave: () => void;
  onDeviceSwitch: (kind: "audioinput" | "audiooutput" | "videoinput", deviceId: string) => void;
  audioInputs: MediaDevice[];
  audioOutputs: MediaDevice[];
  videoInputs: MediaDevice[];
  onChatToggle?: () => void;
  onSettingsToggle?: () => void;
  onHandToggle?: () => void;
  chatOpen?: boolean;
  settingsOpen?: boolean;
  handRaised?: boolean;
  unreadCount?: number;
  isHost?: boolean;
};

function DeviceMenu({
  devices,
  onSelect,
  onClose,
}: {
  devices: MediaDevice[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-vista-raised border border-vista-border rounded-2xl shadow-2xl z-50 min-w-52 overflow-hidden py-1"
    >
      {devices.length === 0 ? (
        <p className="px-4 py-3 text-sm text-vista-muted">Keine Geräte gefunden</p>
      ) : (
        devices.map((d) => (
          <button
            key={d.deviceId}
            onClick={() => { onSelect(d.deviceId); onClose(); }}
            className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-vista-elevated transition-colors truncate"
          >
            {d.label}
          </button>
        ))
      )}
    </div>
  );
}

export function Controls({
  isMicOn,
  isCamOn,
  isSharing,
  onMicToggle,
  onCameraToggle,
  onScreenShare,
  onLeave,
  onDeviceSwitch,
  audioInputs,
  audioOutputs,
  videoInputs,
  onChatToggle,
  onSettingsToggle,
  onHandToggle,
  chatOpen,
  settingsOpen,
  handRaised,
  unreadCount,
  isHost,
}: Props) {
  const [openMenu, setOpenMenu] = useState<"mic" | "speaker" | "cam" | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  const toggleShare = async () => {
    if (shareLoading) return;
    setShareLoading(true);
    try {
      await onScreenShare(!isSharing);
    } catch {
      // user cancelled picker
    } finally {
      setShareLoading(false);
    }
  };

  const btnBase = "w-11 h-11 rounded-full flex items-center justify-center transition-all disabled:opacity-50";

  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3 bg-vista-surface border-t border-vista-border shrink-0">

      {/* Mic + selector */}
      <div className="relative flex items-center gap-0.5">
        <button
          onClick={() => onMicToggle(!isMicOn)}
          title={isMicOn ? "Mikrofon aus" : "Mikrofon an"}
          className={`${btnBase} ${isMicOn ? "bg-vista-elevated hover:bg-vista-border text-white" : "bg-red-600 hover:bg-red-500 text-white"}`}
        >
          {isMicOn ? <Microphone size={20} weight="fill" /> : <MicrophoneSlash size={20} weight="fill" />}
        </button>
        <button
          onClick={() => setOpenMenu(openMenu === "mic" ? null : "mic")}
          className="w-5 h-5 rounded-full bg-vista-elevated hover:bg-vista-border flex items-center justify-center transition-colors"
          title="Mikrofon wählen"
        >
          <CaretUp size={9} weight="bold" className="text-white/60" />
        </button>
        {openMenu === "mic" && (
          <DeviceMenu devices={audioInputs} onSelect={(id) => onDeviceSwitch("audioinput", id)} onClose={() => setOpenMenu(null)} />
        )}
      </div>

      {/* Speaker */}
      <div className="relative">
        <button
          onClick={() => setOpenMenu(openMenu === "speaker" ? null : "speaker")}
          title="Lautsprecher wählen"
          className={`${btnBase} bg-vista-elevated hover:bg-vista-border text-white/80 hover:text-white`}
        >
          <SpeakerHigh size={20} weight="fill" />
        </button>
        {openMenu === "speaker" && (
          <DeviceMenu devices={audioOutputs} onSelect={(id) => onDeviceSwitch("audiooutput", id)} onClose={() => setOpenMenu(null)} />
        )}
      </div>

      {/* Camera + selector */}
      <div className="relative flex items-center gap-0.5">
        <button
          onClick={() => onCameraToggle(!isCamOn)}
          title={isCamOn ? "Kamera aus" : "Kamera an"}
          className={`${btnBase} ${isCamOn ? "bg-vista-elevated hover:bg-vista-border text-white" : "bg-red-600 hover:bg-red-500 text-white"}`}
        >
          {isCamOn ? <VideoCamera size={20} weight="fill" /> : <VideoCameraSlash size={20} weight="fill" />}
        </button>
        <button
          onClick={() => setOpenMenu(openMenu === "cam" ? null : "cam")}
          className="w-5 h-5 rounded-full bg-vista-elevated hover:bg-vista-border flex items-center justify-center transition-colors"
          title="Kamera wählen"
        >
          <CaretUp size={9} weight="bold" className="text-white/60" />
        </button>
        {openMenu === "cam" && (
          <DeviceMenu devices={videoInputs} onSelect={(id) => onDeviceSwitch("videoinput", id)} onClose={() => setOpenMenu(null)} />
        )}
      </div>

      {/* Screen share */}
      <button
        onClick={() => void toggleShare()}
        disabled={shareLoading}
        title={isSharing ? "Freigabe stoppen" : "Bildschirm teilen"}
        className={`${btnBase} ${
          isSharing
            ? "bg-brand-500 hover:bg-brand-400 text-white"
            : "bg-vista-elevated hover:bg-vista-border text-white/80 hover:text-white"
        }`}
      >
        {shareLoading
          ? <Circle size={20} weight="fill" className="animate-pulse" />
          : isSharing
            ? <MonitorArrowUp size={20} weight="fill" />
            : <Monitor size={20} weight="fill" />}
      </button>

      <div className="w-px h-7 bg-vista-border mx-1 shrink-0" />

      {/* Chat */}
      {onChatToggle && (
        <div className="relative">
          <button
            onClick={onChatToggle}
            title="Chat"
            className={`${btnBase} ${chatOpen ? "bg-brand-500 hover:bg-brand-400 text-white" : "bg-vista-elevated hover:bg-vista-border text-white/80 hover:text-white"}`}
          >
            <ChatCircle size={20} weight="fill" />
          </button>
          {!!unreadCount && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center pointer-events-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      )}

      {/* Raise hand */}
      {onHandToggle && (
        <button
          onClick={onHandToggle}
          title={handRaised ? "Hand senken" : "Hand heben"}
          className={`${btnBase} ${handRaised ? "bg-yellow-500 hover:bg-yellow-400 text-white" : "bg-vista-elevated hover:bg-vista-border text-white/80 hover:text-white"}`}
        >
          <Hand size={20} weight="fill" />
        </button>
      )}

      {/* Settings — host only */}
      {isHost && onSettingsToggle && (
        <button
          onClick={onSettingsToggle}
          title="Einstellungen"
          className={`${btnBase} ${settingsOpen ? "bg-brand-500 hover:bg-brand-400 text-white" : "bg-vista-elevated hover:bg-vista-border text-white/80 hover:text-white"}`}
        >
          <GearSix size={20} weight="fill" />
        </button>
      )}

      <div className="w-px h-7 bg-vista-border mx-1 shrink-0" />

      {/* Leave */}
      <button
        onClick={onLeave}
        className="flex items-center gap-2 px-5 h-11 rounded-full text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-all"
      >
        <SignOut size={16} weight="fill" />
        Verlassen
      </button>
    </div>
  );
}
