# ADR-002 — Presence Transport via LiveKit DataChannel

**Status:** Accepted  
**Datum:** 2026  
**Bereich:** Presence / Real-Time

---

## Kontext

Der `AvatarState` (Position, Rotation, Speaking, Muted) muss in Echtzeit zwischen allen Teilnehmern eines Rooms repliziert werden. Es muss ein Transport-Mechanismus gewählt werden.

## Entscheidung

Wir verwenden **LiveKit DataChannel** für den Presence-Transport (`publishData()` / `onDataReceived()`).

## Begründung

- Die LiveKit-Verbindung steht bereits für Audio/Video — kein zweiter Server nötig
- Sub-50ms Latenz da P2P über dieselbe WebRTC-Verbindung
- Wenn ein User nicht im Meeting ist, braucht er keine Avatar-Presence → DataChannel ist genau richtig
- Serialisierung via MessagePack hält Payloads klein (~40 Bytes pro Update)

## Konsequenzen

- `PresenceTransport` Interface abstrahiert den Transport — Austausch jederzeit möglich
- Bei Skala-Problemen (>10 User Phase 1): Fallback auf eigenen WebSocket-Server als alternative Implementierung via `PresenceTransport`-Interface — kein App-Code betroffen
- DataChannel ist unzuverlässig (UDP-ähnlich) — für Position-Updates akzeptabel

## Alternativen die verworfen wurden

- **Eigener WebSocket-Server:** Zusätzliche Infrastruktur, eigenes Reconnect-Handling, mehr Komplexität
- **Supabase Realtime:** ~200ms Latenz zu hoch für smooth Avatar-Movement. Vendor Lock-in.
- **Server-Sent Events:** Nur unidirektional. Nicht geeignet.
