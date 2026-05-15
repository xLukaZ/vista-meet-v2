# ADR-003 — Matterport SDK-Bundle selbst hosten

**Status:** Accepted  
**Datum:** 2026  
**Bereich:** Matterport / Infrastruktur

---

## Kontext

Vista Meet benötigt das Matterport SDK um die Szene zu steuern und eigene 3D-Objekte zu platzieren. Es muss entschieden werden wie und woher das SDK geladen wird.

## Entscheidung

Das **JS-Bundle** des Matterport SDK wird auf **Cloudflare R2 + CDN** gehostet. Asset-Loading (Meshes, Texturen, Modelldaten) verbleibt bei Matterport.

## Begründung

- Durch Spike bestätigt: Das JS-Bundle läuft vom eigenen CDN. Asset-Requests gehen zu Matterport-CDN — das ist das Design des SDK, kein Workaround.
- Eigenes Hosting des Bundles gibt uns Versionskontrolle: kein unkontrollierter Update durch Matterport
- Schnellere Load-Zeit durch Cloudflare CDN
- Volle Kontrolle über CSP-Header und CORS-Konfiguration

## Konsequenzen

- SDK-Version ist in `bundle-loader.ts` gepinnt — kein `latest`
- Bei Matterport SDK-Update: wir testen zuerst, dann deployen wir das neue Bundle
- Modelldaten laufen über Matterport-CDN — das ist Absicht, nicht Limitation

## Alternativen die verworfen wurden

- **Direktes Laden von Matterport:** Keine Versionskontrolle. Unkontrollierte Updates möglich.
- **Komplettes Self-Hosting inkl. Modelldaten:** Nicht möglich. Matterport-Modelldaten sind nicht redistribuierbar.
