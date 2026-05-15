import { useRef } from "react";
import type { MeetingUser } from "@meet-vista/meeting-core";
import {
  MicrophoneSlash, Microphone,
  VideoCamera, VideoCameraSlash,
  X, MonitorArrowUp,
} from "@phosphor-icons/react";
import { VideoTile } from "./VideoTile.js";
import { useVideoTrack } from "../hooks/useVideoTrack.js";
import type { LeftPanelDef } from "./LeftPanelOverlay.js";
import { LeftPanelOverlay } from "./LeftPanelOverlay.js";

type Props = {
  participants: MeetingUser[];
  localUserId: string;
  isHost: boolean;
  raisedHands: ReadonlySet<string>;
  onKick: (id: string) => void;
  onMuteToggle: (id: string, muted: boolean) => void;
  onCameraToggle: (id: string, cameraOff: boolean) => void;
  onScreenShareToggle: (id: string, sharing: boolean) => void;
  activePanel?: string | null;
  leftPanels?: LeftPanelDef[];
};

function gridCols(count: number) {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

function HostControls({
  user,
  onMuteToggle,
  onCameraToggle,
  onKick,
}: {
  user: MeetingUser;
  onMuteToggle: (muted: boolean) => void;
  onCameraToggle: (off: boolean) => void;
  onKick: () => void;
}) {
  return (
    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
      <button
        onClick={(e) => { e.stopPropagation(); onMuteToggle(user.isMuted); }}
        className="w-6 h-6 rounded-md bg-vista-elevated/90 hover:bg-brand-600 flex items-center justify-center transition-colors"
        title={user.isMuted ? "Ton einschalten" : "Stummschalten"}
      >
        {user.isMuted
          ? <Microphone size={11} weight="fill" className="text-white" />
          : <MicrophoneSlash size={11} weight="fill" className="text-white" />}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onCameraToggle(user.isCameraOff); }}
        className="w-6 h-6 rounded-md bg-vista-elevated/90 hover:bg-brand-600 flex items-center justify-center transition-colors"
        title={user.isCameraOff ? "Kamera einschalten" : "Kamera ausschalten"}
      >
        {user.isCameraOff
          ? <VideoCamera size={11} weight="fill" className="text-white" />
          : <VideoCameraSlash size={11} weight="fill" className="text-white" />}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onKick(); }}
        className="w-6 h-6 rounded-md bg-red-700/90 hover:bg-red-500 flex items-center justify-center transition-colors"
        title="Kicken"
      >
        <X size={12} weight="bold" className="text-white" />
      </button>
    </div>
  );
}

function ScreenShareTile({
  sharer,
  isLocal,
  isHost,
  onStopShare,
}: {
  sharer: MeetingUser;
  isLocal: boolean;
  isHost: boolean;
  onStopShare: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useVideoTrack(sharer.screenTrack, videoRef);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-vista-bg ring-1 ring-brand-500/50 group">
      <video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-contain" />
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent flex items-center gap-2 pointer-events-none">
        <span className="text-white text-xs font-medium flex-1 truncate">
          {sharer.displayName} teilt Bildschirm
        </span>
      </div>
      {(isLocal || isHost) && (
        <button
          onClick={onStopShare}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg bg-red-800/90 hover:bg-red-600 flex items-center justify-center"
          title="Freigabe stoppen"
        >
          <MonitorArrowUp size={13} weight="fill" className="text-white" />
        </button>
      )}
    </div>
  );
}

export function GridLayout({
  participants,
  localUserId,
  isHost,
  raisedHands,
  onKick,
  onMuteToggle,
  onCameraToggle,
  onScreenShareToggle,
  activePanel,
  leftPanels,
}: Props) {
  const screenSharer = participants.find((p) => p.isScreenSharing && p.screenTrack);
  const cols = gridCols(participants.length);

  return (
    <div className="relative flex-1 overflow-hidden bg-vista-bg min-h-0 flex">
      {/* Left panel overlay */}
      {leftPanels && leftPanels.length > 0 && activePanel != null && (
        <LeftPanelOverlay panels={leftPanels} activePanel={activePanel} />
      )}

      {screenSharer ? (
        /* Screen share mode: big screen on left, participant strip on right */
        <div className="flex flex-1 gap-2 p-2 min-h-0">
          <div className="flex-1 min-w-0">
            <ScreenShareTile
              sharer={screenSharer}
              isLocal={screenSharer.id === localUserId}
              isHost={isHost}
              onStopShare={() => onScreenShareToggle(screenSharer.id, true)}
            />
          </div>
          <div className="w-44 flex flex-col gap-2 overflow-y-auto shrink-0">
            {participants.map((user) => (
              <div key={user.id} className="relative aspect-video shrink-0 group">
                <VideoTile
                  user={user}
                  isLocal={user.id === localUserId}
                  compact
                  handRaised={raisedHands.has(user.id)}
                />
                {isHost && user.id !== localUserId && (
                  <HostControls
                    user={user}
                    onMuteToggle={(muted) => onMuteToggle(user.id, muted)}
                    onCameraToggle={(off) => onCameraToggle(user.id, off)}
                    onKick={() => onKick(user.id)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Grid mode: all participants equally sized */
        <div
          className="flex-1 grid gap-2 p-2 content-start auto-rows-fr"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {participants.map((user) => (
            <div key={user.id} className="relative group min-h-0">
              <VideoTile
                user={user}
                isLocal={user.id === localUserId}
                handRaised={raisedHands.has(user.id)}
              />
              {isHost && user.id !== localUserId && (
                <HostControls
                  user={user}
                  onMuteToggle={(muted) => onMuteToggle(user.id, muted)}
                  onCameraToggle={(off) => onCameraToggle(user.id, off)}
                  onKick={() => onKick(user.id)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
