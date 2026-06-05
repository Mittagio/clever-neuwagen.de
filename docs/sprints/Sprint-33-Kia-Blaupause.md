# Sprint 33 – Kia Blaupause (Partner-Fokus)

## Vision

Keine weiteren Marken im Verkaufsmodus. Kia wird die zentrale Blaupause für Clever-Neuwagen: Datenbank, Ausstattungslinien, Pakete, Feature-Library, CleverQuote, Händlerangebote, Dashboard und Verkäufermodus – alles Kia-first.

**Erfolgskriterium:** Ein Verkäufer findet in **60 Sekunden** passende Kia-Modelle, vergleicht sie und sendet das Angebot direkt an den Kunden.

## Zentrale Datenquelle

| Modul | Datei | Inhalt |
|-------|--------|--------|
| **Kia Partner Hub** | `src/data/kia/kiaPartnerHub.js` | Verkaufs-Pool, Trim-Lines, Pakete, Feature-Library, Modell-Übersicht |
| **Registry (voll)** | `src/data/manufacturer/manufacturerRegistry.js` | Sportage + EV3 mit CleverQuote-Paket-Auflösung |
| **Marketplace Kia** | `src/data/marketplaceVehicles.js` | Kia-Fahrzeuge inkl. EV3 Earth (neu) |
| **Händlerkatalog** | `src/data/dealerConditionsSchema.js` | EV3 aktiv, syncToLanding |

## Verkaufsmodus (nur Kia)

| Route | Verhalten |
|-------|-----------|
| `/gespraech` | Gesprächsmodus – Kia-Pool, aktive Händler-Modelle |
| `/sales/smart` | Smart Sales – identischer Kia-Pool |
| `/sales` | Klassischer Verkäufermodus (bereits Kia-Katalog) |
| `/backend` | Kia-Partner-Banner + Schnellaktionen |

### Matching-Logik

- `findSalesAdvisorMatches()` nutzt `getKiaSalesVehiclePool()` – **kein Multi-Brand-Fallback**
- Optional gefiltert auf `activeKiaModelIds` aus Händlerkonditionen
- Ergebnisse mit `kiaMeta` (Registry-Key, Trim-Lines, CleverQuote-Status)

## UI

- **KiaPartnerBar** im Gesprächsmodus
- **SalesResultsPodium** – „Beste Kia-Modelle für …“
- **BackendHome** – Kia-Partner-Karte mit CTA Gesprächsmodus
- **conversationTextAssistant** – Kia Sportage statt Ford Kuga (Anhängelast)

## Kundenseite (unverändert)

`MARKETPLACE_VEHICLES` enthält weiterhin andere Marken für die öffentliche Fahrzeugsuche. Nur Verkäufer-Flows sind Kia-only.

## Tests

```bash
npm run test:kia-partner
npm run test:smart-sales
npm run test:conversation
npm run deploy:check
```

## Nächste Schritte (nach Kia-Perfektion)

- EV4, Picanto, Niro, Ceed in Registry mit Paketen (PDF je Modell von kia.com/de/broschuere/)
- Weitere Marken erst nach 60-Sekunden-Ziel für Kia

## Sprint 33b – Offizielle Kia-Preislisten (kia.com/de/broschuere/)

| Modul | Datei |
|-------|--------|
| **27 Modelllinien + WLTP** | `src/data/kia/kiaOfficialPriceList.js` |
| **Admin-Modellliste** | `src/data/adminCatalog.js` (abgeleitet) |
| **Partner Hub** | `getKiaOfficialPriceList()`, `getKiaOfficialModelSummary()` |
| **EV3 Registry** | UPE ab 35.990 € (Air), Quelle Kia Preislisten |

Test: `npm run test:kia-pricelist`

## Sprint 33c – Kia PDF-Preislisten (19 Dateien)

| Schritt | Befehl / Datei |
|---------|----------------|
| PDF → Text | `scripts/pdf-extract/` (pypdf) |
| Parser | `python scripts/parse-kia-pricelists.py` → `npm run parse:kia-pdf` |
| Registry | `src/data/kia/kiaPriceListRegistry.js` |
| Katalog | `src/data/kia/pricelist-imports/catalog.js` (auto-generiert) |

**Import-Stand (19 PDFs):**

| Status | Modelle |
|--------|---------|
| ✅ Vollständig | Picanto, Stonic, XCeed, K4, Seltos, Sportage, Sportage PHEV, EV2–EV5, EV5 GT, EV9, PV5 Passenger |
| ✅ OCR ergänzt | Sorento (3×), K4 Sportswagon, EV6, Picanto (manual-supplements) |

**EV3 Registry** synchronisiert: 7 UPE-Kombinationen aus PDF (58,3 / 81,4 kWh, FWD/AWD).

Tests: `npm run test:kia-pdf`
