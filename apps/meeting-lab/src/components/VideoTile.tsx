import { useRef } from "react";
import type { MeetingUser, ConnectionQuality } from "@meet-vista/meeting-core";
import { MicrophoneSlash, Star, Hand, WifiHigh, WifiMedium, WifiLow, WifiSlash } from "@phosphor-icons/react";
import { useVideoTrack } from "../hooks/useVideoTrack.js";

type Props = {
  user: MeetingUser;
  isLocal?: boolean;
  compact?: boolean;
  handRaised?: boolean;
};

function QualityIcon({ quality, size }: { quality: ConnectionQuality; size: number }) {
  switch (quality) {
    case "excellent": return <WifiHigh size={size} weight="fill" className="text-green-400" />;
    case "good":      return <WifiMedium size={size} weight="fill" className="text-yellow-400" />;
    case "poor":      return <WifiLow size={size} weight="fill" className="text-orange-400" />;
    case "lost":      return <WifiSlash size={size} weight="fill" className="text-red-400" />;
    default:          return null;
  }
}

export function VideoTile({ user, isLocal, compact, handRaised }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useVideoTrack(user.track, videoRef);

  const showVideo = !user.isCameraOff && user.track;
  const iconSize = compact ? 9 : 11;

  return (
    <div
      className={`relative bg-vista-surface overflow-hidden flex items-center justify-center transition-all w-full h-full ${
        user.isSpeaking ? "ring-2 ring-brand-500" : "ring-1 ring-vista-border"
      } ${compact ? "rounded-xl" : "rounded-2xl"}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${showVideo ? "block" : "hidden"}`}
      />

      {!showVideo && (
        <div className="flex flex-col items-center gap-2">
          <div className={`rounded-full bg-brand-500 flex items-center justify-center font-bold text-white select-none ${
            compact ? "w-9 h-9 text-sm" : "w-16 h-16 text-2xl"
          }`}>
            {user.displayName[0]?.toUpperCase() ?? "?"}
          </div>
          {!compact && (
            <span className="text-sm text-white/70 font-medium">
              {user.displayName}{isLocal ? " (du)" : ""}
            </span>
          )}
        </div>
      )}

      {/* Bottom label bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-2 py-1.5 bg-gradient-to-t from-black/75 to-transparent pointer-events-none">
        <span className={`text-white font-medium truncate flex-1 ${compact ? "text-[10px]" : "text-xs"}`}>
          {user.displayName}{isLocal ? " (du)" : ""}
        </span>
        {user.role === "host" && (
          <Star size={iconSize} weight="fill" className="text-brand-400 shrink-0" />
        )}
        {user.isMuted && (
          <MicrophoneSlash size={iconSize} weight="fill" className="text-red-400 shrink-0" />
        )}
        <QualityIcon quality={user.connectionQuality} size={iconSize} />
      </div>

      {/* Raised hand badge */}
      {handRaised && (
        <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-yellow-500/90 flex items-center justify-center shadow">
          <Hand size={12} weight="fill" className="text-white" />
        </div>
      )}

      {/* Speaking pulse dot */}
      {user.isSpeaking && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-400 animate-pulse pointer-events-none" />
      )}

    </div>
  );
}
