# Clever Contract Memory

**Status:** Slice 7 implementiert (Contract Memory Search) – Slice 8 Roadmap  
**Stand:** Juli 2026  
**Orchestrator:** ausschließlich `runCleverSellerTurn`

---

## Produktsatz

> Clever verwaltet nicht nur neue Kundenarbeit.  
> Clever verwandelt die gesamte alte Verkäuferhistorie in ein nutzbares Gedächtnis.

> Alles, was der Verkäufer bereits weiß oder besitzt,  
> wird durch Clever zu nutzbarem Verkäufergedächtnis.

---

## Produktvision

Der Verkäufer darf alte Informationen einfach in den Composer werfen:

- kopierter Vertragstext
- PDF / Scan / Foto
- Ablöseschreiben
- alte Angebotsdaten
- Vertragszusammenfassung
- Kundenmail
- wilde Verkäufernotizen

Clever erzeugt daraus eine **strukturierte, quellenbasierte Kundenhistorie**.  
Der Verkäufer sortiert nicht manuell.

### Das Dokument ist nicht das Ergebnis

Ein hochgeladener oder hineinkopierter Vertrag wird **nicht nur als Datei** abgelegt.

Clever erzeugt:

1. **ORIGINAL SOURCE** (bleibt erhalten)
2. **STRUCTURED CONTRACT RECORD**
3. **REVIEW**
4. **CONFIRMED CUSTOMER CONTRACT HISTORY** (nach Freigabe)
5. **ZUKÜNFTIGE VERKAUFSAKTIONEN** (Prepared Actions)

Die extrahierte Struktur **ersetzt** das Original nie.

---

## Verbindliche Trennung (niemals vermischen)

| Ebene | Bedeutung | Beispiele |
|-------|-----------|-----------|
| **Customer Truth** | Was der Kunde gesagt oder gewünscht hat | Wunschrate max. 350 €, Automatik, AHK |
| **Contract Fact** | Was in einem vorhandenen Vertrag steht | Rate 329 €, Ende 30.11.2026, 15.000 km, Allane |
| **Seller Fact** | Was der Verkäufer ergänzt | Übernahme geplant, mehr Kilometer wahrscheinlich |
| **Prepared Action** | Was Clever vorbereitet | Wiedervorlage, Nachfolgeangebot, Ablöseanfrage |

Vertragsraten sind **keine** Kundenwünsche.  
Wunschraten sind **keine** Vertragswerte.

---

## Architektur-Audit (Kurzfassung, vor Slice 6)

| ID | Befund |
|----|--------|
| **A** | PDF-Text: Magic Offer (`extractMagicOfferPdf`). Vault + Akte speichern Dateien. Kein Contract-Parse-Pfad. |
| **B** | Kein `customerContracts[]`. Nur flach: `existingContractEnd` → `wish.leasingEndDate`, `crm.tradeIn`, Akte-Kategorien. |
| **C** | `leasingEndDate` kanonisch unter `lead.wish.leasingEndDate` (+ Fallbacks). |
| **D** | Dokumente via `leadId` / Unterlagen / Attachments – keine Contract-Verknüpfung. |
| **E** | Offer-PDF-Interpreter inkl. Evidence wiederverwendbar; Schema nicht als Contract-SoT missbrauchen. |
| **F** | Keine Produkt-OCR. Scans → manuell beschreiben. |
| **G** | Evidence reif bei Knowledge + Offer; Contract Memory noch ohne Persistenz. |
| **H** | Reminder: `leasing_expires_6m` über `evaluateJourneyReminder` / `wish.leasingEndDate`. |
| **I** | Speichern: `lead.crm.customerContracts[]` + Projektion `wish.leasingEndDate`. Keine zweite Wahrheit. |
| **J** | Vor Modellaufrufen: IBAN, Ausweis, Gehalt, Schufa/Bonität strippen/minimieren. |

### Tool-Status

| Tool | Status |
|------|--------|
| `evaluateJourneyReminder` | vorhanden |
| `extractMagicOfferPdf` / Offer-Interpret | wiederverwendbar (Pattern) |
| `parseDocument`, `extractDocumentText`, `createCustomerContractDraft`, `validateCustomerContract`, `persistCustomerContract`, `searchCustomerContracts`, `compareContractWithOffer` | fehlen / Slice 6+ |

---

## Persistenz (eine Wahrheit)

Bevorzugt bestehende CRM-Struktur erweitern:

```text
lead.crm.customerContracts[]
```

Mindestinhalt eines Contract Records:

- `id`, `customerId`, `contractType`
- `vehicle`, `commercialTerms`, `dates`, `mileageTerms`, `provider`
- `sourceDocument`, `evidence`
- `status` (`draft` | `confirmed` | …)
- `createdAt`, `updatedAt`
- optional Relation: `original_contract` | `amendment` | `extension` | `termination` | `settlement` | `return_statement`

**Bei Confirm:**

- strukturierten Vertrag speichern
- Originalquelle verknüpfen
- Activity „Altvertrag erfasst“
- `wish.leasingEndDate` aus `contractEndDate` projizieren (bestehende Journey-Regel weiter nutzen)

**Nicht:**

- Vertragswerte als Customer Truth speichern
- ohne Review persistieren
- Original nach Extraktion entfernen
- Dubletten erzeugen
- zweite Reminder-Engine bauen

---

## Evidence (jedes Feld)

```js
{
  field,
  value,
  sourceType,   // pasted_contract_text | contract_pdf | …
  sourceId,
  evidenceText,
  confidence
}
```

Keine überzeugend klingende Extraktion ohne Beleg.  
Fehlende Werte bleiben leer – nichts aus allgemeinem Wissen ergänzen.

---

## Datenschutz

1. Nativen PDF-Text nutzen  
2. OCR nur bei echten Scans (später)  
3. Relevante Passagen vorselektieren  
4. Sensible, strukturlose Daten minimieren  
5. Nur benötigte Ausschnitte zur Interpretation  

Besonders behandeln / nicht an Message Writer:

- IBAN, Ausweis, Unterschriften  
- Bonität, Gehalt, private Kontodaten  

---

## Slice-Roadmap

| Slice | Name | Kern |
|-------|------|------|
| **6** | Contract Intake | Text/Paste → Draft → Review → Confirm |
| **7** | Contract Memory Search | „Wann läuft Brandes aus?“ aus Contract Facts |
| **8** | Contract Golden Moments | Vertragsende → bestehende Journey/Reminder + Nachfolge-CTA |
| später | Vertragsvergleich | Altvertrag vs. neues Angebot + Nachricht |

Global Composer bleibt der Einstieg; siehe [CLEVER_GLOBAL_COMPOSER.md](CLEVER_GLOBAL_COMPOSER.md).

---

## Slice 6 – Contract Intake

**Status: implementiert** (Paste → Draft → Review → Confirm)

### In Scope

- Pasteter Vertragstext im globalen oder kundenbezogenen Composer
- Intent: `import_customer_contract`
- Dokumenttyp z. B. `leasing_contract`
- Kundenauflösung (aktuell / Suche / explizit)
- Deterministische Extraktion + Feld-Evidence
- Review: `contract_import_review`
- Persistenz **nur nach** Verkäuferbestätigung → `lead.crm.customerContracts[]`
- Projektion `wish.leasingEndDate`
- Erweiterung von `runCleverSellerTurn` Result Contract (kein zweiter Orchestrator)

### Code

| Modul | Rolle |
|-------|--------|
| `extractCustomerContractFromText.js` | Deterministische Felder + Evidence |
| `prepareCustomerContractImport.js` | Draft + Review-Body |
| `crm/customerContracts.js` | Persistenz, Duplikat-Check |
| `globalComposer.slice6.test.js` | Golden + Gegenproben |

### Nicht in Slice 6

- PDF-/Scan-/OCR-Intake  
- Contract Search (Slice 7)  
- Golden Moments / Reminder-CTAs (Slice 8)  
- Vertragsvergleich  
- Auto-Nachricht / Auto-Wiedervorlage  
- Attachments als Big Bang  

### Golden Input

```text
Leasingvertrag
Kunde Herr Brandes
Ford Kuga
Vertragsbeginn 01.12.2022
Laufzeit 48 Monate
15.000 km jährlich
Rate 329 Euro
Sonderzahlung 0 Euro
Vertragsende 30.11.2026
Mehrkilometer 8 Cent
Minderkilometer 3 Cent
```

Erwartetes Draft (sinngemäß):

```js
{
  contractType: 'leasing',
  vehicle: { make: 'Ford', model: 'Kuga' },
  contractStartDate: '2022-12-01',
  contractEndDate: '2026-11-30',
  termMonths: 48,
  annualMileage: 15000,
  monthlyRate: 329,
  downPayment: 0,
  excessMileageRate: 0.08,
  underMileageRate: 0.03
}
```

### Review (Beispiel)

```text
✨ CLEVER HAT DEN VERTRAG ERKANNT

KUNDE … VERTRAG … FAHRZEUG … LAUFZEIT … KONDITIONEN …
NOCH OFFEN (Vertragsnummer, Leasinggesellschaft, …)

[ Vertrag übernehmen ] [ Werte bearbeiten ] [ Quelle ansehen ] [ Verwerfen ]
```

### Result Contract (Erweiterung)

```js
{
  intents,
  resolvedCustomer,
  resolvedWorkingContext,
  documentClassification,
  extractedContractFacts,
  contractDraft,
  missingInformation,
  conflicts,
  evidence,
  warnings,
  preparedActions,
  reviewModel
}
```

---

## Slice 7 – Contract Memory Search

**Status: implementiert**

Fragen aus bestätigten Contract Facts beantworten, mit Quelle:

- „Wann läuft Brandes aus?“
- „Was zahlt Garritano momentan?“
- „Wie viele Kilometer hat Frau Deutsche im Vertrag?“
- „Welche Leasinggesellschaft hat den Vertrag?“
- „Was stand bei den Mehrkilometern?“

Intent: `search_customer_contracts`  
Review: `contract_memory_result` + CTAs (Vertrag öffnen, Nachfolgeangebot)

| Modul | Rolle |
|-------|--------|
| `searchCustomerContracts.js` | Query-Feld, Lookup, Antwort + Evidence |
| `globalComposer.slice7.test.js` | Golden + Gegenproben |

Fallback: nur `wish.leasingEndDate` als `projection_only`, klar gekennzeichnet.  
Keine Customer-Truth-Mutation.

---

## Slice 8 – Contract Golden Moments (später)

Bestätigte Vertragsdaten in **bestehende** Journey-/Reminder-Systeme:

- Ende in 12 / 6 / 3 Monaten  
- Kilometer prüfen, Rückgabe vorbereiten  
- Nachfolgeangebot fehlt + bestehendes Fahrzeuginteresse  

Keine Kaufwahrscheinlichkeit. Keine erfundenen Prioritäten.  
Keine zweite Reminder-Engine.

---

## Später: Vertragsvergleich

Nur strukturierte Werte vergleichen; Abweichungen bei Laufzeit/km klar markieren.  
Danach optional natürliche Kundennachricht – ohne ungefilterten Vollvertrag an den Writer.

---

## Composer-Beispiele (Zielbild)

- „Lies den alten Vertrag von Brandes ein.“
- „Leg das bei Garritano ab.“
- „Wann läuft der Vertrag aus?“
- „Was zahlt er aktuell?“
- „Vergleiche den Vertrag mit meinem neuen Angebot.“
- „Erinnere mich sechs Monate vorher.“
- „Bereite ein Nachfolgeangebot vor.“

Der Verkäufer wählt keine Funktion – Clever wählt die Tools.

---

## Definition of Done (Gesamtvision)

Clever ist Verkäuferassistent 2.0 für Altverträge, wenn:

- Kunde auflösbar ist  
- Dokumenttyp erkannt wird  
- Felder strukturiert + evidenziert sind  
- Unsicherheiten sichtbar sind  
- Original erhalten bleibt  
- Persistenz nur nach Freigabe  
- Vertragsende Journey/Reminder speist  
- spätere Fragen aus Contract Facts beantwortet werden  
- Nachfolgearbeit vorbereitbar ist  

---

## Verwandte Docs

- [CLEVER_GLOBAL_COMPOSER.md](CLEVER_GLOBAL_COMPOSER.md) – Composer-Slices 1–5  
- [CLEVER_SELLER_ASSISTANT.md](CLEVER_SELLER_ASSISTANT.md) – Seller-Orchestrator  
- [CLEVER_MAGIC_OFFER.md](CLEVER_MAGIC_OFFER.md) – PDF-/Evidence-Pattern (Vorbild Intake)  
- [CLEVER_PRODUCT_PRINCIPLES.md](CLEVER_PRODUCT_PRINCIPLES.md) – Produktregeln  
