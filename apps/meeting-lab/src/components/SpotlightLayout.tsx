import { useState, useEffect, useRef } from "react";
import type { MeetingUser } from "@meet-vista/meeting-core";
import {
  MicrophoneSlash, Microphone,
  VideoCamera, VideoCameraSlash,
  Monitor, MonitorArrowUp,
  X,
  Check,
  Star,
} from "@phosphor-icons/react";
import type { LeftPanelDef } from "./LeftPanelOverlay.js";
import { LeftPanelOverlay } from "./LeftPanelOverlay.js";
import { VideoTile } from "./VideoTile.js";
import { useVideoTrack } from "../hooks/useVideoTrack.js";

type Props = {
  participants: MeetingUser[];
  localUserId: string;
  isHost: boolean;
  waitingUsers: MeetingUser[];
  showStrip: boolean;
  raisedHands: ReadonlySet<string>;
  onAdmit: (id: string) => void;
  onDeny: (id: string) => void;
  onKick: (id: string) => void;
  onMuteToggle: (id: string, muted: boolean) => void;
  onCameraToggle: (id: string, cameraOff: boolean) => void;
  onScreenShareToggle: (id: string, sharing: boolean) => void;
  activePanel?: string | null;
  leftPanels?: LeftPanelDef[];
};

function getDefaultSpotlightId(
  participants: MeetingUser[],
  localUserId: string,
  isHost: boolean,
): string {
  if (participants.length === 0) return localUserId;
  const first = participants[0];
  if (!first) return localUserId;
  if (participants.length === 1) return first.id;
  if (isHost) {
    return participants.find((p) => p.id !== localUserId)?.id ?? first.id;
  }
  return (
    participants.find((p) => p.role === "host")?.id ??
    participants.find((p) => p.id !== localUserId)?.id ??
    first.id
  );
}

function SpotlightVideo({
  user,
  isLocal,
  screenSharer,
}: {
  user: MeetingUser;
  isLocal: boolean;
  screenSharer?: MeetingUser;
}) {
  const camRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);

  useVideoTrack(user.track, camRef);
  useVideoTrack(screenSharer?.screenTrack, screenRef);

  const showCam = !screenSharer && !user.isCameraOff && user.track;
  const showScreen = !!screenSharer?.screenTrack;
  const displayUser = screenSharer ?? user;

  return (
    <div className="absolute inset-0 bg-vista-bg flex items-center justify-center">
      <video
        ref={screenRef}
        autoPlay
        playsInline
        muted={isLocal && screenSharer != null}
        className={`w-full h-full object-contain ${showScreen ? "block" : "hidden"}`}
      />
      <video
        ref={camRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${showCam ? "block" : "hidden"}`}
      />
      {!showCam && !showScreen && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full bg-brand-500 flex items-center justify-center text-4xl font-bold text-white select-none">
            {displayUser.displayName[0]?.toUpperCase() ?? "?"}
          </div>
          <span className="text-white/80 text-base font-medium">{displayUser.displayName}</span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 px-5 py-4 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
        <span className="text-white font-semibold text-sm flex-1 truncate">
          {screenSharer
            ? `${screenSharer.displayName} teilt Bildschirm`
            : `${user.displayName}${isLocal ? " (du)" : ""}`}
        </span>
        {!screenSharer && user.role === "host" && (
          <Star size={14} weight="fill" className="text-brand-400" />
        )}
        {!screenSharer && user.isMuted && (
          <MicrophoneSlash size={14} weight="fill" className="text-red-400" />
        )}
      </div>

      {!screenSharer && user.isSpeaking && (
        <div className="absolute inset-0 ring-2 ring-brand-500 ring-inset pointer-events-none rounded-sm" />
      )}
    </div>
  );
}

function ScreenShareThumbnail({
  sharer,
  isLocal,
  isHost,
  onStopShare,
  onSelect,
}: {
  sharer: MeetingUser;
  isLocal: boolean;
  isHost: boolean;
  onStopShare: () => void;
  onSelect: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useVideoTrack(sharer.screenTrack, videoRef);

  return (
    <div
      onClick={onSelect}
      className="relative w-full aspect-video rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-brand-500 group cursor-pointer"
    >
      <video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover" />

      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent flex items-center gap-1 pointer-events-none">
        <Monitor size={8} weight="fill" className="text-brand-400 shrink-0" />
        <span className="text-white text-[10px] font-medium truncate flex-1">
          Bildschirm von {sharer.displayName}
        </span>
      </div>

      {(isLocal || isHost) && (
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => { e.stopPropagation(); onStopShare(); }}
            className="w-6 h-6 rounded-md bg-red-800/90 hover:bg-red-600 flex items-center justify-center transition-colors"
            title="Freigabe stoppen"
          >
            <MonitorArrowUp size={11} weight="fill" className="text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

function Thumbnail({
  user,
  isLocal,
  isSpotlight,
  isHost,
  raisedHand,
  onClick,
  onMuteToggle,
  onCameraToggle,
  onKick,
}: {
  user: MeetingUser;
  isLocal: boolean;
  isSpotlight: boolean;
  isHost: boolean;
  raisedHand: boolean;
  onClick: () => void;
  onMuteToggle: (currentlyMuted: boolean) => void;
  onCameraToggle: (currentlyCameraOff: boolean) => void;
  onKick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`relative w-full aspect-video rounded-xl overflow-hidden cursor-pointer group flex-shrink-0 transition-all duration-150 ${
        isSpotlight
          ? "ring-2 ring-brand-500"
          : user.isSpeaking
            ? "ring-2 ring-brand-400"
            : "ring-1 ring-vista-border hover:ring-brand-600"
      }`}
    >
      <VideoTile user={user} isLocal={isLocal} compact handRaised={raisedHand} />

      {isHost && !isLocal && (
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
      )}
    </div>
  );
}

export function SpotlightLayout({
  participants,
  localUserId,
  isHost,
  waitingUsers,
  showStrip,
  raisedHands,
  onAdmit,
  onDeny,
  onKick,
  onMuteToggle,
  onCameraToggle,
  onScreenShareToggle,
  activePanel,
  leftPanels,
}: Props) {
  const [spotlightId, setSpotlightId] = useState<string | null>(null);

  const screenSharer = participants.find((p) => p.isScreenSharing && p.screenTrack);

  useEffect(() => {
    if (!screenSharer) setSpotlightId(null);
  }, [screenSharer?.id]);

  useEffect(() => {
    if (spotlightId && !participants.find((p) => p.id === spotlightId)) {
      setSpotlightId(null);
    }
  }, [participants, spotlightId]);

  const showScreenShareInSpotlight = !!screenSharer && spotlightId === null;

  const effectiveSpotlightId =
    spotlightId ?? getDefaultSpotlightId(participants, localUserId, isHost);
  const spotlightUser = participants.find((p) => p.id === effectiveSpotlightId) ?? participants[0];

  const stripUsers = showScreenShareInSpotlight
    ? participants
    : participants.filter((p) => p.id !== effectiveSpotlightId);

  const hasStrip = showStrip && (stripUsers.length > 0 || (isHost && waitingUsers.length > 0) || (!showScreenShareInSpotlight && !!screenSharer));

  // Host controls shown on the main spotlight tile (for remote participants only)
  const showSpotlightControls =
    isHost &&
    !showScreenShareInSpotlight &&
    spotlightUser != null &&
    spotlightUser.id !== localUserId;

  return (
    <div className="relative flex-1 overflow-hidden bg-vista-bg min-h-0 group/spotlight">
      {spotlightUser && (
        <SpotlightVideo
          user={spotlightUser}
          isLocal={spotlightUser.id === localUserId}
          {...(showScreenShareInSpotlight ? { screenSharer } : {})}
        />
      )}

      {/* Host controls overlay on main spotlight tile */}
      {showSpotlightControls && spotlightUser && (
        <div className="absolute top-3 left-4 z-20 opacity-0 group-hover/spotlight:opacity-100 transition-opacity flex gap-1.5">
          <button
            onClick={() => onMuteToggle(spotlightUser.id, spotlightUser.isMuted)}
            className="w-8 h-8 rounded-lg bg-black/60 hover:bg-brand-600 flex items-center justify-center transition-colors backdrop-blur-sm"
            title={spotlightUser.isMuted ? "Ton einschalten" : "Stummschalten"}
          >
            {spotlightUser.isMuted
              ? <Microphone size={14} weight="fill" className="text-white" />
              : <MicrophoneSlash size={14} weight="fill" className="text-white" />}
          </button>
          <button
            onClick={() => onCameraToggle(spotlightUser.id, spotlightUser.isCameraOff)}
            className="w-8 h-8 rounded-lg bg-black/60 hover:bg-brand-600 flex items-center justify-center transition-colors backdrop-blur-sm"
            title={spotlightUser.isCameraOff ? "Kamera einschalten" : "Kamera ausschalten"}
          >
            {spotlightUser.isCameraOff
              ? <VideoCamera size={14} weight="fill" className="text-white" />
              : <VideoCameraSlash size={14} weight="fill" className="text-white" />}
          </button>
          <button
            onClick={() => onKick(spotlightUser.id)}
            className="w-8 h-8 rounded-lg bg-red-700/80 hover:bg-red-500 flex items-center justify-center transition-colors backdrop-blur-sm"
            title="Kicken"
          >
            <X size={14} weight="bold" className="text-white" />
          </button>
        </div>
      )}

      {leftPanels && leftPanels.length > 0 && activePanel != null && (
        <LeftPanelOverlay panels={leftPanels} activePanel={activePanel} />
      )}

      {hasStrip && (
        <div className="absolute right-3 top-3 bottom-3 w-44 z-10 flex flex-col gap-2 overflow-y-auto">
          {/* Waiting room admit cards */}
          {isHost && waitingUsers.map((user) => (
            <div
              key={user.id}
              className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl flex-shrink-0"
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
                  onClick={() => onAdmit(user.id)}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-brand-500 hover:bg-brand-400 text-white transition-colors flex items-center justify-center gap-1"
                >
                  <Check size={10} weight="bold" /> Zulassen
                </button>
                <button
                  onClick={() => onDeny(user.id)}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-vista-elevated hover:bg-vista-border text-white/80 transition-colors flex items-center justify-center gap-1"
                >
                  <X size={10} weight="bold" /> Ablehnen
                </button>
              </div>
            </div>
          ))}

          {/* Screen share tile — only shown when a participant is in spotlight */}
          {screenSharer && !showScreenShareInSpotlight && (
            <ScreenShareThumbnail
              sharer={screenSharer}
              isLocal={screenSharer.id === localUserId}
              isHost={isHost}
              onStopShare={() => onScreenShareToggle(screenSharer.id, true)}
              onSelect={() => setSpotlightId(null)}
            />
          )}

          {/* Camera thumbnails */}
          {stripUsers.map((user) => (
            <Thumbnail
              key={user.id}
              user={user}
              isLocal={user.id === localUserId}
              isSpotlight={!showScreenShareInSpotlight && user.id === effectiveSpotlightId}
              isHost={isHost}
              raisedHand={raisedHands.has(user.id)}
              onClick={() => setSpotlightId(user.id)}
              onMuteToggle={(muted) => onMuteToggle(user.id, muted)}
              onCameraToggle={(cameraOff) => onCameraToggle(user.id, cameraOff)}
              onKick={() => onKick(user.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
