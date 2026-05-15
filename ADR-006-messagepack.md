# ADR-006 — MessagePack für AvatarState Serialisierung

**Status:** Accepted  
**Datum:** 2026  
**Bereich:** Presence / Performance

---

## Kontext

Der `AvatarState` wird 20x pro Sekunde pro User über den LiveKit DataChannel gesendet.

## Entscheidung

`AvatarState` wird via **MessagePack** (Library: `msgpackr`) serialisiert, nicht JSON.

## Begründung

- MessagePack produziert 3-5x kleinere Binär-Payloads als JSON für numerische Daten
- Bei 20 updates/s, 10 Usern, 40 Bytes/Update: ~8 KB/s vs. ~30 KB/s mit JSON
- `msgpackr` ist die schnellste MessagePack-Implementierung für Node/Browser

## Konsequenzen

- `encode`/`decode` liegen isoliert in der Adapter-Implementierung
- Debugging: Payloads sind nicht direkt lesbar → Decode-Hilfstool für Development
- Beide Seiten (send + receive) müssen dieselbe Schema-Version nutzen

## Alternativen die verworfen wurden

- **JSON:** Einfacher zu debuggen, aber 3-5x größere Payloads bei 10+ Usern spürbar
- **Protobuf:** Zu viel Schema-Overhead. MessagePack löst das Problem ausreichend.
- **Eigenes Binärformat:** Unnötige Komplexität.
