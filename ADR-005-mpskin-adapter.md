# ADR-005 — MPskin ist ein Adapter, kein Fundament

**Status:** Accepted  
**Datum:** 2026  
**Bereich:** Partnerschaft / Architektur

---

## Kontext

Eine potenzielle Partnerschaft mit MPskin könnte es ermöglichen, dass Vista Meet in MPskins bestehende Matterport-Runtime eingebettet wird.

## Entscheidung

Vista Meet funktioniert **immer vollständig im Standalone Mode**. MPskin-Integration ist ein optionaler Adapter in Phase 7 und niemals eine Voraussetzung.

```
embed.js
  └── if (config.hostIntegration) → Partner Mode
  └── else                        → Standalone Mode
```

## Begründung

- Eine Partnerschaft ist ein Business-Deal, kein technisches Fundament
- Wenn MPskin scheitert oder die Partnerschaft endet, bleibt das Produkt voll funktionsfähig
- Standalone Mode = unabhängige Marktposition

## Konsequenzen

- `HostIntegration` Interface ist definiert und dokumentiert — MPskin kann es implementieren
- Kein Core-Code hat Branches für "MPskin vs. standalone"
- Zwei Deliverables: Produkt (immer) + MPskin-Adapter (optional)
