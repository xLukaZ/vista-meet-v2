# Vista Meet — Architekturplan

> Vollständiger technischer Plan für den Aufbau einer Matterport-basierten 3D-Meeting-Plattform.

---

## Inhaltsverzeichnis

1. [Versionsstrategie](#1-versionsstrategie)
2. [Tech Stack](#2-tech-stack)
3. [Monorepo-Struktur](#3-monorepo-struktur)
4. [Interfaces & Types](#4-interfaces--types)
5. [Backend API](#5-backend-api)
6. [Security](#6-security)

---

## 1. Versionsstrategie

**Next.js 14 (nicht 15) + React 18 (nicht 19)**

Sicherheit kommt nicht von der höchsten Versionsnummer. Sie kommt von gepatchten Dependencies, stabilem Auth-Design und klaren API-Grenzen.

| Version | Status | Begründung |
|---|---|---|
| Next.js 14 | ✅ Gewählt | App Router ausgereift, Security-Patches schnell, große Community |
| Next.js 15 | ⏳ Später | Noch relativ neu — Upgrade geplant nach Milestone 3 |
| React 18 | ✅ Gewählt | Concurrent Mode stabil, keine RC-APIs im kritischen Meeting-Pfad |
| React 19 | ⏳ Später | Nach stabiler Adoption im Ecosystem |

**Tatsächliche Sicherheitsmaßnahmen** (unabhängig von der Version):

- **Dependency Scanning:** Snyk / GitHub Dependabot auf allen PRs. `pnpm audit --audit-level=high` in CI als Pflicht-Check — Pipeline bricht bei HIGH.
- **Content Security Policy:** Strikte CSP-Header via `next.config.js`. Keine inline Scripts. Matterport-Domain explizit whitelistet.
- **JWT Short-TTL:** Room-Tokens 1h TTL. Refresh-Token 7 Tage, rotierend. Kein Token im `localStorage` — nur `httpOnly` Cookies.
- **Rate Limiting:** `POST /rooms`: max 10/min per IP. Token-Endpoint: max 30/min.

---

## 2. Tech Stack

Jede Technologie hat eine klare Rolle. Kein Stack-Bloat. Kein Over-Engineering.

### Frontend

| Technologie | Version | Begründung |
|---|---|---|
| Next.js | `^14.2.x` | App Router für Layouts/Middleware. RSC für statische Seiten. Client Components nur für Meeting-Canvas. |
| React | `^18.3.x` | Concurrent Mode, Suspense für Loading States, `useTransition` für nicht-blockierende Updates. |
| Tailwind CSS | `^3.4.x` | Utility-first, kein CSS-in-JS Overhead im Meeting-Pfad. Design Tokens als CSS Variables. |
| Zustand | `^4.5.x` | Minimal, kein Boilerplate. Für Meeting-State (participants, media state). |
| LiveKit SDK | `@livekit/client ^2.x` | WebRTC-Abstraktion. Handles Reconnect, Simulcast, Data Channels. |
| Matterport SDK | selbst gehostet | JS-Bundle auf eigenem CDN. Direkter Zugriff auf Scene Graph API. |

### Backend

| Technologie | Version | Begründung |
|---|---|---|
| Node.js | `^20.x LTS` | LTS = aktive Security Patches. Native fetch. |
| Hono | `^4.x` | Typesafe, edge-ready, minimal. Middleware-Pattern für Auth/RateLimit. |
| PostgreSQL | 16 | Row-Level Security für Room-Isolation. JSONB für flexible Metadata. Phase 1: SQLite lokal. |
| Drizzle ORM | `^0.30.x` | Typesafe, Schema-as-Code. Migrations sind plain SQL. |
| JWT + httpOnly Cookies | `jose ^5.x` | Kein localStorage. Kurzlebige Access Tokens (1h), rotierende Refresh Tokens (7d). |

### Infrastruktur & Tooling

| Technologie | Version | Begründung |
|---|---|---|
| Turborepo | `^2.x` | Build-Caching spart 80% CI-Zeit. |
| pnpm | `^9.x` | Workspaces für saubere Package-Links. Strikte Hoisting-Regeln. |
| TypeScript | `^5.4.x` | Strict mode. `noUncheckedIndexedAccess`. Kein `any` ohne Kommentar. |
| Vitest | `^1.x` | Unit/Integration Tests für Services und Adapter. |
| Playwright | `^1.4x` | E2E-Meeting-Tests mit zwei Browser-Instanzen. |
| Sentry + Pino | `sentry ^8.x` / `pino ^9.x` | Sentry für Frontend-Exceptions. Pino für strukturiertes Backend-Logging. Ab Sprint 2 Pflicht. |
| LiveKit Server | self-hosted / Cloud | Phase 1: LiveKit Cloud (free tier). Ab Milestone 2: Evaluierung self-hosted via Docker. |
| Vercel + Cloudflare | — | Next.js auf Vercel. SDK-Bundle auf Cloudflare R2 + CDN. |

---

## 3. Monorepo-Struktur

### Goldene Regel

> React-Komponenten enthalten **keine Business-Logik**. Sie importieren nur aus `hooks/` und rufen Services auf. Services importieren aus den Packages. Packages importieren nur aus anderen Packages, nie aus Apps. Diese Richtung ist unumkehrbar.

### Verzeichnisstruktur

```
vista-meet/
├── apps/
│   ├── web/                        # Next.js 14 — finale Nutzer-App
│   │   ├── app/                    # App Router
│   │   │   ├── (auth)/             # Login, Register
│   │   │   ├── (meeting)/          # Meeting-Seiten
│   │   │   │   ├── rooms/
│   │   │   │   │   ├── [roomId]/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── page.tsx
│   │   │   └── api/                # Next.js API Routes (thin proxy)
│   │   ├── components/             # Nur UI — keine Business-Logik
│   │   │   ├── meeting/
│   │   │   ├── matterport/
│   │   │   └── ui/
│   │   ├── hooks/                  # React Hooks — rufen nur Services auf
│   │   ├── services/               # Client-side Services (instanziiert Packages)
│   │   └── store/                  # Zustand Stores
│   │
│   ├── api/                        # Hono Backend
│   │   └── src/
│   │       ├── routes/             # rooms, tokens, sessions
│   │       ├── middleware/         # auth, rateLimit, logging
│   │       ├── db/                 # Drizzle schema + migrations
│   │       └── services/           # RoomService, TokenService
│   │
│   ├── meeting-lab/                # Sprint 1 — isolierter Meeting-Test
│   ├── matterport-lab/             # Sprint 3 — isolierter MP-Test
│   └── embed-demo/                 # Sprint 7 — externer Embed-Test
│
├── packages/
│   ├── core/                       # Zentrale Types, Errors, Utils
│   │   ├── types.ts
│   │   ├── errors.ts
│   │   └── utils.ts
│   │
│   ├── meeting-core/               # Meeting Interface — keine Implementierung hier
│   │   ├── MeetingClient.ts        # Interface Definition
│   │   ├── types.ts
│   │   └── adapters/
│   │       └── livekit/            # LiveKit-Implementierung
│   │           ├── LiveKitMeetingClient.ts
│   │           └── LiveKitTokenService.ts
│   │
│   ├── presence-core/              # Avatar-State Transport Interface
│   │   ├── PresenceTransport.ts
│   │   ├── types.ts
│   │   └── adapters/
│   │       └── datachannel/        # LiveKit DataChannel Implementierung
│   │
│   ├── matterport-runtime/         # MP SDK Wrapper
│   │   ├── MatterportRuntime.ts
│   │   ├── types.ts
│   │   └── bundle-loader.ts        # Lädt JS-Bundle vom eigenen CDN
│   │
│   ├── matterport-objects/         # 3D-Objekte / Avatare in MP
│   │   ├── ObjectLayer.ts
│   │   ├── AvatarObject.ts
│   │   └── types.ts
│   │
│   ├── embed-sdk/                  # Externes Embed für Partner
│   │   ├── embed.ts
│   │   └── HostIntegration.ts
│   │
│   └── config/                     # Shared Configs
│       ├── tsconfig.base.json
│       ├── eslint.config.js
│       └── tailwind.config.ts
│
└── docs/
    └── architecture/
        ├── PLAN.md                 # diese Datei
        ├── SPRINTS.md
        ├── RISKS.md
        └── adr/
```

---

## 4. Interfaces & Types

### `packages/core/types.ts`

```typescript
// Zentrale Domain Types

export type Room = {
  id: string;
  name: string;
  slug: string;               // für URL
  matterportModelId?: string;
  ownerId: string;
  settings: RoomSettings;
  createdAt: string;
};

export type RoomSettings = {
  maxParticipants: number;    // default: 10, hard limit Phase 1
  allowGuests: boolean;
  requireApproval: boolean;
  recordingEnabled: boolean;
};

export type RoomParticipant = {
  userId: string;
  roomId: string;
  role: "host" | "guest" | "viewer";
  displayName: string;
  avatarUrl?: string;
  joinedAt: string;
};

export type AppError = {
  code: ErrorCode;
  message: string;
  details?: unknown;
};

export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "TOKEN_EXPIRED"
  | "UNAUTHORIZED"
  | "NETWORK_ERROR"
  | "MP_LOAD_FAILED";
```

### `packages/meeting-core/MeetingClient.ts`

```typescript
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"   // Netzwerkabbruch, versucht wiederzuverbinden
  | "failed";        // terminaler Fehlerzustand

export type MeetingUser = {
  id: string;
  displayName: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  role: "host" | "guest";
  track?: MediaStreamTrack;
};

export interface MeetingClient {
  // Lifecycle
  join(roomId: string, token: string): Promise<void>;
  leave(): Promise<void>;
  destroy(): void;

  // Media Controls
  setMicrophone(enabled: boolean): Promise<void>;
  setCamera(enabled: boolean): Promise<void>;
  shareScreen(enabled: boolean): Promise<void>;

  // State
  getState(): ConnectionState;
  getLocalUser(): MeetingUser;
  getParticipants(): MeetingUser[];

  // Events — jedes gibt eine unsubscribe-Funktion zurück
  onConnectionStateChanged(cb: (state: ConnectionState) => void): () => void;
  onParticipantsChanged(cb: (users: MeetingUser[]) => void): () => void;

  // Token-Refresh für Long Sessions (>1h)
  onTokenExpiring(cb: () => Promise<string>): void;
}
```

### `packages/presence-core/types.ts`

```typescript
export type Vec3 = { x: number; y: number; z: number };
export type Quat = { x: number; y: number; z: number; w: number };

export type AvatarAnimation = "idle" | "walking" | "talking" | "waving";

export type AvatarState = {
  userId: string;
  roomId: string;
  position: Vec3;
  rotation: Quat;
  animation: AvatarAnimation;
  speaking: boolean;
  muted: boolean;
  timestamp: number;  // für Interpolation
};

export interface PresenceTransport {
  // fire-and-forget — Packet Loss bei Position OK
  broadcast(state: AvatarState): void;

  onRemoteState(
    cb: (states: Map<string, AvatarState>) => void
  ): () => void;  // returns unsubscribe fn

  // Throttle-Rate setzen (default: 20/s = 50ms Interval)
  setUpdateRate(hz: number): void;

  dispose(): void;
}
```

### `packages/matterport-runtime/MatterportRuntime.ts`

```typescript
export type CameraPose = {
  position: Vec3;
  rotation: Quat;
  fov: number;
};

export type MatterportConfig = {
  modelId: string;
  bundleUrl: string;   // eigenes CDN — nie direkt von Matterport
  apiKey?: string;     // NUR Backend, nie Frontend
  options?: {
    hideUI?: boolean;
    startScene?: string;
    autoplay?: boolean;
  };
};

export interface MatterportRuntime {
  // Lifecycle
  mount(container: HTMLElement, config: MatterportConfig): Promise<void>;
  dispose(): Promise<void>;

  // Camera
  getCameraPose(): Promise<CameraPose>;
  teleport(pose: CameraPose): Promise<void>;
  onCameraChanged(cb: (pose: CameraPose) => void): () => void;

  // Object Layer Access
  getObjectLayer(): MatterportObjectLayer;

  // Status
  isReady(): boolean;
  onReady(cb: () => void): void;
}
```

### `packages/matterport-objects/ObjectLayer.ts`

```typescript
export type Transform = {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
};

export type SceneObject = {
  id?: string;           // auto-generated wenn leer
  type: "avatar" | "marker" | "label";
  transform: Transform;
  metadata?: Record<string, unknown>;
};

export interface MatterportObjectLayer {
  addObject(object: SceneObject): Promise<string>;
  updateObject(id: string, transform: Partial<Transform>): Promise<void>;
  removeObject(id: string): Promise<void>;
  getObject(id: string): SceneObject | null;
  getAllObjects(): SceneObject[];
  clear(): Promise<void>;
}
```

### `packages/embed-sdk/embed.ts`

```typescript
export type VistaEmbedConfig = {
  modelId: string;
  roomId: string;
  apiKey?: string;
  displayName?: string;
  theme?: "light" | "dark";
  onReady?: () => void;
  onError?: (error: AppError) => void;
};

// Standalone Mode (Vista hostet alles)
export interface VistaMeetEmbed {
  mount(selector: string, config: VistaEmbedConfig): Promise<void>;
  unmount(): void;
  updateConfig(config: Partial<VistaEmbedConfig>): void;
}

// Partner Mode (MPskin gibt Runtime-Kontext)
export interface HostIntegration {
  getModelId(): string;
  getSdkContext?(): unknown;
  mountVistaMeet(config: VistaEmbedConfig): Promise<void>;
}
```

---

## 5. Backend API

### Endpoints

```
# AUTH
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

# ROOMS
POST   /rooms                       # Raum erstellen (auth required)
GET    /rooms                       # Eigene Räume listen
GET    /rooms/:roomId               # Raum-Details
PATCH  /rooms/:roomId               # Settings ändern (host only)
DELETE /rooms/:roomId               # Raum löschen (host only)

# JOIN / TOKENS
POST   /rooms/:roomId/join
  Body:    { displayName, password? }
  Returns: { token, liveKitToken, participantId }

POST   /rooms/:roomId/token/refresh
  Body:    { participantId }
  Returns: { token }

# SESSIONS
POST   /sessions/:sessionId/leave
GET    /sessions/:sessionId/participants

# HEALTH
GET    /health
```

### Datenbankschema (Drizzle)

```typescript
export const users = pgTable("users", {
  id:           text("id").primaryKey(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName:  text("display_name").notNull(),
  createdAt:    timestamp("created_at").defaultNow(),
});

export const rooms = pgTable("rooms", {
  id:                text("id").primaryKey(),
  name:              text("name").notNull(),
  slug:              text("slug").notNull().unique(),
  ownerId:           text("owner_id").notNull(),
  matterportModelId: text("mp_model_id"),
  settings:          jsonb("settings").default({}).$type<RoomSettings>(),
  createdAt:         timestamp("created_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id:          text("id").primaryKey(),
  roomId:      text("room_id").notNull().references(() => rooms.id),
  userId:      text("user_id").notNull(),
  displayName: text("display_name").notNull(),
  role:        text("role", { enum: ["host", "guest", "viewer"] }).notNull(),
  joinedAt:    timestamp("joined_at").defaultNow(),
  leftAt:      timestamp("left_at"),
});
```

### Auth-Flow

```
1. Login: POST /auth/login
   → Server erstellt Access Token (1h) + Refresh Token (7d)
   → Access Token:  httpOnly Cookie (SameSite=Strict, Secure)
   → Refresh Token: httpOnly Cookie (SameSite=Strict, Secure, path=/auth/refresh)

2. Request: Jede API-Anfrage liest Access Token aus Cookie
   → Server validiert via jose/jwtVerify
   → Bei 401: Client ruft /auth/refresh auf

3. Refresh: POST /auth/refresh
   → Server validiert Refresh Token
   → Erstellt neue Tokens (Rotation: alter Refresh Token wird invalidiert)
   → Schreibt neue Cookies

4. Token-Expiry während Meeting:
   → MeetingClient.onTokenExpiring() wird ~5min vor Expiry gefeuert
   → Client ruft /rooms/:roomId/token/refresh
   → Neuer LiveKit-Token wird an LiveKit übergeben (room.updateToken())
   → Kein Meeting-Unterbruch

KEIN localStorage. KEIN sessionStorage für Tokens.
```

---

## 6. Security

| Maßnahme | Details |
|---|---|
| **CORS** | Nur whitelistete Origins. Kein Wildcard. Für Embed-SDK: Domain-Whitelist per API-Key konfigurierbar. |
| **Content Security Policy** | Strikte CSP via `next.config.js`. `script-src 'self' cdn.vista-meet.com static.matterport.com` |
| **Input Validation** | Alle API-Inputs via Zod validiert. Parametrisierte Queries via Drizzle. |
| **Rate Limiting** | `POST /rooms`: 10/min pro IP. Token-Endpoints: 30/min. Join: 5/min pro IP. |
| **Matterport API Key** | ⚠️ API Key **NIEMALS** im Frontend-Bundle. Nur auf dem Backend. Der Browser sieht nur den Model-Token. |
| **LiveKit Token** | ⚠️ Tokens werden **IMMER** auf dem Backend generiert. User-ID ist im Token kodiert und wird geprüft. |
| **Dependency Scanning** | GitHub Dependabot auf allen Branches. `pnpm audit` in CI. Pipeline bricht bei HIGH. |
| **Secrets Management** | Keine Secrets in `.env`-Dateien im Repo. `.env.example` mit Dummy-Werten. Produktions-Secrets via Vercel/Infisical. |

---

## Integration Modi

### Standalone Mode
Vista Meet hostet das SDK-Bundle auf dem eigenen CDN. Partner gibt nur Model-ID und Room-ID an.

```html
<script src="https://cdn.vista-meet.com/embed.js"></script>
<div id="vista-meet"></div>
<script>
  VistaMeet.mount("#vista-meet", {
    modelId: "MATTERPORT_MODEL_ID",
    roomId:  "ROOM_ID",
    apiKey:  "PARTNER_API_KEY"
  });
</script>
```

### Partner Mode (MPskin)
MPskin hat bereits eine Matterport-Runtime. Vista Meet bekommt Zugang via `HostIntegration`.

```typescript
// MPskin implementiert dieses Interface:
class MPskinHostIntegration implements HostIntegration {
  getModelId() {
    return this.currentModel.id;
  }
  getSdkContext() {
    return this.matterportSdk; // ihre Runtime
  }
  async mountVistaMeet(config) {
    VistaMeet.mount("#vm", { ...config, hostIntegration: this });
  }
}
```

> **Wichtig:** Vista Meet erkennt beim Start ob ein `hostIntegration` Kontext vorhanden ist. Wenn ja → Partner Mode. Wenn nein → Standalone Mode. Die gesamte Anwendungslogik darunter ist identisch.
