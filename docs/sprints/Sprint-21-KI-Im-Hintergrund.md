# Sprint 21 – KI im Hintergrund, nicht als Produkt

**„Ich beschreibe mein Wunschfahrzeug – nicht: Ich führe ein Gespräch mit einer KI.“**

## Ziel

Clever-Neuwagen verkauft keine KI-Beratung. Die KI arbeitet unsichtbar im Hintergrund. Der Nutzer erlebt **Suche**, nicht **Beratung**.

## Erfolgskriterium

Der Nutzer sagt beim Verlassen: *„Ich habe schnell passende Fahrzeuge gefunden.“* – nicht *„Die KI hat mich beraten.“*

## Umgesetzt

| # | Anforderung | Umsetzung |
|---|-------------|-----------|
| 1 | Hero neu | Headline, Subline, Label „Was suchst du?“, klickbare Beispiele |
| 2 | Kein KI-Chat auf Startseite | Kein 💬-Rotator, keine Berater-Sprache, kein Mikrofon-Chat |
| 3 | KI unsichtbar auf Ergebnisseite | `aria-label` ohne „KI“, Footer-Tagline angepasst |
| 4 | Keine leere Seite | `NoExactMatchPanel` + `searchFallbackService.js` |
| 5 | Chat nur optional unten | `ResultsQuestionLink` → `/assistant?from=results` |
| 6 | Standort-Bugfix | User-Ort filtert nicht mehr fälschlich Fahrzeuge per Textmatch |

## Kern-Dateien

- `src/components/landing/LandingHero.jsx`
- `src/logic/searchFallbackService.js`
- `src/components/search/SearchFlowComponents.jsx`
- `src/pages/FahrzeugePage.jsx`
- `src/components/layout/Footer.jsx`

## Status

✅ Sprint 21 abgeschlossen
