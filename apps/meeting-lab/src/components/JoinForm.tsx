import { useState, useEffect } from "react";
import { Users, ArrowRight, PlusCircle, SignIn } from "@phosphor-icons/react";

const API_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:3001";

type Props = {
  onHost: (meetingName: string, displayName: string, requireApproval: boolean) => Promise<void>;
  onJoin: (meetingToken: string, displayName: string) => Promise<void>;
};

type Mode = "create" | "join";

type RoomInfo = {
  exists: boolean;
  meetingName: string;
  requireApproval: boolean;
  closed: boolean;
};

export function JoinForm({ onHost, onJoin }: Props) {
  const prefillToken = new URLSearchParams(window.location.search).get("room") ?? "";
  const initialMode: Mode = prefillToken ? "join" : "create";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [displayName, setDisplayName] = useState("");
  const [meetingName, setMeetingName] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  const [meetingToken, setMeetingToken] = useState(prefillToken);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass =
    "w-full px-4 py-3 border border-vista-border rounded-xl text-white placeholder-vista-muted " +
    "focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/50 transition-all text-sm bg-[#141414]";

  // Fetch room info when a token is typed in join mode
  useEffect(() => {
    if (mode !== "join" || meetingToken.length < 4) {
      setRoomInfo(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/dev/room-info/${encodeURIComponent(meetingToken)}`);
        if (res.ok) setRoomInfo((await res.json()) as RoomInfo);
        else setRoomInfo(null);
      } catch {
        setRoomInfo(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [meetingToken, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "create") {
        await onHost(meetingName.trim(), displayName.trim(), requireApproval);
      } else {
        await onJoin(meetingToken.trim(), displayName.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verbindung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-vista-bg">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-500/30 mb-4">
            <Users size={22} weight="fill" className="text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Vista Meet</h1>
          <p className="text-vista-muted text-sm mt-1">Meeting Lab</p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 bg-vista-elevated rounded-xl p-1 mb-4">
          <button
            type="button"
            onClick={() => { setMode("create"); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              mode === "create"
                ? "bg-brand-500 text-white shadow"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <PlusCircle size={15} weight="fill" />
            Meeting erstellen
          </button>
          <button
            type="button"
            onClick={() => { setMode("join"); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              mode === "join"
                ? "bg-brand-500 text-white shadow"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <SignIn size={15} weight="fill" />
            Beitreten
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-vista-raised border border-vista-border rounded-2xl p-6 space-y-4 shadow-2xl">
          {mode === "create" ? (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-vista-muted uppercase tracking-wider">
                  Meeting-Name
                </label>
                <input
                  type="text"
                  value={meetingName}
                  onChange={(e) => setMeetingName(e.target.value)}
                  placeholder="z.B. Team Weekly"
                  required
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-vista-muted uppercase tracking-wider">
                  Dein Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Dein Name"
                  required
                  className={inputClass}
                />
              </div>

              {/* Waiting room toggle */}
              <div className="bg-vista-surface border border-vista-border rounded-xl p-4">
                <p className="text-[11px] font-semibold text-vista-muted uppercase tracking-wider mb-3">
                  Raum-Einstellungen
                </p>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setRequireApproval((v) => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${requireApproval ? "bg-brand-500" : "bg-vista-elevated"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${requireApproval ? "translate-x-5" : ""}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white/80">Warteraum aktivieren</p>
                    <p className="text-xs text-vista-muted mt-0.5">Gäste müssen vom Host zugelassen werden</p>
                  </div>
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-vista-muted uppercase tracking-wider">
                  Meeting-Token
                </label>
                <input
                  type="text"
                  value={meetingToken}
                  onChange={(e) => setMeetingToken(e.target.value)}
                  placeholder="Token vom Host einfügen"
                  required
                  className={inputClass}
                />
              </div>

              {/* Room info preview */}
              {roomInfo && roomInfo.exists && (
                <div className="bg-vista-surface border border-vista-border rounded-xl px-4 py-3 space-y-1">
                  <p className="text-sm font-semibold text-white truncate">{roomInfo.meetingName || "Meeting"}</p>
                  <div className="flex items-center gap-2">
                    {roomInfo.closed ? (
                      <span className="text-xs text-red-400">Raum geschlossen — kein Beitritt möglich</span>
                    ) : roomInfo.requireApproval ? (
                      <span className="text-xs text-yellow-400">Warteraum aktiv — Host muss dich zulassen</span>
                    ) : (
                      <span className="text-xs text-green-400">Beitritt direkt möglich</span>
                    )}
                  </div>
                </div>
              )}
              {roomInfo && !roomInfo.exists && meetingToken.length > 4 && (
                <p className="text-xs text-red-400 px-1">Token nicht gefunden.</p>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-vista-muted uppercase tracking-wider">
                  Dein Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Dein Name"
                  required
                  className={inputClass}
                />
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (mode === "join" && !!roomInfo && roomInfo.closed)}
            className="w-full py-3 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
          >
            {loading ? "Verbinde…" : mode === "create" ? (
              <>Meeting starten <ArrowRight size={16} weight="bold" /></>
            ) : (
              <>Beitreten <ArrowRight size={16} weight="bold" /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
