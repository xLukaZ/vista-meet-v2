import { useEffect, useRef, useState, useCallback } from "react";
import { MatterportRuntimeImpl } from "@meet-vista/matterport-runtime";
import type { CameraPose, MatterportObjectLayer } from "@meet-vista/matterport-runtime";
import { createAvatarObject } from "@meet-vista/matterport-objects";
import { usePresence } from "./hooks/usePresence.js";

const SDK_KEY = import.meta.env["VITE_MATTERPORT_SDK_KEY"] as string;
const DEFAULT_MODEL = (import.meta.env["VITE_MATTERPORT_MODEL_ID"] as string) ?? "SxQL3iGyoDo";
const BUNDLE_URL = import.meta.env["VITE_MATTERPORT_BUNDLE_URL"] as string | undefined;

// ─── Preset positions for the demo model ─────────────────────────────────────

const PRESETS: { label: string; pose: CameraPose }[] = [
  {
    label: "Eingang",
    pose: { position: { x: 0, y: 1.5, z: 0 }, rotation: { x: -5, y: 180, z: 0, w: 1 }, fov: 90 },
  },
  {
    label: "Wohnzimmer",
    pose: { position: { x: -2, y: 1.5, z: -3 }, rotation: { x: -5, y: 90, z: 0, w: 1 }, fov: 90 },
  },
  {
    label: "Küche",
    pose: { position: { x: 3, y: 1.5, z: -3 }, rotation: { x: -5, y: 270, z: 0, w: 1 }, fov: 90 },
  },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    background: "#0a0a0a",
    color: "#f1f5f9",
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 16px",
    background: "#141414",
    borderBottom: "1px solid #262626",
    flexShrink: 0,
  },
  title: { fontWeight: 700, fontSize: "14px", color: "#fff" },
  badge: (color: string) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "2px 8px",
    borderRadius: "9999px",
    fontSize: "11px",
    fontWeight: 600,
    background: color === "green" ? "#14532d" : color === "red" ? "#7f1d1d" : "#1c1c1c",
    color: color === "green" ? "#4ade80" : color === "red" ? "#f87171" : "#9ca3af",
    border: `1px solid ${color === "green" ? "#166534" : color === "red" ? "#991b1b" : "#2a2a2a"}`,
  }),
  dot: (color: string) => ({
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: color === "green" ? "#4ade80" : color === "red" ? "#f87171" : "#6b7280",
  }),
  body: { flex: 1, display: "flex", overflow: "hidden" },
  sidebar: {
    width: "240px",
    background: "#111",
    borderRight: "1px solid #1f1f1f",
    display: "flex",
    flexDirection: "column" as const,
    gap: 0,
    flexShrink: 0,
    overflow: "auto",
  },
  section: {
    padding: "12px 14px",
    borderBottom: "1px solid #1f1f1f",
  },
  sectionTitle: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "#555",
    textTransform: "uppercase" as const,
    marginBottom: "8px",
  },
  input: {
    width: "100%",
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "6px",
    padding: "6px 8px",
    color: "#fff",
    fontSize: "12px",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  btn: (variant: "primary" | "default") => ({
    width: "100%",
    padding: "7px 10px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "12px",
    background: variant === "primary" ? "#AD38B5" : "#1e1e1e",
    color: "#fff",
    transition: "opacity 0.15s",
  }),
  presetBtn: {
    width: "100%",
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid #2a2a2a",
    background: "#1a1a1a",
    color: "#ccc",
    fontSize: "12px",
    cursor: "pointer",
    textAlign: "left" as const,
    marginBottom: "4px",
  },
  poseRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
    fontSize: "11px",
  },
  poseLabel: { color: "#666" },
  poseValue: { color: "#e2e8f0", fontFamily: "monospace", fontSize: "11px" },
  viewer: { flex: 1, position: "relative" as const, background: "#000" },
  loadingOverlay: {
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0a0a",
    gap: "12px",
    zIndex: 10,
  },
  spinner: {
    width: "28px",
    height: "28px",
    border: "2px solid #2a2a2a",
    borderTopColor: "#AD38B5",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  errorOverlay: {
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0a0a",
    gap: "10px",
    padding: "24px",
    zIndex: 10,
  },
};

type Status = "idle" | "loading" | "connected" | "error";

function fmt(n: number) { return n.toFixed(2); }

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<MatterportRuntimeImpl | null>(null);

  const [modelId, setModelId] = useState(DEFAULT_MODEL);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pose, setPose] = useState<CameraPose | null>(null);

  // ─── Object layer (set after SDK connects) ────────────────────────────────
  const [objectLayer, setObjectLayer] = useState<MatterportObjectLayer | null>(null);

  // ─── Manual avatar placement (Sprint 4) ───────────────────────────────────
  const [avatarName, setAvatarName] = useState("Test-Avatar");
  const [placedAvatars, setPlacedAvatars] = useState<{ id: string; name: string }[]>([]);

  // ─── Presence simulation (Sprint 5) ───────────────────────────────────────
  const [simName, setSimName] = useState("Remote-User");
  const [simCount, setSimCount] = useState(0);
  const simIdsRef = useRef<string[]>([]);

  const mount = useCallback(async () => {
    if (!containerRef.current) return;

    // Dispose previous instance
    if (runtimeRef.current) {
      await runtimeRef.current.dispose();
      runtimeRef.current = null;
      // Clear container
      containerRef.current.innerHTML = "";
    }

    setStatus("loading");
    setError(null);
    setPose(null);
    setObjectLayer(null);
    setPlacedAvatars([]);
    simIdsRef.current = [];
    setSimCount(0);

    const runtime = new MatterportRuntimeImpl();
    runtimeRef.current = runtime;

    runtime.onCameraChanged(setPose);

    try {
      await runtime.mount(containerRef.current, {
        modelId: modelId.trim() || DEFAULT_MODEL,
        sdkKey: SDK_KEY,
        ...(BUNDLE_URL ? { bundleUrl: BUNDLE_URL } : {}),
        options: { autoplay: true },
      });
      setObjectLayer(runtime.getObjectLayer());
      setStatus("connected");
    } catch (err) {
      setStatus("error");
      setError((err as Error).message ?? "Unbekannter Fehler");
    }
  }, [modelId]);

  const teleportTo = useCallback(async (preset: CameraPose) => {
    if (!runtimeRef.current?.isReady()) return;
    try {
      await runtimeRef.current.teleport(preset);
    } catch { /* ignore */ }
  }, []);

  const placeAvatarHere = useCallback(async () => {
    const runtime = runtimeRef.current;
    if (!runtime?.isReady() || !pose) return;
    const layer: MatterportObjectLayer = runtime.getObjectLayer();
    const obj = createAvatarObject({
      userId: `user_${Date.now()}`,
      displayName: avatarName || "Avatar",
      transform: {
        position: { ...pose.position },
        rotation: { x: 0, y: pose.rotation.y, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });
    try {
      const id = await layer.addObject(obj);
      setPlacedAvatars((prev) => [...prev, { id, name: avatarName || "Avatar" }]);
    } catch { /* ignore */ }
  }, [pose, avatarName]);

  const removeAvatar = useCallback(async (id: string) => {
    const runtime = runtimeRef.current;
    if (!runtime?.isReady()) return;
    try {
      await runtime.getObjectLayer().removeObject(id);
      setPlacedAvatars((prev) => prev.filter((a) => a.id !== id));
    } catch { /* ignore */ }
  }, []);

  const clearAvatars = useCallback(async () => {
    const runtime = runtimeRef.current;
    if (!runtime?.isReady()) return;
    try {
      await runtime.getObjectLayer().clear();
      setPlacedAvatars([]);
    } catch { /* ignore */ }
  }, []);

  // ── Presence hook (Sprint 5) ───────────────────────────────────────────────
  const { simulateRemote, removeSimulated, clearSimulated } = usePresence(
    "local-user",
    objectLayer,
    pose,
  );

  const addSimulatedParticipant = useCallback(() => {
    if (!pose) return;
    const uid = `sim_${Date.now()}`;
    simIdsRef.current.push(uid);
    setSimCount((c) => c + 1);
    // Place the simulated user slightly offset from current camera position
    const offset = simIdsRef.current.length * 0.8;
    simulateRemote({
      userId: uid,
      roomId: "matterport-lab",
      position: { x: pose.position.x + offset, y: pose.position.y, z: pose.position.z },
      rotation: { x: 0, y: pose.rotation.y, z: 0, w: 1 },
      animation: "idle",
      speaking: false,
      muted: true,
      timestamp: Date.now(),
    });
  }, [pose, simulateRemote]);

  const clearAllSimulated = useCallback(() => {
    simIdsRef.current.forEach((uid) => removeSimulated(uid));
    simIdsRef.current = [];
    setSimCount(0);
  }, [removeSimulated]);

  // Auto-mount on first render
  useEffect(() => {
    void mount();
    return () => { void runtimeRef.current?.dispose(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusColor = status === "connected" ? "green" : status === "error" ? "red" : "neutral";
  const statusLabel = status === "connected" ? "Verbunden" : status === "loading" ? "Lädt…" : status === "error" ? "Fehler" : "Bereit";

  return (
    <div style={S.root}>
      {/* CSS for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <header style={S.header}>
        <span style={S.title}>Matterport Lab</span>
        <span style={S.badge(statusColor)}>
          <span style={S.dot(statusColor)} />
          {statusLabel}
        </span>
        {pose && (
          <span style={{ marginLeft: "auto", color: "#555", fontSize: "11px", fontFamily: "monospace" }}>
            pos ({fmt(pose.position.x)}, {fmt(pose.position.y)}, {fmt(pose.position.z)})
            &nbsp;·&nbsp;fov {fmt(pose.fov)}°
          </span>
        )}
      </header>

      {/* Body */}
      <div style={S.body}>
        {/* Sidebar */}
        <aside style={S.sidebar}>
          {/* Model */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Modell</div>
            <input
              style={{ ...S.input, marginBottom: "8px" }}
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="Model-ID"
              spellCheck={false}
            />
            <button style={S.btn("primary")} onClick={() => void mount()}>
              {status === "loading" ? "Lädt…" : "Laden"}
            </button>
          </div>

          {/* Presets */}
          {status === "connected" && (
            <div style={S.section}>
              <div style={S.sectionTitle}>Positionen</div>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  style={S.presetBtn}
                  onClick={() => void teleportTo(p.pose)}
                >
                  → {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Avatar placement — manual (Sprint 4) */}
          {status === "connected" && (
            <div style={S.section}>
              <div style={S.sectionTitle}>Avatare platzieren</div>
              <input
                style={{ ...S.input, marginBottom: "6px" }}
                value={avatarName}
                onChange={(e) => setAvatarName(e.target.value)}
                placeholder="Name"
                spellCheck={false}
              />
              <button
                style={{ ...S.btn("primary"), marginBottom: "6px" }}
                onClick={() => void placeAvatarHere()}
                disabled={!pose}
              >
                + Hier platzieren
              </button>
              {placedAvatars.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "#AD38B5", fontSize: "11px" }}>● {a.name}</span>
                  <button style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "12px", padding: "0 4px" }}
                    onClick={() => void removeAvatar(a.id)}>✕</button>
                </div>
              ))}
              {placedAvatars.length > 0 && (
                <button style={{ ...S.btn("default"), marginTop: "4px", fontSize: "11px" }} onClick={() => void clearAvatars()}>
                  Alle entfernen
                </button>
              )}
            </div>
          )}

          {/* Presence simulation (Sprint 5) */}
          {status === "connected" && (
            <div style={S.section}>
              <div style={S.sectionTitle}>Presence (Sprint 5)</div>
              <span style={{ color: "#555", fontSize: "11px", display: "block", marginBottom: "8px" }}>
                Simuliert Remote-Teilnehmer via LocalPresenceTransport
              </span>
              <button
                style={{ ...S.btn("primary"), marginBottom: "6px" }}
                onClick={addSimulatedParticipant}
                disabled={!pose}
              >
                + Remote-Teilnehmer
              </button>
              {simCount > 0 && (
                <>
                  <div style={{ ...S.poseRow, marginTop: "4px" }}>
                    <span style={S.poseLabel}>Simuliert</span>
                    <span style={S.poseValue}>{simCount} Teilnehmer</span>
                  </div>
                  <button style={{ ...S.btn("default"), marginTop: "4px", fontSize: "11px" }} onClick={clearAllSimulated}>
                    Alle entfernen
                  </button>
                </>
              )}
            </div>
          )}

          {/* Camera Pose */}
          {pose && (
            <div style={S.section}>
              <div style={S.sectionTitle}>Kamera-Pose</div>
              <div style={S.poseRow}>
                <span style={S.poseLabel}>pos.x</span>
                <span style={S.poseValue}>{fmt(pose.position.x)}</span>
              </div>
              <div style={S.poseRow}>
                <span style={S.poseLabel}>pos.y</span>
                <span style={S.poseValue}>{fmt(pose.position.y)}</span>
              </div>
              <div style={S.poseRow}>
                <span style={S.poseLabel}>pos.z</span>
                <span style={S.poseValue}>{fmt(pose.position.z)}</span>
              </div>
              <div style={{ height: "6px" }} />
              <div style={S.poseRow}>
                <span style={S.poseLabel}>rot.x (pitch)</span>
                <span style={S.poseValue}>{fmt(pose.rotation.x)}°</span>
              </div>
              <div style={S.poseRow}>
                <span style={S.poseLabel}>rot.y (yaw)</span>
                <span style={S.poseValue}>{fmt(pose.rotation.y)}°</span>
              </div>
              <div style={S.poseRow}>
                <span style={S.poseLabel}>rot.z (roll)</span>
                <span style={S.poseValue}>{fmt(pose.rotation.z)}°</span>
              </div>
              <div style={{ height: "6px" }} />
              <div style={S.poseRow}>
                <span style={S.poseLabel}>fov</span>
                <span style={S.poseValue}>{fmt(pose.fov)}°</span>
              </div>
            </div>
          )}
        </aside>

        {/* Viewer */}
        <div style={S.viewer}>
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

          {status === "loading" && (
            <div style={S.loadingOverlay}>
              <div style={S.spinner} />
              <span style={{ color: "#555", fontSize: "12px" }}>Matterport SDK verbindet…</span>
            </div>
          )}

          {status === "error" && (
            <div style={S.errorOverlay}>
              <span style={{ color: "#f87171", fontWeight: 700 }}>Fehler beim Laden</span>
              <span style={{ color: "#666", textAlign: "center", maxWidth: "320px" }}>{error}</span>
              <button style={{ ...S.btn("primary"), width: "auto", padding: "7px 20px" }} onClick={() => void mount()}>
                Erneut versuchen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
