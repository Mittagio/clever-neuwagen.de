# Sprint 22 – Wunschvergleich & Smarter Ausstattungs-Konfigurator

## Ziel

Clever-Neuwagen zeigt nicht nur Fahrzeuge, sondern beantwortet:

**Welches Fahrzeug erfüllt meine Wünsche am besten – und welcher Händler hat ein Angebot in meiner Nähe?**

## Umsetzung

### Services
- `src/services/wish/wishParser.js` – regelbasierte Wunsch-Analyse aus Freitext + URL-Features
- `src/services/wish/wishMatchEngine.js` – Scoring (Features 45 %, Budget 25 %, Entfernung 15 %, Lieferzeit 10 %, Verfügbarkeit 5 %)
- `src/services/wish/wishUrlService.js` – URL-Hilfen für Wunsch-Suche

### Daten
- `src/data/features/featureCatalog.js` – Feature-Katalog mit Aliases
- `src/data/features/trimFeatureMapping.js` – Trim → Feature-Zuordnung (Sportage, Kuga, Tucson, EV3, Niro)

### UI-Komponenten
- `WishChips`, `WishSummaryBar`, `WishMatchScore`, `WishFulfillmentList`
- `WishTopMatchCard`, `WishVehicleGridCard`
- `TrimWishComparison`, `WishCompareTable`

### Seiten
- `/fahrzeuge` – Wunsch-Ergebnisseite (Summary → Beste Empfehlung → Grid → Verfeinern)
- `/fahrzeug/:slug?wunsch=1` – Wunsch-Konfigurator mit Trim-Vergleich
- `/compare` – Wunschvergleichstabelle

## Testfälle

1. „Familien-SUV mit 360° Kamera und Anhängerkupplung bis 400 €“ → Sportage GT-Line / ähnliche mit Score
2. „Kia Sportage Vision Benziner“ → Sportage Vision Angebote
3. „Auto mit 2 Tonnen Anhängelast unter 30.000 €“ → passende Fahrzeuge oder Alternativen
4. „Elektroauto mit 1000 km Reichweite bis 500 €“ → Keine exakten Treffer + Fallback-Vorschläge
5. Wunsch „360° Kamera“ entfernen → günstigere Ausstattung empfohlen (Savings-Hint)

## Begriffe (Kunde)

- Wünsche, Passende Ausstattung, Erfüllt Ihre Wünsche, Wunschvergleich
