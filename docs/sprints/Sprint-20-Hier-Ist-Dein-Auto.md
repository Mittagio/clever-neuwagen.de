# Sprint 20 – „HIER IST DEIN AUTO“

**„Die KI empfiehlt mir mein Auto – nicht 20 Filter.“**

## Ziel

Die Ergebnisseite (`/fahrzeuge`) fühlt sich wie eine persönliche KI-Empfehlung an – nicht wie mobile.de, Leasingmarkt oder AutoScout.

## Mentaler Test

Erster Gedanke beim Öffnen: *„Oh, die KI empfiehlt mir einen Sportage.“* – nicht *„Oh, hier sind 20 Filter.“*

## Neue Reihenfolge

| # | Bereich | Inhalt |
|---|---------|--------|
| 1 | KI-Zusammenfassung | Headline „Das könnte zu Ihnen passen.“, Lifestyle-Chips (Familie, Hund, km/Jahr, Ort, Budget) – editierbar, kompakt |
| 2 | Beste Empfehlung | Große Hero-Karte: Bild, Rate, Entfernung, Verfügbarkeit, Rabatt, CTA |
| 3 | Weitere Fahrzeuge | Horizontale Karten (Bild, Rate, Entfernung, Rabatt, Button) |
| 4 | Ergebnisse anpassen | Laufzeit, Kilometer, Radius, Sortierung – **optional, ganz unten** |

## Umgesetzt

| # | Anforderung | Umsetzung |
|---|-------------|-----------|
| 1 | Hero-Zusammenfassung | `KiSummaryHero` mit Headline + Lifestyle-Chips |
| 2 | Chips aus Beschreibung | `buildLifestyleSummaryChips()` – Familie, Hund, km, Ort, Budget |
| 3 | Empfehlung zuerst | `TopRecommendationCard` mit großem Bild und emotionaler Typo |
| 4 | Horizontale Alternativen | `HorizontalVehicleStrip` |
| 5 | Filter nach unten | `AdjustResultsPanel` (collapsible `<details>`) |
| 6 | Kein Filter-Look oben | Alte `OfferFilterChips` nicht mehr oberhalb der Empfehlung |

## Kern-Dateien

- `src/pages/FahrzeugePage.jsx`
- `src/components/search/SearchFlowComponents.jsx`
- `src/components/search/SearchFlowComponents.css`
- `src/logic/oneSearchService.js` – `buildLifestyleSummaryChips()`

## Status

✅ Sprint 20 abgeschlossen
