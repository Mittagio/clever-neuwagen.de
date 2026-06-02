# Sprint – Standort-Flow entschärfen

**Standort ist eine Verbesserung – keine Voraussetzung.**

## Problem

Standort-Modal blockierte die Ergebnisseite wie ein Cookie-Banner.

## Lösung

- Ergebnisse **sofort** sichtbar (deutschlandweit ohne Standort)
- **Kein Overlay**, kein Pflicht-Popup
- Inline-Karte `LocationHintCard` direkt über den Fahrzeug-Ergebnissen

### Ohne Standort

📍 Lokale Händler finden  
Aktuell werden deutschlandweite Angebote angezeigt.  
[ Standort freigeben ] · PLZ eingeben

### Mit Standort

📍 Göppingen · 25 km Radius  
[ Radius ändern ]

## Kern-Dateien

- `src/components/search/SearchFlowComponents.jsx` – `LocationHintCard`
- `src/pages/FahrzeugePage.jsx` – Modal entfernt
- `src/logic/oneSearchService.js` – `hasLocalizedSearch()`

## Status

✅ Abgeschlossen
