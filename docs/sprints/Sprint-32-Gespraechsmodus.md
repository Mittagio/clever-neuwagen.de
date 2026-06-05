# Sprint 32 – KI-Verkaufsarbeitsplatz / Gesprächsmodus

## Vision

Der Verkäufer führt das Gespräch – Clever-Neuwagen erkennt Wünsche, findet Fahrzeuge, berechnet CleverQuote und schreibt die Kundenkommunikation. Alles in einem Flow, ohne externe Tools.

## Einstieg

| Route | Label |
|-------|--------|
| `/gespraech` | Gesprächsmodus (primär) |
| `/sales/smart` | Smart Sales / Kundenberatung |
| `/fahrzeuge` | Discovery-Suche (Backend-sync) |
| `/fahrzeug/:slug` | Fahrzeugdetail via Backend-Slug |
| `/vergleich/:token` | Kunden-Vergleichslink |

Backend-Schnellaktion: **Gesprächsmodus**

## Berater-Pipeline (3 Schichten)

**Prinzip:** OpenAI ist nicht die Wahrheit – die Fahrzeugdatenbank ist die Wahrheit. OpenAI übersetzt nur Sprache in Suchparameter.

```
Kunde schreibt → SearchProfile JSON → Rule Engine (Trim-DB) → CleverQuote → Erklärung
```

| Schicht | Datei | Aufgabe |
|---------|-------|---------|
| 1 Parser | `searchIntentParser.js`, `openAiIntentParser.js` | Kundentext → `SearchProfile` (Structured Output) |
| 2 Wörterbuch | `customerFeatureDictionary.js`, `canonicalFeatureIds.js` | Kundenbegriff → Feature-ID |
| 3 Rule Engine | `vehicleFeatureRuleEngine.js`, `trimFeatureMapping.js`, `kiaModelAttributes.js` | Jedes Trim prüfen (✓/✗ pro Merkmal) |
| 4 Ranking | `cleverSearchPipeline.js`, `cleverQuoteService.js` | CleverQuote % + Modelllinien |

Test: `npm run test:feature-rules` (Beispiel: EV3 GT-Line 100 %, EV3 Earth ~60 %)

1. **Intent Parser** – regelbasiert; optional OpenAI (nur Profil, keine Fahrzeugauswahl)
2. **Vehicle Facts + harte Ausschlussregeln** – `hardExclusionRules.js`, `kiaModelAttributes.js`
3. **CleverQuote-Ranking + Erklärung** – `advisorRanking.js`, Spread ca. 68–100 %

Zentral: `cleverSearchPipeline.js` → Modelllinien via `modelLineGroups.js` (Trim-Deduplizierung: Air, Earth, GT-Line pro Modellkarte).

## Backend-API (`/api/v1/advisor/*`)

| Endpoint | Zweck |
|----------|--------|
| `POST /advisor/search` | Discovery-Suche (Clever-Search-Pipeline) |
| `POST /advisor/sales` | Gesprächsmodus (Chips → Ergebnisse) |
| `GET /advisor/vehicles/:slug` | Fahrzeugdetail inkl. CleverQuote |
| `POST /advisor/share` | Vergleichslink anlegen |
| `GET /advisor/share/:token` | Kunden-Vergleich laden |
| `POST /advisor/share/:token/inquiry` | Kundenanfrage bestätigen |
| `GET/POST/PATCH /advisor/customer-records` | Kundenakten (serverseitig) |
| `GET /advisor/customer-shares?email=` | Share-Sessions pro Kunden-E-Mail |
| `GET/POST/PATCH /pilot/leads` | Pilot-Leads |

Server: `advisorEngine.js`, `advisorRoutes.js`, `advisorShareStore.js`, `sharePilotLeadSync.js`, `customerRecordsStore.js`.

Client-Services: `src/services/advisor/` (API, Discovery-Hook, Vehicle-Client, Share→Lead-Sync).

### OpenAI (optional)

- Env: `OPENAI_API_KEY`, `ADVISOR_USE_OPENAI=true`
- Request-Body: `{ "useOpenAi": true, "query": "..." }`
- Response-Feld: `profileSource` (`local` | `openai` | `local_fallback`)

## Features

### Eingabe
- **Spracheingabe** – „Gespräch aufnehmen“ erkennt Kunde, SUV, Budget, km/Jahr, Features
- **Chip-Auswahl** – Fahrzeugtyp, Antrieb, Budget, Kilometer, Ausstattung, Alltag
- **Live-Chips** – editierbar oben, während Sprechen/Klicken
- **Keine Default-Chips** – 10.000 km / 48 Monate nur bei explizitem Kundenwunsch

### Bedarfsanalyse
- „Wir haben verstanden“ mit empfohlener Fahrzeugklasse
- Bei nur „Elektro“: Nachfrage (Stadt / Familie / Langstrecke / Gewerbe) vor Ergebnissen
- Button „Fahrzeuge finden“

### Ergebnisse & Vergleich
- Modelllinien-Karten mit aufklappbaren Varianten (Trim)
- Top 5 mit CleverQuote, Podium, „Zum Vergleich hinzufügen“
- Vergleichende „Warum?“-Begründungen (nicht generisch)
- Schnellvergleich (relevante Daten only)
- Desktop: 3-Spalten (Wünsche | Fahrzeuge | Auswahl + Kommunikation)

### Kommunikationscenter
- WhatsApp & E-Mail – **bearbeitbare Texte**
- **KI-Textassistent** (regelbasiert): professioneller, kürzer, Feature-Hinweise
- Spracheingabe für Text-Anpassung
- PDF, Link, QR-Code

### Kundenakte
- Serverseitig: `/advisor/customer-records` (JSON-Store, später DB)
- Share erstellen → Pilot-Lead (Status „Angebot versendet“) + Akten-Entwurf
- Kundenanfrage bestätigt → Lead „Neu“, Akte `inquiryConfirmed`
- localStorage weiterhin als Offline-Fallback

### Kunden-Vergleichslink
- `/vergleich/:token` – lädt vom Server, Modelllinien mit Ausstattungen, CleverQuote, Anfrage bestätigen, Rückfrage

### KPIs (heute)
- Beraten, Angebote versendet, QR-Codes, Vergleich geöffnet, Angebot angesehen, Rückmeldungen offen

## Erwartetes Verhalten (Elektro + Familie)

- Chips: Elektro (+ Familie), **ohne** km/Laufzeit-Defaults
- Liste: EV2, EV3, EV4, EV5, EV6, EV9 – je eine Modellkarte
- EV3: Air, Earth, GT-Line aufklappbar
- CleverQuote: differenziert (68–96 %)
- 7-Sitzer: kein EV2/EV3/EV4; Sorento/EV9

## Tests

```bash
npm run test:advisor-api
npm run test:share-lead
npm run test:vehicle-detail-api
npm run test:customer-records
npm run test:smart-sales
node src/services/search/cleverSearchPipeline.test.js
node src/services/search/modelLineGroups.test.js
npm run test:conversation
npm run deploy:check
```

Pilot lokal: `npm run dev:pilot`

Pilot-Flow Smoke (API): `npm run test:pilot-flow`

## JSON-Stores (Pilot-Persistenz)

Berater-Daten liegen serverseitig in JSON-Dateien unter `data/` (gitignored). Einheitliche Schicht: `server/jsonStore.js`.

| Datei | Inhalt |
|-------|--------|
| `advisor-share-sessions.json` | Vergleichslinks, TTL 14 Tage |
| `pilot-leads.json` | Pilot-Leads aus Share/Gespräch |
| `customer-records.json` | Kundenakten (max. 200) |

**VPS:** Persistenz außerhalb des Deploy-Verzeichnisses:

```bash
export PILOT_DATA_DIR=/var/lib/clever-neuwagen/data
```

Diagnose: `GET /api/v1/advisor/storage` (Pfad, Dateigrößen).

Schreibvorgänge atomar (tmp + rename). Spätere DB-Migration ersetzt nur `jsonStore.js` – Stores bleiben API-kompatibel.

## Offen / nächste Schritte

- VPS: nach `git pull` → `bash deploy/update-app.sh` (legt `PILOT_DATA_DIR` an)
- Optional: SQLite/Postgres hinter `createJsonStore` (gleiche Store-APIs)

## Begriffe

✅ Kunde, Beratung, Wünsche, Angebote, Vergleich, Rückmeldung  
❌ Lead, Funnel, Pipeline, CRM
