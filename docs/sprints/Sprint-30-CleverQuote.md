# Sprint 30 – CleverQuote™ (USP Passungs-Bewertung)

## Ziel

Clever-Neuwagen sortiert nicht nach Inseraten, sondern nach **Passung zum Kunden**. CleverQuote™ ist die zentrale Bewertung – wichtiger als Rabatt, Rate und Händler.

## Umsetzung

### Service

- `src/services/cleverQuote/cleverQuoteService.js`
  - Gewichtete Berechnung pro Wunsch (z. B. Reichweite 40 %, 360°-Kamera 20 %)
  - Tier-Labels: Perfekter Treffer (≥95 %), Sehr gut (≥85 %), Gutt (≥70 %), Alternative (≥50 %), Nur bedingt passend (<50 %)
  - `computeCleverQuote`, `sortByCleverQuote`, Paket-Upgrade-Hinweis

### Matching

- `wishMatchEngine.js`: CleverQuote an Matches, Sortierung nach Passung wenn Wünsche aktiv

### UI

| Bereich | Komponente |
|---------|------------|
| Ergebnisse | `CleverQuoteBadge`, Headline „Die besten Fahrzeuge für Ihre Wünsche“ |
| Hero-Karte | CleverQuote unter Modellname |
| Grid-Karten | CleverQuote + „Warum X %?“ |
| Detailseite | CleverQuote unter Titel, Breakdown-Modal |
| Paket-Empfehlung | Quote vor/nach Paket (84 % → 96 %) |
| Vergleich | `CleverQuoteCompareCards` nach Passung |

### Tests

```bash
npm run test:clever-quote
npm run deploy:check
```

## Marketing-USP

**CleverQuote™** – Wie gut passt dieses Fahrzeug wirklich zu Ihnen? Digitale Kaufberatung statt reiner Fahrzeugsuche.
