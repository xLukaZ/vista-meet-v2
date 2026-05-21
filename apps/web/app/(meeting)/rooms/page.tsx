"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function randomRoomId() {
  return Math.random().toString(36).slice(2, 9).toUpperCase();
}

export default function RoomsPage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState(randomRoomId());

  const enter = () => {
    if (roomId.trim()) router.push(`/rooms/${roomId.trim().toUpperCase()}`);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Vista Meet</h1>
          <p className="text-white/40 text-sm">3D Meeting Platform</p>
        </div>

        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
              Raum-ID
            </label>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono placeholder-white/20 outline-none focus:border-brand-500 transition-colors uppercase"
              placeholder="ROOM-ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && enter()}
            />
          </div>

          <button
            onClick={enter}
            disabled={!roomId.trim()}
            className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white font-semibold transition-colors"
          >
            Raum betreten
          </button>

          <button
            onClick={() => setRoomId(randomRoomId())}
            className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm transition-colors"
          >
            Neue Raum-ID generieren
          </button>
        </div>
      </div>
    </main>
  );
}
