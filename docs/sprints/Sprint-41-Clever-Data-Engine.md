# Sprint 41 – Clever Data Engine (Phase 2)

## Regel

Die KI beantwortet **keine Fahrzeugfragen aus Freitext**. Sie durchsucht ausschließlich strukturierte `CleverVehicleRecord`-Daten.

Fehlende Eigenschaft → `unknown` – **nicht schätzen, nicht raten**.

## Schema

Siehe `src/data/clever/cleverVehicleRecord.js` – Felder: Basis, Elektro, Familie, Anhänger, Abmessungen, Komfort, Clever Attribute (1–10).

## CleverQuote v2

| Anteil | Quelle |
|--------|--------|
| 50 % | Wunschtreffer (Rule Engine + Clever Record) |
| 20 % | Budget |
| 15 % | Verfügbarkeit |
| 10 % | Kategorie (Clever Attribute) |
| 5 % | Beliebtheit |

## Golden Cases

- **EV9** + Elektro + 7 Sitze + 2 t Anhängelast → ~100 %
- **Sorento PHEV** + gleiches Profil → ~82 % (nicht vollelektrisch)

## Code

- `src/data/clever/` – Records + Registry
- `src/services/cleverData/cleverDataEngine.js` – Abfrage, keine KI
- `src/services/cleverQuote/cleverQuoteV2.js` – Gewichtung
- Tests: `cleverDataEngine.test.js`, `cleverQuoteV2.test.js`
