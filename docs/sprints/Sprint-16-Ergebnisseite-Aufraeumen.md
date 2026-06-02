# Sprint 16 – Ergebnisseite aufräumen (Trade Republic / Airbnb Stil)

**Autos zuerst. Filter danach.**

## Änderungen

| Bereich | Vorher | Nachher |
|---------|--------|---------|
| Such-Chips | Boxen mit Rahmen | Kleine Chips mit Emoji, transparent |
| Bester Treffer | Grüne Akzente überall | Neutral (weiß/grau), Akzent nur Rate + Verfügbarkeit + CTA |
| Grid | Grüne CTAs | Neutrale Outline-Buttons, weniger Text |
| Filter | „Ergebnisse anpassen“, SAP-Optik, Großbuchstaben | „⚙ Suche verfeinern“, eingeklappt, dezente Chips |

## Filter (eingeklappt)

- Laufzeit · Kilometer · Radius · Sortierung
- Labels in normaler Schrift
- Aktiv: schwarz statt grün
- Keine Container, keine Trennlinien

## Kern-Dateien

- `src/components/search/SearchFlowComponents.jsx`
- `src/components/search/SearchFlowComponents.css`
- `src/logic/oneSearchService.js` – `REFINE_*` Optionen

## Status

✅ Abgeschlossen
