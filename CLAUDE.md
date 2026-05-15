# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Run all apps in dev mode (Turborepo parallel)
pnpm dev

# Run a specific app
pnpm --filter @meet-vista/api dev          # API on :3001
pnpm --filter @meet-vista/web dev          # Next.js web on :3000
pnpm --filter @meet-vista/meeting-lab dev  # Meeting lab on :5173
pnpm --filter @meet-vista/matterport-lab dev

# Build
pnpm build

# Type check
pnpm typecheck

# Lint / Format
pnpm lint
pnpm format

# Database (run from apps/api)
pnpm --filter @meet-vista/api db:generate   # generate migration from schema changes
pnpm --filter @meet-vista/api db:migrate    # apply migrations
```

### Frontend build (meeting-lab)

`pnpm --filter @meet-vista/meeting-lab build` runs `node build.mjs` (esbuild-based). Do **not** restore `vite build` — rollup 4.60.x has an infinite-recursion bug on Node 25 / macOS 26 that causes the build to hang indefinitely. The `build.mjs` script bundles with esbuild directly, replaces `import.meta.env.*` at build time (reads `.env` + shell vars), and auto-generates `dist/index.html` with correct hashed filenames. Build takes ~10–60s.

For production same-domain deployment, set `VITE_API_URL=` (empty) in `.env` before building — this makes API calls use relative paths that nginx/Caddy proxy to the backend. The build bakes the value in; rebuilding is required after changing any `VITE_*` var.

### API dev workflow

The API compiles TypeScript before running (`dev` runs `dist/index.js` with `--watch`). After editing API source files you must rebuild:

```bash
pnpm --filter @meet-vista/api build
```

Do **not** use `hono-rate-limiter` — its module-level `init()` hangs the Node process. The app uses a hand-rolled in-memory rate limiter in `apps/api/src/app.ts`.

**Slow startup on Node 25 / macOS 26 ARM64:** The API takes ~60–90 seconds to start due to a V8 JIT bug triggered by drizzle-orm's class hierarchy. On Linux x86_64 (production server, Docker) with Node 22 the startup is instant. Do not kill the process during startup — it will eventually respond.

### Required `.env` files

Copy `.env.example` → `.env` in `apps/api` and `apps/meeting-lab`. The API needs real LiveKit credentials (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) and a `JWT_SECRET` of at least 32 chars.

For a public live test also set:
- `DEV_SECRET` in `apps/api/.env` — protects host-action endpoints (kick, mute, admit…)
- `VITE_DEV_SECRET` in `apps/meeting-lab/.env` — must match `DEV_SECRET`
- `CORS_ORIGIN` — comma-separated list of allowed frontend origins

---

## Live server deployment

WebRTC (camera/mic/screen share) **requires HTTPS** on any non-localhost URL.

### Quick path (Caddy + VPS)

1. **Build locally:** `./scripts/build-prod.sh`
2. **Copy to server:**
   ```bash
   rsync -av apps/api/dist/ apps/api/drizzle/ user@server:/app/api/
   rsync -av apps/meeting-lab/dist/ user@server:/var/www/vista-meet/
   ```
3. **On server — first deploy only:**
   ```bash
   node --env-file=.env /app/api/dist/db/migrate.js
   ```
4. **On server — run API:**
   ```bash
   node --env-file=.env /app/api/dist/index.js
   ```
5. **Install Caddy** and configure with `Caddyfile` (replace `YOUR_DOMAIN`).

### Docker Compose path

```bash
# Build frontend first (Vite runs locally)
pnpm --filter @meet-vista/meeting-lab build

# Set env vars in apps/api/.env
docker compose up -d
```

Nginx serves the built frontend on `:80`. For HTTPS in front of Docker use Caddy or a cloud load balancer.

---

## Architecture

pnpm + Turborepo monorepo. **Dependency direction is one-way and non-negotiable:**

> Components → Hooks → Services → Packages (never the reverse; packages never import from apps)

External services are behind TypeScript interfaces with concrete adapters in `adapters/` subdirectories.

### Packages

| Package | Role |
|---|---|
| `@meet-vista/core` | Shared domain types (`Room`, `RoomParticipant`, `AppError`), utils, errors |
| `@meet-vista/meeting-core` | `MeetingClient` interface + LiveKit adapter (`adapters/livekit/`) |
| `@meet-vista/presence-core` | `PresenceTransport` interface + LiveKit DataChannel adapter |
| `@meet-vista/matterport-runtime` | `MatterportRuntime` interface — wraps the self-hosted Matterport JS bundle |
| `@meet-vista/matterport-objects` | `MatterportObjectLayer` — 3D scene objects (avatars, markers, labels) |
| `@meet-vista/embed-sdk` | `VistaMeetEmbed` (standalone) + `HostIntegration` (partner/MPskin) |
| `@meet-vista/config` | Shared tsconfig, eslint config, tailwind config |

**Adapter rule:** `@livekit/client` may only be imported inside `packages/meeting-core/adapters/livekit/`. The Matterport SDK only inside `packages/matterport-runtime/`.

### Apps

| App | Stack | Purpose |
|---|---|---|
| `web` | Next.js 14 + React 18 + Tailwind + Zustand | Production user-facing app (Sprint 6+) |
| `api` | Hono + Drizzle ORM + SQLite | REST backend |
| `meeting-lab` | Vite + React | Meeting/WebRTC integration test harness (active) |
| `matterport-lab` | Vite + React | Matterport SDK test harness (Sprint 3+) |

---

## What's built and working (Sprint 1–2 complete)

### Audio/Video (meeting-lab)

- Remote audio tracks are attached to hidden `<audio>` elements in `LiveKitMeetingClient` via `track.attach()` — **this is required** with the raw LiveKit JS SDK. Without it, speaking indicators work but no sound plays.
- `room.startAudio()` is called after connect to unblock browser autoplay. It must remain in the `join()` user-gesture call chain.
- Audio output switching uses `room.switchActiveDevice('audiooutput', id)` + manual `setSinkId` on managed elements (for SDK version compatibility).
- Screen share state is driven by `localUser.isScreenSharing` from the LiveKit participants snapshot, not local component state. This prevents desync when the user cancels the browser picker.

### Host controls (meeting-lab + API)

All host actions are API calls to `/dev/*` endpoints (dev-only, blocked in production):

| Action | Endpoint | Implementation |
|---|---|---|
| Kick | `POST /dev/kick` | `RoomServiceClient.removeParticipant` |
| Mute/unmute | `POST /dev/mute-participant` | `getParticipant` → find audio track SID → `mutePublishedTrack` |
| Camera off/on | `POST /dev/camera-participant` | `getParticipant` → find camera track SID → `mutePublishedTrack` |
| Screen share allow/revoke | `POST /dev/screenshare-permission` | `updateParticipant` with `canPublishSources` |
| Admit from waiting room | `POST /dev/admit-participant` | `updateParticipant` with full permissions + metadata `{ role: "guest" }` |
| Deny from waiting room | `POST /dev/deny-participant` | `removeParticipant` |
| Close/open room | `POST /dev/set-room-config` | persisted to `dev_room_config` SQLite table; blocks `guest-token` when `closed: true` |

Host controls appear on hover in the participant list sidebar. Only visible to the host (role derived from LiveKit token metadata).

### Waiting room

- `JoinForm` has a "Join as Host" toggle. When host, an optional "Waiting room active" toggle is shown.
- Host's join request sends `{ role: "host", requireApproval: boolean }` to `POST /dev/guest-token`.
- The server persists this per-room in the SQLite `dev_room_config` table (via Drizzle). Subsequent guests get tokens with `canPublish: false, canSubscribe: false` and metadata `{ role: "waiting" }`.
- Waiting guests connect to LiveKit but see a `WaitingScreen` (no video/audio). The `MeetingClient.onPermissionsChanged()` event fires when the host admits them.
- The host sees `AdmitPopup` cards floating in the top-right corner, one per waiting participant.
- After admission, `updateParticipant` promotes permissions + sets metadata to `{ role: "guest" }`. The client's `ParticipantPermissionsChanged` event triggers mic/camera publishing.

### Backend API (apps/api)

Hono, SQLite via `@libsql/client` + Drizzle. Auth uses short-lived JWTs (1h access, 7d refresh) in `httpOnly` cookies only. LiveKit tokens always generated server-side.

Key auth rule: `MATTERPORT_API_KEY` stays on the backend only — never in `NEXT_PUBLIC_*` variables. LiveKit tokens are always generated server-side.

### Presence transport

Avatar state (`AvatarState`: position, rotation, animation) is replicated via **LiveKit DataChannel** + **MessagePack** (~40 bytes per update, 20 Hz throttle). The `PresenceTransport` interface abstracts this — swap to WebSocket without touching app code.

### Integration modes

- **Standalone:** Vista hosts the Matterport bundle on its own CDN. Partner provides only `modelId` + `roomId`.
- **Partner/MPskin:** Host implements `HostIntegration` and passes its existing Matterport runtime. Vista detects `hostIntegration` at startup and skips its own bundle load.

### SpotlightLayout screen share behavior

- When a participant starts screen sharing, the spotlight always shows the screen share (takes priority over the clicked spotlight tile).
- ALL participants' camera tiles remain visible in the strip during screen share — no one disappears.
- A dedicated screen share tile appears at the top of the strip, labeled "Bildschirm von [Name]", with a stop button on hover (local user or host can stop it).
- When screen share ends, spotlight reverts to default selection logic.
- Strip thumbnail hover controls (host only) now appear as small icon buttons in the top-right corner only — no full overlay darkening.

### Layout modes (meeting-lab)

Header has a Spotlight ↔ Grid toggle. `MeetingApp` holds `layout: "spotlight" | "grid"` state and renders either `SpotlightLayout` or `GridLayout`. Both accept the same `sharedLayoutProps` object (participants, handlers, raisedHands, panel config).

- **Spotlight** (`SpotlightLayout.tsx`): One large main video + scrollable right strip with thumbnails. During screen share: all cameras stay in strip + screen share tile at top.
- **Grid** (`GridLayout.tsx`): All participants in a responsive CSS grid (1/2/3/4 columns based on count). During screen share: screen takes the main area, participants in a right strip.

Grid columns: 1 participant → 1 col, 2–4 → 2 cols, 5–9 → 3 cols, 10+ → 4 cols.

### VideoTile (meeting-lab)

`components/VideoTile.tsx` is the shared tile used by both layouts. Props:
- `user: MeetingUser` — rendered participant
- `isLocal?: boolean` — mutes video element
- `compact?: boolean` — smaller avatar/labels
- `handRaised?: boolean` — shows yellow hand badge (top-left)
- `controls?: React.ReactNode` — optional host-controls overlay injected by parent

Connection quality icon (wifi bars) rendered in label bar from `user.connectionQuality`.

### useVideoTrack hook

`hooks/useVideoTrack.ts` — extracted DRY hook: attaches a `MediaStreamTrack` to a `<video>` ref via `MediaStream`, calls `play()`, clears `srcObject` on cleanup. Used everywhere a video track is rendered.

### Left panel system (meeting-lab)

`LeftPanelOverlay` at `components/LeftPanelOverlay.tsx` renders the active panel on the left side of the video. Add new panels by passing an array of `LeftPanelDef` objects:

```ts
type LeftPanelDef = { id: string; label: string; icon: React.ReactNode; content: React.ReactNode; };
```

`MeetingApp` builds `leftPanels` and passes them (along with `activePanel: string | null`) down to both layouts, which render `LeftPanelOverlay`. Toggle panels via the Controls bar buttons.

### DataChannel message types (meeting-lab)

All peer-to-peer messages share the same `onData`/`sendData` channel. `MeetingApp` parses them via `parsePayload()` and dispatches by `type`:

| Type | Shape | Effect |
|---|---|---|
| `chat` | `{ type, from, text, ts }` | appended to messages state |
| `hand` | `{ type, raised, identity }` | updates `raisedHands: Set<string>` |

Add new message types by extending the `DataPayload` union in `MeetingApp.tsx`.

### Raise hand (meeting-lab)

Controls bar has a yellow Hand button (`onHandToggle`, `handRaised` props). Toggling sends a `hand` DataChannel message to all peers. `raisedHands` state tracks which participant identities have raised hands and is passed to both layouts → `VideoTile` shows a badge.

### Connection quality (meeting-lab)

`MeetingUser.connectionQuality` field (type `ConnectionQuality`) populated from LiveKit's `participant.connectionQuality`. `LiveKitMeetingClient` listens to `RoomEvent.ConnectionQualityChanged` to trigger re-renders. `VideoTile` shows a Wifi icon (green/yellow/orange/red) per participant.

### Chat (meeting-lab)

Chat messages broadcast via LiveKit DataChannel. Own messages added locally. `ChatPanel` renders message list and input. Unread count badge shown on Controls chat button.

### Settings panel (meeting-lab, host only)

`SettingsPanel` at `components/panels/SettingsPanel.tsx` accepts `SettingsSection[]`. Add new sections by pushing to the array in `MeetingApp`. Built-in sections:

1. **Raum-Einstellungen** — "Raum schließen" toggle calls `POST /dev/set-room-config` which prevents new guests from joining.
2. **Teilnehmer** — per-participant screen share permission toggles.

### Dev API helper (meeting-lab)

All `/dev/*` fetch calls go through `devApi(endpoint, body)` in `MeetingApp.tsx`. It centralises error handling. To add a new host action: add a new `useCallback` that calls `devApi(...)` and pass it to the layout or controls.

---

## What still needs building

- **Sprint 3:** Matterport SDK integration in `matterport-lab` (bundle loader, camera events)
- **Sprint 4:** 3D object layer / avatar placeholders in Matterport scene
- **Sprint 5:** Avatar state replication (presence-core wired into UI)
- **Sprint 6:** `apps/web` — full meeting canvas with Matterport + meeting controls + avatars
- **Sprint 7:** Embed SDK (`packages/embed-sdk`)
- **Sprint 8:** Partner mode (MPskin `HostIntegration`), production hardening
