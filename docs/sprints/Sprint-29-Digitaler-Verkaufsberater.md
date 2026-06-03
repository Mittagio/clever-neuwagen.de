# Sprint 29 – Digitaler Verkaufsberater

## Ziel

Clever-Neuwagen versteht Wünsche – kein Carwow-Konfigurator. Der Kunde wählt Bedürfnisse, das System findet Ausstattung, Pakete, Preis und Händler.

## Kern-UX

| Element | Komponente |
|---------|------------|
| Nächste Schritte | `AdvisorNextSteps` – Preis, Wunschauto, Händler |
| Wunschauto bauen | `WishBuilderCard` – Checkliste + Chips, ✨ Branding |
| Clever-Analyse | `CleverAnalysisPanel` – „4 von 4 Wünschen“ |
| Paket-Erklärung | `PackageRecommendationCard` – Wunsch → Paket → Bonus → Preis |
| Empfehlung | `CleverRecommendationCard` – günstigere Variante |
| Alternativen | `WishBasedAlternatives` – wunschbasierter Fahrzeugvergleich |

## Services

- `wishAdvisorService.js` – `buildWishFulfillment`, `buildWishBasedAlternatives`
- `featureResolver.js` – erweitert um Baseline-/Neupreis für Pakete

## Preis-Regel

`paymentMode` steuert **alle** Preisanzeigen (Hero, Sticky, Paket, Alternativen, Händler). Bei `cash` nie `/Monat`.

## Titel-Logik

Mit aktiven Wünschen: **„Kia EV3“** statt „GT-Line / Earth / Air“ – Trim nur als Empfehlung im Berater-Flow.

## Test

`/fahrzeug/kia-ev3-gt-line?wunsch=1` – Wünsche wählen, Analyse-Box, Paketempfehlung, Kaufpreis wechseln.
