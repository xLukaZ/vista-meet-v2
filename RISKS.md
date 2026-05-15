# Vista Meet — Risikoregister

> Risiken die nicht dokumentiert sind, werden nicht gemanagt. Dieses Dokument wird laufend aktualisiert.

---

| Priorität | Risiko | Wahrscheinlichkeit | Sprint | Mitigation |
|---|---|---|---|---|
| 🔴 HOCH | Matterport SDK API-Änderung | Mittel | S3+ | Alle SDK-Calls hinter `MatterportRuntime` Interface. Update-Kosten: ein Adapter, nicht die ganze App. |
| 🔵 NIEDRIG | LiveKit DataChannel Kapazitätslimit | Sehr niedrig | S8 | Hartes Limit: 10 User pro Room in Phase 1. Bei Bedarf später erhöhen via `PresenceTransport`-Interface-Austausch. Kein aktuelles Problem. |
| 🟡 MITTEL | Browser-Kompatibilität: WebRTC + Matterport | Mittel | S1, S3 | Cross-Browser-Tests ab Sprint 1. Minimum-Matrix definieren: Chrome/Edge/Firefox Desktop, Safari Desktop. Mobile: Best-Effort. |
| 🟡 MITTEL | MPskin-Partnerschaft scheitert | Mittel | S8 | Standalone Mode ist das Produkt. MPskin ist ein Bonus. `HostIntegration` Interface ist definiert — wenn sie es nutzen wollen, können sie. |
| 🟡 MITTEL | Performance: Matterport + WebRTC gleichzeitig überhitzt Mid-Range-Laptops | Mittel | S6, S8 | Performance-Profiling ab Sprint 6. Qualitäts-Einstellungen: Low/Medium/High Mode. Matterport-Qualität automatisch reduzieren wenn Meeting aktiv. |
| 🔵 NIEDRIG | Matterport API-Kosten bei Scale | Niedrig | S3 | Pricing-Modell in Sprint 3 verstehen. Option: eigene Matterport-Credentials pro Partner erlauben. Kosten weitergeben. |
| 🔵 NIEDRIG | Token-Leakage durch versehentliches `localStorage` | Niedrig | S2 | `httpOnly` Cookies sind Pflicht. ESLint-Regel warnt bei `localStorage`-Zugriff auf Token-Keys. In `CONTRIBUTING.md` dokumentiert. |

---

## Detail: Matterport SDK API-Änderung

**Risiko:** Matterport ändert die Scene Graph API ohne Vorwarnung. Object-Placement oder Kamera-Events brechen.

**Warum es passieren kann:** Matterport ist ein geschlossenes System mit eigenem Release-Zyklus. Breaking Changes sind dokumentiert, aber nicht immer mit langer Vorlaufzeit.

**Mitigation:**
- `MatterportRuntime` und `MatterportObjectLayer` Interface abstrahieren alle SDK-Calls vollständig
- SDK-Bundle ist versioniert auf unserem CDN — wir kontrollieren den Upgrade-Zeitpunkt
- Bei Breaking Change: nur `adapters/matterport-sdk-vX/` anpassen, kein App-Code betroffen
- SDK-Version in `bundle-loader.ts` explizit pinnen, kein `latest`

---

## Detail: LiveKit DataChannel Kapazität

**Risiko:** Kein aktives Risiko in Phase 1 — hartes Limit von 10 Usern pro Room.

**Warum es kein Problem ist:**
- 20 updates/s × ~40 Bytes MessagePack = 800 Bytes/s pro User
- Bei 10 Usern: 10 × 9 × 800B = ~72 KB/s total im Room — völlig unkritisch
- LiveKit DataChannel unterstützt mehrere MB/s — das ist unkritisch

**Fallback wenn doch:**
- `PresenceTransport` Interface erlaubt Austausch ohne App-Code-Änderung
- Eigener WebSocket-Server als `WebSocketPresenceTransport` Implementierung
- Update-Rate dynamisch reduzieren basierend auf Teilnehmerzahl

---

## Detail: Performance auf Mid-Range-Hardware

**Risiko:** GPU-Last von Matterport (3D-Rendering) + CPU-Last von WebRTC (Video-Encoding) überlasten normale Laptops.

**Messung ab Sprint 6:**
```
Test-Hardware: Intel Core i5, 8GB RAM, Intel UHD Graphics
Metriken: CPU %, GPU %, Memory, Frame-Rate
Szenarien: 2 User, 5 User, 10 User
```

**Mitigation-Optionen:**
1. Matterport Render-Qualität bei aktivem Meeting reduzieren (Low Quality Mode)
2. Eigene Video-Auflösung automatisch auf 360p senken bei hoher CPU-Last
3. Avatar-Update-Rate von 20hz auf 10hz reduzieren bei schlechter Performance
4. Qualitäts-Einstellungen manuell für den User wählbar machen
