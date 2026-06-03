# Sprint 31 – Verkaufsberater Dashboard (Smart Sales Mode)

## Vision

Clever-Neuwagen als digitales Verkaufstool für Autohäuser: Der Verkäufer klickt Wünsche an – das System liefert passende Fahrzeuge mit CleverQuote™, Preisen und Versandoptionen in unter 60 Sekunden.

## Einstieg

- **Route:** `/sales/smart`
- **Backend:** Schnellaktion „Verkaufsberater“ auf `/backend`
- **Alias-Label:** Smart Sales

## Flow

1. **Kundenwünsche** – große Chips (Fahrzeugtyp, Antrieb, Komfort, Sicherheit, Alltag, Elektro, Budget, Verfügbarkeit)
2. **🧠 Fahrzeuge finden** – CleverQuote-Matching, Top 5
3. **Ergebnis-Podium** – 🥇🥈🥉 mit CleverQuote, Rate, Lieferzeit, erfüllte Wünsche
4. **Detail** – Leasing / Finanzierung / Kauf, Lieferzeit, Rabatt, Warum passt das Fahrzeug?
5. **Schnellvergleich** – CleverQuote, Preis, Reichweite, Kofferraum, Anhängelast, Lieferzeit
6. **Angebot erzeugen** – WhatsApp, E-Mail, PDF (Print), Link, QR-Code

## Kunden-Link

- **Route:** `/vergleich/:token`
- Persönlicher Fahrzeugvergleich mit CleverQuote und Preisen
- Session in `localStorage` (14 Tage TTL)

## Dateien

| Bereich | Pfad |
|---------|------|
| Chips | `src/data/salesAdvisorChips.js` |
| Matching | `src/services/sales/salesAdvisorService.js` |
| Share/QR | `src/services/sales/salesShareService.js` |
| Stats | `src/services/sales/salesAdvisorStats.js` |
| Page | `src/pages/SmartSalesPage.jsx` |
| Kunden-Vergleich | `src/pages/SalesCompareSharePage.jsx` |
| UI | `src/components/sales-advisor/*` |

## Tests

```bash
npm run test:smart-sales
npm run deploy:check
```

## Merksatz

Der Verkaufsberater-Modus ist keine Fahrzeugsuche – er ist digitale Bedarfsanalyse mit automatischer Fahrzeugempfehlung.
