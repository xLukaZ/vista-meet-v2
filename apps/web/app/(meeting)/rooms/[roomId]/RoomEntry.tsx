"use client";

import { useRoomStore } from "./useRoomStore";
import { MeetingCanvas } from "./MeetingCanvas";

// ─── Pre-join screen ──────────────────────────────────────────────────────────

function PreJoin({ roomId }: { roomId: string }) {
  const { displayName, isHost, status, errorMsg, setDisplayName, setIsHost, joinRoom } = useRoomStore();

  const join = () => void joinRoom(roomId);

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-1">Vista Meet</h1>
          <p className="text-sm text-white/40 font-mono">{roomId}</p>
        </div>

        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
              Dein Name
            </label>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 outline-none focus:border-brand-500 transition-colors"
              placeholder="Name eingeben…"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
              autoFocus
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={isHost}
                onChange={(e) => setIsHost(e.target.checked)}
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${isHost ? "bg-brand-500" : "bg-white/10"}`} />
              <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${isHost ? "translate-x-4" : ""}`} />
            </div>
            <span className="text-sm text-white/60">Als Host beitreten</span>
          </label>

          {errorMsg && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3">
              {errorMsg}
            </p>
          )}

          <button
            onClick={join}
            disabled={!displayName.trim() || status === "joining"}
            className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors"
          >
            {status === "joining" ? "Verbinde…" : "Beitreten"}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-white/20">
          Teile diese URL um andere einzuladen
        </p>
      </div>
    </main>
  );
}

// ─── Error screen ─────────────────────────────────────────────────────────────

function ErrorScreen({ msg }: { msg: string }) {
  const { reset } = useRoomStore();
  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-red-400 font-semibold">Fehler beim Verbinden</p>
        <p className="text-white/40 text-sm max-w-xs">{msg}</p>
        <button onClick={reset} className="px-6 py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20 transition-colors">
          Erneut versuchen
        </button>
      </div>
    </main>
  );
}

// ─── Ended screen ─────────────────────────────────────────────────────────────

function EndedScreen() {
  const { reset } = useRoomStore();
  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-5xl">👋</div>
        <p className="text-white font-semibold">Meeting beendet</p>
        <p className="text-white/40 text-sm">Der Host hat das Meeting geschlossen.</p>
        <button onClick={reset} className="px-6 py-2 rounded-xl bg-brand-500 text-white text-sm hover:bg-brand-600 transition-colors">
          Zurück
        </button>
      </div>
    </main>
  );
}

// ─── Root entry ───────────────────────────────────────────────────────────────

export function RoomEntry({ roomId }: { roomId: string }) {
  const { status, errorMsg } = useRoomStore();

  if (status === "ended") return <EndedScreen />;
  if (status === "error" && errorMsg) return <ErrorScreen msg={errorMsg} />;
  if (status !== "connected") return <PreJoin roomId={roomId} />;
  return <MeetingCanvas roomId={roomId} />;
}
