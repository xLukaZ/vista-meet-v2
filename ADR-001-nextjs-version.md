# ADR-001 — Next.js 14 statt Next.js 15

**Status:** Accepted  
**Datum:** 2026  
**Bereich:** Frontend

---

## Kontext

Für die Vista-Meet-Web-App muss eine Next.js-Version gewählt werden. Zum Zeitpunkt der Entscheidung ist Next.js 15 verfügbar, aber erst seit kurzem stable.

## Entscheidung

Wir verwenden **Next.js 14** (`^14.2.x`) mit React 18.

## Begründung

- Next.js 14 ist battle-tested mit großer Community-Coverage für Bugs und Security Issues
- App Router ist in v14 ausgereift — keine instabilen APIs im kritischen Meeting-Pfad
- Security kommt von Stabilität und gepatchten Dependencies, nicht von der Versionsnummer
- Next.js 15 bringt keine Features die wir für den initialen Launch benötigen

## Konsequenzen

- Upgrade auf Next.js 15 ist geplant — in einem eigenen Sprint nach Milestone 3
- Bis dahin: Dependabot hält Minor/Patch Updates auf v14 aktuell

## Alternativen die verworfen wurden

- **Next.js 15:** Zu neu für Produktionssystem das wir jetzt aufbauen. Ecosystem noch nicht vollständig stabil.
- **Vite + React SPA:** Kein SSR, kein App Router, kein Middleware-Layer. Zu viel selbst bauen.
