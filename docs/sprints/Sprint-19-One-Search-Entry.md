# Sprint 19 – ONE SEARCH ENTRY

**„Ein Einstieg. Eine Suche. Ein Flow.“**

## Ziel

Ein Einstieg, eine Suche, ein Flow – der Nutzer beschreibt sein Wunschauto und erhält passende Angebote. Keine Trennung KI-Beratung vs. Fahrzeugsuche.

## Golden Rule

Landing → KI-Chips → `/fahrzeuge` → `/angebot/:code` → Anfrage → Mein Bereich

## Umgesetzt

| # | Anforderung | Umsetzung |
|---|-------------|-----------|
| 1 | Navigation vereinfacht | Header: Fahrzeuge finden · Für Händler · Login |
| 2 | Hero = Suche | Landing nur Hero, Headline/Subline/Beispiele laut Spec |
| 3 | Immer `/fahrzeuge` | Landing + `/berater?start=1` → Redirect |
| 4 | KI-Chips editierbar | `SearchUnderstandingChips` auf FahrzeugePage |
| 5 | Standort-Flow | `LocationPromptDialog`, Standard 25 km |
| 6 | Top-Empfehlung | Große `TopRecommendationCard` |
| 7 | Angebots-Chips | Laufzeit, km, Radius, Sortierung – live Update |
| 8 | Angebot → `/angebot/:code` | `offerCode` + Redirect von `/fahrzeug/` |
| 9 | Kundenkonto | Bestehend (Sprint 17) – unverändert |
| 10 | Händler unsichtbar | Kein Backend in Kundenflow |

## Kern-Dateien

- `src/logic/oneSearchService.js`
- `src/components/search/SearchFlowComponents.jsx`
- `src/pages/FahrzeugePage.jsx`
- `src/components/landing/LandingHero.jsx`
- `src/pages/LandingPage.jsx`

## Status

✅ Sprint 19 abgeschlossen
