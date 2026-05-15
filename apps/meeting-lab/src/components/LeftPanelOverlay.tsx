import type React from "react";

export type LeftPanelDef = {
  id: string;
  label: string;
  icon: React.ReactNode;
  content: React.ReactNode;
};

type Props = {
  panels: LeftPanelDef[];
  activePanel: string;
};

export function LeftPanelOverlay({ panels, activePanel }: Props) {
  const panel = panels.find((p) => p.id === activePanel);
  if (!panel) return null;

  return (
    <div className="absolute left-3 top-3 bottom-3 w-72 z-10 flex flex-col bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0">
        <span className="text-vista-muted">{panel.icon}</span>
        <span className="text-sm font-semibold text-white">{panel.label}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {panel.content}
      </div>
    </div>
  );
}
