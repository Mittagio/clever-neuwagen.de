# Sprint 32 – KI-Verkaufsarbeitsplatz / Gesprächsmodus

## Vision

Der Verkäufer führt das Gespräch – Clever-Neuwagen erkennt Wünsche, findet Fahrzeuge, berechnet CleverQuote und schreibt die Kundenkommunikation. Alles in einem Flow, ohne externe Tools.

## Einstieg

| Route | Label |
|-------|--------|
| `/gespraech` | Gesprächsmodus (primär) |
| `/sales/smart` | Smart Sales / Kundenberatung |

Backend-Schnellaktion: **Gesprächsmodus**

## Features

### Eingabe
- **Spracheingabe** – „Gespräch aufnehmen“ erkennt Kunde, SUV, Budget, km/Jahr, Features
- **Chip-Auswahl** – Fahrzeugtyp, Antrieb, Budget, Kilometer, Ausstattung, Alltag
- **Live-Chips** – editierbar oben, während Sprechen/Klicken

### Bedarfsanalyse
- „Wir haben verstanden“ mit empfohlener Fahrzeugklasse
- Button „Fahrzeuge finden“

### Ergebnisse & Vergleich
- Top 5 mit CleverQuote, Podium, „Zum Vergleich hinzufügen“
- Schnellvergleich (relevante Daten only)
- Desktop: 3-Spalten (Wünsche | Fahrzeuge | Auswahl + Kommunikation)

### Kommunikationscenter
- WhatsApp & E-Mail – **bearbeitbare Texte**
- **KI-Textassistent** (regelbasiert): professioneller, kürzer, Feature-Hinweise
- Spracheingabe für Text-Anpassung
- PDF, Link, QR-Code

### Kundenakte
- Automatisches Speichern: Wünsche, Fahrzeuge, Versandkanäle, nächster Schritt
- localStorage (`cn-conversation-records`)

### Kunden-Vergleichslink
- `/vergleich/:token` – Fahrzeuge, CleverQuote, Anfrage bestätigen, Rückfrage

### KPIs (heute)
- Beraten, Angebote versendet, QR-Codes, Vergleich geöffnet, Angebot angesehen, Rückmeldungen offen

## Tests

```bash
npm run test:conversation
npm run test:smart-sales
npm run deploy:check
```

## Begriffe

✅ Kunde, Beratung, Wünsche, Angebote, Vergleich, Rückmeldung  
❌ Lead, Funnel, Pipeline, CRM
