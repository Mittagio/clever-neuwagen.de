# Clever Magic Offer

Natürliche Angebotserstellung mit PDF-First und sicherer Rechengrenze.

**Einstieg:** `/verkaufsassistent` → Angebot erstellen (Magic · PDF · Manuell)

## Clever Offer Calculation Boundary

Clever unterscheidet zwischen:

1. **Deterministic Calculation**
2. **Commercial Value Intake**
3. **Document Extraction**

### DETERMINISTIC CALCULATION

Clever darf mathematisch eindeutige Berechnungen durchführen, wenn alle Ausgangswerte aus verifizierten Daten oder expliziten Verkäufereingaben stammen.

Beispiel: UPE + Optionen − Rabatt + Überführung (Barkauf).

### COMMERCIAL VALUE INTAKE

Komplexe kaufmännische Werte wie Leasingrate oder Finanzierungskonditionen werden vom Verkäufer oder einem verifizierten Ursprungssystem übernommen – nicht von Clever erfunden.

### DOCUMENT EXTRACTION

Bestehende Angebote können als PDF übernommen, strukturiert und vom Verkäufer bestätigt werden. Original-PDF bleibt Source of Truth bei Bank-/Leasingangeboten.

**Clever darf fehlende Bank-/Leasingwerte niemals schätzen.**

## Drei Wege, ein Offer-Modell

| Weg | UI | Persistenz |
|-----|-----|------------|
| ✨ Clever Magic | natürliche Sprache / Voice | `buildOfferDraft` → bestehende Pipeline |
| 📄 PDF übernehmen | Upload + Extraktion / Beschreibung | dieselbe Pipeline + Original-PDF |
| ✏ Manuell | Legacy-Kalkulator (`DealerAiConditionsStep`) | dieselbe Pipeline |

Keine zweite Angebotswahrheit. Der bisherige Kalkulator bleibt als Fallback („Manuell erfassen“).

## Safe Decision Matrix (Kurz)

| Fall | Erlaubt |
|------|---------|
| Barkauf + verifizierte Preise + klarer Rabatt | rechnen |
| Leasing + genannte/PDF-Rate | übernehmen |
| Leasing ohne Rate | nachfragen – nicht rechnen |
| Finanzierung + Konditionen vom Verkäufer/PDF | übernehmen |
| Finanzierung nur Kaufpreis/Laufzeit | nicht frei Bankrate rechnen |
| Unbekanntes Paket / fehlender Preis | needs_review |

## Code

- `src/services/dealer/magicOfferSafeCalculation.js` – Safe Calculation Layer
- `src/services/dealer/magicOfferIntentParser.js` – NL → Intent
- `src/services/dealer/magicOfferGrounding.js` – Preisliste / Manufacturer
- `src/services/dealer/magicOfferDecision.js` – Decision Matrix
- `src/services/dealer/magicOfferService.js` – Orchestrierung
- `src/components/dealer-ai/MagicOfferEntry.jsx` / `MagicOfferReview.jsx`

## Produktregel

> Clever darf rechnen, was mathematisch eindeutig ist.  
> Clever darf übernehmen, was Verkäufer oder Bank gerechnet haben.  
> Clever darf niemals Bankkonditionen erfinden.
