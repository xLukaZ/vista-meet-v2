# ADR-004 — Adapter-Pattern für alle externen Services

**Status:** Accepted  
**Datum:** 2026  
**Bereich:** Architektur

---

## Kontext

Vista Meet integriert mehrere externe Services: LiveKit (Audio/Video), Matterport (3D), und potenziell weitere. Es muss eine Strategie für diese Abhängigkeiten gewählt werden.

## Entscheidung

Jeder externe Service wird hinter einem **TypeScript Interface** abstrahiert. Konkrete Implementierungen liegen in `adapters/`-Unterordnern, nie direkt im Core.

```
packages/meeting-core/
  MeetingClient.ts             ← Interface
  adapters/
    livekit/
      LiveKitMeetingClient.ts  ← Implementierung

packages/presence-core/
  PresenceTransport.ts         ← Interface
  adapters/
    datachannel/               ← Implementierung
```

## Begründung

- Austausch eines externen Services erfordert nur eine neue Adapter-Implementierung
- Testing: Interfaces können einfach gemockt werden ohne echte Verbindungen
- Dokumentiert Abhängigkeiten explizit — kein versteckter Vendor Lock-in

## Konsequenzen

- Jede neue externe Abhängigkeit muss zuerst als Interface definiert werden
- Kein direkter Import von `@livekit/client` außerhalb von `packages/meeting-core/adapters/livekit/`
- Kein direkter Matterport-SDK-Aufruf außerhalb von `packages/matterport-runtime/`
