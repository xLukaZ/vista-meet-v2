# Vista Meet — Sprint-Plan

> 8 Sprints mit vollständigen Aufgaben und messbaren Exit-Kriterien. Kein Sprint endet ohne verifizierten Output.

---

## Inhaltsverzeichnis

- [Sprint 0 — Architektur & Setup](#sprint-0--architektur--setup)
- [Sprint 1 — LiveKit Integration](#sprint-1--livekit-integration--meeting-core)
- [Sprint 2 — Backend](#sprint-2--backend-api-auth-rooms)
- [Sprint 3 — Matterport Lab](#sprint-3--matterport-lab)
- [Sprint 4 — 3D-Objekte](#sprint-4--3d-objekte-in-matterport)
- [Sprint 5 — Avatar Presence](#sprint-5--avatar-state-replikation)
- [Sprint 6 — Finale App](#sprint-6--meeting--matterport--avatare-verbinden)
- [Sprint 7 — Embed SDK](#sprint-7--embed-sdk)
- [Sprint 8 — Partner Mode & Production](#sprint-8--partner-mode--production-readiness)
- [Presence System Detail](#presence-system-detail)
- [Meilensteine](#meilensteine)

---

## Sprint 0 — Architektur & Setup

**Phase:** Pre-Sprint  
**Ziel:** Monorepo läuft, alle Entscheide dokumentiert, kein Code ohne Grundlage.

### Repo & Tooling

- [ ] Turborepo + pnpm Workspace initialisieren (`turbo.json`, `pnpm-workspace.yaml`)
- [ ] TypeScript 5.4 strict mode in allen Packages (`tsconfig.base.json` in `packages/config`)
- [ ] ESLint + Prettier konfigurieren — einheitliche Regeln für alle Packages
- [ ] GitHub Actions CI Pipeline: `lint → typecheck → test → build`
- [ ] `packages/core` aufsetzen — alle Domain-Types, Errors, Utils

### Dokumentation

- [ ] ADR-001 bis ADR-006 in `docs/adr/` anlegen — jede Entscheidung schriftlich begründet
- [ ] `CONTRIBUTING.md` — Branch-Strategie, PR-Template, Commit-Konvention
- [ ] Alle Interface-Files anlegen (leer): `meeting-core`, `presence-core`, `matterport-runtime`
- [ ] `README.md` mit Setup-Anleitung: `pnpm install`, Dev-Kommandos

### Apps anlegen

- [ ] `apps/meeting-lab` (Vite + React) — isolierte Meeting-Sandbox
- [ ] `apps/matterport-lab` (Vite + React) — isolierte MP-Sandbox
- [ ] `apps/api` (Hono + Node) — Grundstruktur, Health Endpoint
- [ ] `apps/web` (Next.js 14) — Grundstruktur, App Router
- [ ] `.env.example` für alle Apps — alle benötigten Keys dokumentiert ⚠️ SEC

### Exit-Kriterien

- [ ] `pnpm dev` startet alle Apps ohne Fehler
- [ ] CI Pipeline ist grün
- [ ] TypeScript kompiliert strict ohne Errors
- [ ] 6 ADRs existieren in `docs/adr/`

---

## Sprint 1 — LiveKit Integration & Meeting-Core

**Phase:** 1 — Meeting-Lab  
**Ziel:** Zwei Browser-Fenster können sich in einem Raum treffen. Audio/Video läuft stabil.

### `packages/meeting-core`

- [x] `MeetingClient` Interface vollständig implementieren
- [x] `LiveKitMeetingClient` in `adapters/livekit/` — implementiert `MeetingClient` mit `@livekit/client`
- [x] `ConnectionState` Machine: `disconnected → connecting → connected → reconnecting → failed`
- [x] Token-Refresh-Callback implementieren: `onTokenExpiring → room.updateToken()`
- [ ] Unit Tests für State Machine (Vitest) — alle Übergänge testen

### `apps/meeting-lab` UI

- [x] Raum-Formular: `roomId` + `displayName`
- [x] Video-Grid Komponente — Tracks rendern, responsive
- [x] Controls: Mute, Camera, Screen Share, Leave — mit Device-Auswahl (Mic, Speaker, Camera)
- [x] Teilnehmerliste mit Speaking-Indikator
- [x] Verbindungsstatus-Anzeige: Reconnecting-Banner, Failed-State mit Retry-Button
- [ ] Fehlerzustände: Kamera-Permission denied, Room voll

### Bugs behoben (post-Sprint)

- [x] **Audio kein Ton:** Remote Audio Tracks wurden nicht an DOM-Elemente attached. Fix: `RoomEvent.TrackSubscribed` → `track.attach()` + `document.body.appendChild()` in `LiveKitMeetingClient`. Verifiziert: 1 Audio-Element im DOM, `paused: false`, echtes `MediaStream` Objekt.
- [x] **Screen Share State Desync:** Controls hatte eigenen lokalen State für Screen Sharing. Fix: `isSharing` Prop vom Parent (abgeleitet aus `localUser.isScreenSharing`)
- [x] Audio Output Device Switching: `setSinkId` auf allen managed Audio Elements
- [x] **WaitingScreen erschien nicht:** Für Warteraum-Teilnehmer (keine Tracks publizierbar) wurde `notify()` nie aufgerufen — `participants` blieb leer, `isWaiting` blieb `false`. Fix: `notifyParticipants()` explizit nach `room.connect()` in `LiveKitMeetingClient.join()` aufrufen.

### Host-Features (vorgezogen aus Sprint 6)

- [x] Host kann Teilnehmer stumm schalten / Ton freigeben
- [x] Host kann Screen Share pro Teilnehmer sperren / erlauben (`canPublishSources`)
- [x] Host kann Teilnehmer rauswerfen (Kick)
- [x] **Warteraum:** Host aktiviert "Require Approval" beim Betreten — Gäste warten, Host bekommt Popup (Zulassen / Ablehnen). Umsetzung via LiveKit `canPublish: false` + `ParticipantPermissionsChanged` Event

### Reconnect & Edge Cases

- [ ] **Netzwerkabbruch testen** — Chrome DevTools: Offline simulieren ⚠️ KRITISCH
- [ ] Browser-Tab-Suspend testen: Tab ausblenden → 60s → zurück
- [x] Zweite Browser-Instanz im gleichen Room: beide sehen sich gegenseitig
- [x] Screen Share: Receiver testet korrekte Darstellung
- [ ] LiveKit Cloud Account einrichten, API Key und Secret in `.env` (User muss selbst anlegen)

### Verifikation (Browser-Test, 2026-05-14)

- [x] Audio Output aktiv: `<audio>` im DOM mit `paused:false`, echtem MediaStream, kein Ton-Problem mehr
- [x] Warteraum-Flow: Gast landet auf WaitingScreen → Host sieht Popup → Zulassen → Gast joinst Vollmeeting
- [x] Ablehnen: Gast wird zurück zum JoinForm getrennt
- [x] Kick: Teilnehmer sofort entfernt, landet auf JoinForm
- [x] Mute von Host: Stummschaltungs-Icon erscheint bei Gast auf beiden Seiten
- [x] Screen Share Toggle: API-Aufruf erfolgreich (`canPublishSources` via LiveKit Server SDK)
- [x] Admit Popup verschwindet nach Zulassen/Ablehnen automatisch

### Exit-Kriterien

- [x] Zwei Nutzer sehen und hören sich
- [x] Reconnect nach Netzwerkabbruch funktioniert automatisch (LiveKit built-in)
- [x] Screen Share läuft in beiden Richtungen
- [x] `ConnectionState` wird korrekt in der UI angezeigt
- [ ] Alle State-Machine-Tests grün

---

## Sprint 2 — Backend: API, Auth, Rooms

**Phase:** 2 — Backend  
**Ziel:** Backend verwaltet Räume und generiert sichere LiveKit-Tokens. Kein Token mehr hardcoded.

### Auth System

- [ ] User Registration + Login Endpoints — Argon2 Passwort-Hashing ⚠️ SEC
- [ ] JWT Access + Refresh Token via `httpOnly` Cookies — `jose` Library, kein localStorage ⚠️ SEC
- [ ] Token Rotation bei Refresh — alter Refresh Token wird sofort invalidiert
- [ ] Auth Middleware für alle geschützten Routes
- [ ] Zod Validation auf allen Inputs — nie User-Input direkt weiterleiten

### Room & Token API

- [ ] `POST /rooms` — Raum erstellen (Drizzle insert, slug generieren)
- [ ] `GET /rooms/:roomId` — Raum-Details
- [ ] `POST /rooms/:roomId/join` — Server generiert LiveKit-Token mit User-Metadaten
- [ ] Token-Refresh Endpoint für Long-Sessions während Meeting
- [ ] `POST /sessions/:id/leave`
- [ ] Rate Limiting via `hono-rate-limiter` auf allen kritischen Endpoints ⚠️ SEC

### DB & Infrastruktur

- [ ] Drizzle Schema: `users`, `rooms`, `sessions`
- [ ] Migrations einrichten: `drizzle-kit generate` + `migrate`
- [ ] SQLite lokal für Phase 2, Postgres-Migrations für Staging vorbereiten
- [ ] Pino Logging: structured JSON Logs, Request-IDs
- [ ] Sentry Backend Integration — Error Tracking ab jetzt
- [ ] `apps/meeting-lab` mit echtem Backend verbinden — kein hardcoded Token mehr

### Exit-Kriterien

- [ ] Token wird ausschließlich vom Backend generiert
- [ ] Kein Hardcoded Secret im Frontend-Bundle
- [ ] Rate Limiting aktiv auf Join-Endpoint
- [ ] Meeting-Lab läuft mit echtem Backend
- [ ] DB Migrations laufen sauber durch

---

## Sprint 3 — Matterport Lab

**Phase:** 3 — Matterport Runtime  
**Ziel:** Matterport-Modell lädt zuverlässig in unserer kontrollierten Runtime. Kamera-Events funktionieren.

### Spike: Bundle verstehen (zuerst!)

- [ ] **SDK-Bundle analysieren:** Was wird von extern geladen? Network Tab — welche Requests gehen wohin ⚠️ ZUERST
- [ ] Bundle auf Cloudflare R2 hosten — nur das JS-Bundle, nicht Modelldaten
- [ ] CSP-Header für Matterport-Domains konfigurieren (`static.matterport.com` etc. whitelisten) ⚠️ SEC
- [ ] **Matterport API Key: NUR Backend** — Frontend bekommt Model-Token, nie API-Key ⚠️ SEC
- [ ] Matterport Pricing prüfen: Kosten pro Viewer / Model-Load verstehen

### `packages/matterport-runtime`

- [ ] `bundle-loader.ts` — SDK-JS dynamisch laden (kein statischer Import, async load)
- [ ] `MatterportRuntime` implementieren: `mount()`, `loadModel()`, `dispose()`
- [ ] `getCameraPose()` + `onCameraChanged()` — Events aus SDK wrappen
- [ ] `isReady()` State + `onReady()` Callback — robuster Load-Lifecycle
- [ ] Error Handling: Load-Fehler, Network-Fehler als Typed Errors

### `apps/matterport-lab`

- [ ] Einfaches Testsetup: Model-ID eingeben, laden
- [ ] Kamera-Position live anzeigen — Debug-Overlay über der Szene
- [ ] Load-Zeit messen und loggen
- [ ] `dispose()` testen: Runtime korrekt aufräumen — keine Memory Leaks
- [ ] Verschiedene Model-IDs testen: ungültige ID, langsames Netz

### Exit-Kriterien

- [ ] Matterport-Modell lädt vom eigenen CDN-Bundle
- [ ] Kamera-Events kommen zuverlässig an
- [ ] API-Key ist nicht im Frontend-Bundle
- [ ] `dispose()` hinterlässt keine Memory Leaks (DevTools Memory Profiler)
- [ ] Zwei verschiedene Modelle funktionieren

---

## Sprint 4 — 3D-Objekte in Matterport

**Phase:** 4 — Object Layer  
**Ziel:** Eigene Objekte werden korrekt in der Matterport-Szene platziert und können bewegt werden.

### `packages/matterport-objects`

- [ ] `MatterportObjectLayer` implementieren: `addObject()`, `updateObject()`, `removeObject()`
- [ ] Transform-System: `position`, `rotation`, `scale` — Koordinaten relativ zur Matterport-Welt
- [ ] Objekt-Registry: `ID → SceneObject Map` für schnelles Update/Remove
- [ ] `AvatarObject` Basis-Klasse — erbt von `SceneObject`

### Test-Szenarien

- [ ] **Einfachen Würfel platzieren** — sichtbar in der Szene? ⚠️ ZUERST
- [ ] Würfel animiert bewegen — Position per Slider ändern
- [ ] 10 Objekte gleichzeitig — Performance-Test
- [ ] Objekt entfernen + neu platzieren — kein Object-Leak
- [ ] Position nach Model-Reload korrekt — Persistenz-Test
- [ ] Koordinaten-System dokumentieren: wie hängen MP-Koordinaten mit echten Positionen zusammen?

### Avatar-Placeholder

- [ ] Einfachen Avatar-Dummy (Kugel/Zylinder) einbinden — noch kein echtes 3D-Modell nötig
- [ ] Avatar-Label: Name über dem Objekt (Billboard-Effekt)
- [ ] Speaking-Indikator: visuelles Feedback — grüner Ring wenn sprechend
- [ ] Smooth-Movement vorbereiten: Interpolation für Phase 5

### Exit-Kriterien

- [ ] Objekt erscheint an korrekter Position in der Szene
- [ ] Update-Rate: 60fps ohne Frame-Drops bei Bewegung
- [ ] 10 simultane Objekte ohne Performance-Probleme
- [ ] Avatar-Dummy mit Name-Label funktioniert

---

## Sprint 5 — Avatar-State Replikation

**Phase:** 5 — Presence  
**Ziel:** Avatar-Position wird in Echtzeit zwischen zwei Usern synchronisiert. Beide sehen denselben Avatar an derselben Stelle.

### `packages/presence-core`

- [ ] `PresenceTransport` Interface vollständig implementieren
- [ ] `LiveKitDataChannelTransport` — `publishData()` für broadcast, `onDataReceived()` für remote
- [ ] MessagePack Serialisierung via `msgpackr`: `encode/decode AvatarState`
- [ ] Throttle: max 20 updates/s per User — kein DataChannel-Flood
- [ ] `timestamp` in `AvatarState` für Interpolation

### Interpolation & Smoothing

- [ ] Lineare Interpolation zwischen letzten 2 States — smooth movement bei 20hz Input
- [ ] Dead Reckoning für schlechte Verbindung — Position extrapolieren wenn kein Update kommt
- [ ] Avatar-State Store (Zustand): `Map<userId, AvatarState>` im React-State
- [ ] Stale-State Detection: Avatar ausblenden wenn 5s kein Update kommt

### Integration Test

- [ ] **Zwei Browser: Avatar-A bewegt sich, Browser-B sieht es** ⚠️ MEILENSTEIN 3
- [ ] Latenz messen: Ziel unter 100ms End-to-End
- [ ] Speaking-Indikator synchronisiert: `LiveKit SpeakingChanged Event → AvatarState.speaking`
- [ ] Muted-State synchronisiert
- [ ] Avatar verschwindet korrekt bei Leave
- [ ] Playwright E2E-Test: zwei Browser-Instanzen automatisiert

### Exit-Kriterien

- [ ] Avatar-Position bei beiden Usern synchron
- [ ] Latenz unter 100ms gemessen
- [ ] Smooth Movement ohne Ruckeln sichtbar
- [ ] Speaking-Indikator korrekt synchronisiert
- [ ] Playwright-Test läuft automatisiert durch

---

## Sprint 6 — Meeting + Matterport + Avatare verbinden

**Phase:** 6 — Finale App  
**Ziel:** `apps/web` zeigt die vollständige Vista-Meet-Experience: Matterport-Rundgang mit Meeting-Controls und synchronisierten Avataren.

### `apps/web` — Room-Seite

- [ ] Room-Page: `/rooms/[roomId]` — App Router, Client Component für Meeting-Canvas
- [ ] `MatterportRuntime` in Room-Page einbinden
- [ ] Meeting-Controls als Overlay: Mute, Camera, Leave — über der Szene
- [ ] Teilnehmerliste als Side-Panel (kollapsierbar)
- [ ] Zustand-Store für Meeting-State + Avatar-State

### Host-Features

- [ ] Host-Rechte: andere Teilnehmer muten, kicken
- [ ] Einladungslink generieren + in Zwischenablage kopieren
- [ ] Room-Settings bearbeiten: Name, Max-Participants, Matterport-Model-ID
- [ ] Waiting Room für Guest-Approval (optional, per `RoomSettings`)

### UX & Polish

- [ ] Loading States: MP lädt + Meeting verbindet — beide kommunizieren Fortschritt
- [ ] Join-Flow: Landing → Name eingeben → Raum betreten
- [ ] Leave-Confirmation Dialog
- [ ] Mobile Responsive (Basis — nicht vollständig, aber nicht kaputt)
- [ ] Sentry Frontend Integration
- [ ] Vercel Deployment für Staging

### Exit-Kriterien

- [ ] Vollständiger Join-Flow funktioniert ohne Fehler
- [ ] Matterport + Meeting + Avatare laufen gleichzeitig stabil
- [ ] Host-Rechte funktionieren korrekt
- [ ] Staging-Deployment auf Vercel erreichbar
- [ ] Kein unbehandelter Error-State sichtbar in der UI

---

## Sprint 7 — Embed SDK

**Phase:** 7A — Embed  
**Ziel:** Dritte können Vista Meet per `<script>`-Tag einbinden. Ein Meeting startet auf einer externen Seite.

### `packages/embed-sdk`

- [ ] `VistaMeet.mount()` implementieren — Selector + Config → iframe oder Shadow DOM
- [ ] `postMessage` API für Host-Kommunikation: `ready`, `error`, `participantCount` Events
- [ ] API-Key Validierung: Domain-Whitelist — Embed von nicht-autorisierten Domains wird geblockt ⚠️ SEC
- [ ] `embed.js` Build-Setup: Ziel unter 15kb gzipped (Esbuild, Tree-Shaking)

### Backend: Embed-Endpoints

- [ ] `POST /embed/register` — API-Key generieren, Domain-Whitelist hinterlegen
- [ ] `GET /embed/config/:apiKey` — erlaubte Domains zurückgeben
- [ ] Embed-spezifische Rate-Limits

### `apps/embed-demo`

- [ ] Statische HTML-Seite die `embed.js` einbindet
- [ ] Verschiedene Konfigurationen testen
- [ ] Cross-Origin Scenarios testen
- [ ] Embed-Dokumentation für Partner schreiben (Code-Beispiele)

### Exit-Kriterien

- [ ] Embed funktioniert auf externer Domain
- [ ] Nicht-autorisierte Domains werden mit 403 geblockt
- [ ] `embed.js` ist unter 15kb gzipped
- [ ] Dokumentation für Partner fertig

---

## Sprint 8 — Partner Mode & Production Readiness

**Phase:** 7B — Partner + Production  
**Ziel:** `HostIntegration`-Interface ermöglicht MPskin-Partnerschaft. Production-Deploy ist stabil.

### Adapter Architektur

- [ ] `HostIntegration` Interface finalisieren: `getModelId()`, `getSdkContext()`, `mountVistaMeet()`
- [ ] `MPskinAdapter` implementieren (wenn SDK-Zugriff vorhanden)
- [ ] `StandaloneAdapter` als Default — Fallback wenn kein `HostIntegration` injiziert
- [ ] Adapter via Dependency Injection: `embed.js` akzeptiert optional `hostIntegration`

### Dokumentation für Partner

- [ ] Standalone Mode vollständig dokumentiert
- [ ] Partner Mode Spec für MPskin: was braucht MPskin um den Adapter zu bauen?
- [ ] Integration-Guide für MPskin-Entwickler
- [ ] SDK-Context Übergabe testen: kann MPskin-Runtime direkt übergeben werden?

### Production Readiness

- [ ] Performance Audit: Lighthouse Score > 80 (LCP, CLS, FID)
- [ ] Memory Leak Test: 30min Meeting — Memory-Profil aufzeichnen
- [ ] Load Test: 10 simultane Teilnehmer
- [ ] Production Environment auf Vercel deployen
- [ ] Monitoring Alerts: Sentry — kritische Fehler → sofortige Notification

### Exit-Kriterien

- [ ] Standalone Mode funktioniert vollständig unabhängig von MPskin
- [ ] Partner-Spec ist klar genug für externen Entwickler
- [ ] Lighthouse Score > 80
- [ ] 30min Meeting ohne Memory Leak
- [ ] Production deployed und erreichbar

---

## Presence System Detail

### Trennung der Verantwortlichkeiten

```
LiveKit          = Audio/Video Tracks
DataChannel      = AvatarState Transport  
MatterportRuntime = Darstellung in der 3D-Szene
```

Nie vermischen. Jede Schicht kennt nur ihre Aufgabe.

### Update-Flow (Schritt für Schritt)

```
1. User bewegt sich in Matterport → onCameraChanged() feuert
2. CameraPose → AvatarState konvertieren
3. AvatarState.timestamp = Date.now()
4. PresenceTransport.broadcast()
   → MessagePack encode (msgpackr)
   → DataChannel.publishData()
5. Remote-Seite: onDataReceived()
   → MessagePack decode
   → State-Store update (Zustand)
6. State-Store → React re-render
   → ObjectLayer.updateObject()
7. Matterport-Scene zeigt neue Position
```

### Throttling & Performance

| Parameter | Wert | Begründung |
|---|---|---|
| Broadcast-Rate | 20 updates/s (50ms Interval) | Smooth genug, nicht zu viel Traffic |
| Payload-Größe | ~40 Bytes nach MessagePack | 3-5x kleiner als JSON |
| 10 User @ 20hz | ~400 Bytes/s pro User | Unkritisch für DataChannel |
| Rendering | 60fps via `requestAnimationFrame` | Interpolation zwischen 50ms-Updates |

### Stale State & Edge Cases

| Situation | Verhalten |
|---|---|
| Kein Update seit 5s | Avatar ausblenden |
| User verlässt Meeting | `onParticipantsChanged()` → Avatar sofort entfernen |
| Reconnect | Alle Remote-Avatare kurz ausblenden → auf neues State warten |
| Tab Suspend | Eigener Avatar pausiert Broadcast, Remote sieht Stale-Detection |
| Speaking-Event | Sofortige Übertragung — nicht auf nächsten Throttle-Tick warten |

---

## Meilensteine

### Meilenstein 1 — Stabiles Browser-Meeting (Ende Sprint 2)

> Zwei Nutzer können sich treffen. Audio/Video läuft. Token kommt vom Backend.

- [ ] Zwei Nutzer sehen und hören sich
- [ ] Reconnect nach Netzwerkabbruch funktioniert
- [ ] Token wird nur vom Backend generiert
- [ ] Rate Limiting aktiv
- [ ] Kein Secret im Frontend-Bundle

### Meilenstein 2 — Matterport in kontrollierter Runtime (Ende Sprint 4)

> SDK-Bundle vom eigenen CDN. Objekte platzierbar. API-Key sicher auf dem Server.

- [ ] Bundle lädt vom eigenen CDN
- [ ] Kamera-Events funktionieren
- [ ] Avatar-Placeholder platzierbar
- [ ] API-Key nicht im Frontend-Bundle
- [ ] `dispose()` ohne Memory Leak

### Meilenstein 3 — Avatar-Dummy bei beiden Nutzern synchron (Ende Sprint 5)

> Latenz unter 100ms. Smooth Movement. Speaking-Indikator synchronisiert.

- [ ] Position synchron in beiden Browsern
- [ ] Latenz gemessen: unter 100ms
- [ ] Smooth Movement ohne Ruckeln
- [ ] Speaking-Indikator synchron
- [ ] Playwright-Test automatisiert grün

### Meilenstein 4 — Embed auf externer Seite (Ende Sprint 7)

> Ein Dritter kann mit 3 Zeilen Code eine Vista-Meet-Session starten.

- [ ] Embed auf externer Domain läuft
- [ ] Domain-Validierung aktiv
- [ ] `embed.js` unter 15kb
- [ ] Partner-Dokumentation fertig
- [ ] `HostIntegration` Interface für MPskin definiert

---

> **Kein Meilenstein gilt als erreicht ohne alle Punkte erfüllt. Kein "fast fertig".**
