import { SignOut } from "@phosphor-icons/react";

type Props = {
  displayName: string;
  meetingName?: string;
  onLeave: () => void;
};

export function WaitingScreen({ displayName, meetingName, onLeave }: Props) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-vista-bg gap-6 px-4">
      <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center text-2xl font-bold text-white select-none ring-4 ring-brand-500/20">
        {displayName[0]?.toUpperCase() ?? "?"}
      </div>

      <div className="text-center space-y-2">
        {meetingName && (
          <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider">{meetingName}</p>
        )}
        <h2 className="text-xl font-semibold text-white">Warte auf Zulassung…</h2>
        <p className="text-sm text-vista-muted max-w-xs">
          Der Host muss dich erst zulassen, bevor du dem Meeting beitreten kannst.
        </p>
      </div>

      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-brand-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>

      <button
        onClick={onLeave}
        className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-vista-elevated hover:bg-vista-border text-white/80 hover:text-white transition-all"
      >
        <SignOut size={15} weight="fill" />
        Abbrechen
      </button>
    </div>
  );
}
