import type React from "react";

export type SettingsSection = {
  id: string;
  title: string;
  content: React.ReactNode;
};

type Props = {
  sections: SettingsSection[];
};

export function SettingsPanel({ sections }: Props) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-4">
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-vista-muted uppercase tracking-wider">
            {section.title}
          </p>
          <div className="bg-vista-elevated rounded-xl p-3 flex flex-col gap-2">
            {section.content}
          </div>
        </div>
      ))}
    </div>
  );
}

// Reusable toggle row for settings
export function SettingsToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!value)}
        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${value ? "bg-brand-500" : "bg-vista-border"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : ""}`}
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-white/90">{label}</p>
        {description && <p className="text-xs text-vista-muted mt-0.5">{description}</p>}
      </div>
    </label>
  );
}
