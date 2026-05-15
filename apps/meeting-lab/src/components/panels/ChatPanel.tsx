import { useEffect, useRef, useState } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";

export type ChatMessage = {
  id: string;
  from: string;
  text: string;
  ts: number;
};

type Props = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
};

export function ChatPanel({ messages, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <>
      {/* Message list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-2">
        {messages.length === 0 && (
          <p className="text-vista-muted text-xs text-center mt-4">Noch keine Nachrichten</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-semibold text-brand-400 truncate max-w-[120px]">
                {msg.from}
              </span>
              <span className="text-[10px] text-vista-muted shrink-0">
                {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="text-sm text-white/90 leading-snug break-words">{msg.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-vista-border shrink-0 flex gap-2 items-center">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Nachricht…"
          className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-vista-muted focus:outline-none focus:ring-2 focus:ring-brand-500/60 transition-all bg-[#141414] border border-vista-border"
        />
        <button
          onClick={submit}
          disabled={!draft.trim()}
          className="w-8 h-8 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
          title="Senden"
        >
          <PaperPlaneTilt size={14} weight="fill" className="text-white" />
        </button>
      </div>
    </>
  );
}
