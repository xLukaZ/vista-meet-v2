import type { ConnectionState } from "@meet-vista/meeting-core";
import { ArrowClockwise } from "@phosphor-icons/react";

type Props = {
  state: ConnectionState;
  onRetry?: () => void;
};

export function ConnectionBanner({ state, onRetry }: Props) {
  if (state === "connected" || state === "disconnected") return null;

  const config: Record<string, { bg: string; text: string; showRetry?: boolean }> = {
    connecting: { bg: "bg-brand-600/90", text: "Verbindung wird hergestellt…" },
    reconnecting: { bg: "bg-yellow-700/90", text: "Verbindung unterbrochen – verbinde neu…" },
    failed: { bg: "bg-red-700/90", text: "Verbindung fehlgeschlagen.", showRetry: true },
  };

  const banner = config[state];
  if (!banner) return null;

  return (
    <div className={`${banner.bg} backdrop-blur text-white text-sm px-4 py-2 flex items-center justify-between shrink-0`}>
      <span>{banner.text}</span>
      {banner.showRetry && onRetry && (
        <button onClick={onRetry} className="flex items-center gap-1.5 text-white/80 hover:text-white underline hover:no-underline font-medium">
          <ArrowClockwise size={14} weight="bold" />
          Retry
        </button>
      )}
    </div>
  );
}
