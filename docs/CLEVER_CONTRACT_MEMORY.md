# Clever Contract Memory

**Status:** Slice 15 implementiert (Dual-Accept Offer + Termin)  
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
| `parseDocument`, `extractDocumentText`, `createCustomerContractDraft`, `validateCustomerContract`, `persistCustomerContract`, `searchCustomerContracts`, `compareContractWithOffer` | Slice 6–11 (PDF-Text-Intake ja; OCR/UI-Wiring noch offen) |

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
| **9** | Vertragsvergleich | Altvertrag vs. neues Angebot (strukturiert) |
| **10** | Vergleichsnachricht | Explizite Kundennachricht aus Compare-Deltas |
| **11** | PDF Contract Intake | Vorextrahierter PDF-Text → gleicher Import-Pfad |
| **12** | Akte PDF-Wiring | Klassifikation contract_pdf vs. configurator_pdf |
| **13** | Global Composer PDF | Dashboard-Drop → gleicher Prepare/Turn-Pfad |
| **14** | Offer + Termin | Dual-Prep + `offer_and_appointment_review` |
| **15** | Dual-Accept-Execute | Dual-pending + `accept_offer_and_appointment` |
| später | OCR | siehe unten |

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

## Slice 8 – Contract Golden Moments

**Status: implementiert**

Bestätigte Vertragsdaten speisen **bestehende** Journey-/Reminder-/Golden-Moment-Systeme:

- Horizonte 12 / 6 / 3 Monate (`leasing_expires_12m` / `_6m` / `_3m`)
- Kilometer prüfen (≤6 Monate)
- Rückgabe vorbereiten (≤3 Monate)
- Nachfolgeangebot fehlt + Favoriteninteresse → `CONTRACT_SUCCESSION`

Keine Kaufwahrscheinlichkeit. Keine zweite Reminder-Engine.

| Modul | Rolle |
|-------|--------|
| `contractGoldenSignals.js` | Horizonte, Reasons, Body-Lines |
| `goldenMoment.js` | Typ `contract_succession_follow_up` |
| `journeyReminderRules.js` | 3m / 6m / 12m Regeln + Contract-Enddatum |
| `globalComposer.slice8.test.js` | Golden + Reminder-Gegenproben |

---

## Slice 9 – Vertragsvergleich

**Status: implementiert**

Strukturierter Vergleich bestätigter Contract Facts mit einem vorhandenen Angebot:

- Intent: `compare_contract_with_offer`
- Review: `contract_offer_compare_result`
- Felder: Fahrzeug, Rate, Laufzeit, Kilometer (nur vorhandene Werte)
- Angebot aus `currentOfferContext` oder Favoriten-/Fahrzeugspur (`leasingData`) – **nicht** aus `wish.*`
- Keine Kundennachricht, kein Auto-Send, keine Truth-Mutation

| Modul | Rolle |
|-------|--------|
| `compareContractWithOffer.js` | Detection, Offer-Resolve, Diff-Rows, Review-Body |
| `globalComposer.slice9.test.js` | Golden + Gegenproben |

### Golden Input

> „Vergleiche den Vertrag mit meinem neuen Angebot.“

Erwartung (Brandes + XCeed-Favorit 347 € vs. Altvertrag 329 €): Rate Δ +18 €, Laufzeit/km gleich wenn gesetzt.

### Nicht in Slice 9

- Automatische Vergleichsnachricht an den Kunden  
- PDF-/OCR-Intake  
- Wunschrate (`wish.desiredRate`) als Angebot behandeln  
- Erfundene Konditionen  

---

## Slice 10 – Vergleichsnachricht

**Status: implementiert**

Nur nach **explizitem** Schreibauftrag entsteht eine Kundennachricht aus den Compare-Rows:

- Cue: `isContractCompareMessageCue` („Schreib … Nachricht zum Vergleich …“)
- Intents: `compare_contract_with_offer` + `draft_message`
- Modul: `draftContractCompareCustomerMessage.js` (deterministisch, validiert)
- Review: `contract_compare_and_message_review`
- Handoff: `customer_message_edit` – **kein Auto-Send**
- Reiner Vergleich (Slice 9) bleibt **ohne** Nachricht

| Modul | Rolle |
|-------|--------|
| `draftContractCompareCustomerMessage.js` | Cue + Draft aus Diff-Rows |
| `globalComposer.slice10.test.js` | Golden + Gegenproben |

### Golden Input

> „Schreib Brandes eine Nachricht zum Vergleich mit dem neuen Angebot.“

Erwartung: Draft mit Rate 329 → 347 €, `autoSend: false`, Review `contract_compare_and_message_review`.

### Nicht in Slice 10

- Auto-Nachricht bei reinem Vergleich  
- PDF-/OCR-Intake  
- Offer + Termin Multi-Action  

---

## Slice 11 – PDF Contract Intake

**Status: implementiert**

Nativer PDF-Text wird **vor** dem sync Turn extrahiert (Magic-Offer-Pattern `extractMagicOfferPdf`). Der Turn selbst ruft kein pdfjs auf.

- Attachment `kind: 'contract_pdf'` + `extractedText` **oder** Composer `PDF: name.pdf\\n\\n…`
- Intent unverändert: `import_customer_contract`
- Evidence / `sourceDocument.sourceType`: `contract_pdf`
- Review: `contract_import_review` (kein neuer Review-Kind)
- Leerer/Scan-PDF → `needs_manual_describe` (blocked), keine erfundenen Felder
- `contract_pdf` wird **nicht** als Offer-PDF enriched

| Modul | Rolle |
|-------|--------|
| `resolveContractIntakeText.js` | Text + sourceType aus Input/Attachment |
| `prepareCustomerContractImport.js` | nutzt Resolve + `sourceType: contract_pdf` |
| `globalComposer.slice11.test.js` | Golden (Stub-Text, kein pdfjs) |

### Nicht in Slice 11

- OCR / Scan-Pipeline  
- pdfjs innerhalb von `runCleverSellerTurn`  
- UI Big Bang (Composer Drag&Drop / Akte-Branch) – Follow-up  
- Offer + Termin Multi-Action  

---

## Slice 12 – Akte PDF-Wiring

**Status: implementiert**

`CustomerAkteSharedWorkspace.handleAttachFile` klassifiziert nach Extraktion:

- Vertrags-Signale / Dateiname → `kind: contract_pdf` + `extractedText` → Slice-11-Intake  
- Angebots-/Konfigurator-Signale → `kind: configurator_pdf` (bisheriges Offer-Verhalten)  
- Leerer Vertrags-PDF → Manual-Describe + blocked Import-Review  

| Modul | Rolle |
|-------|--------|
| `prepareComposerPdfTurnInput.js` | Klassifikation + Turn-Payload |
| `CustomerAkteSharedWorkspace.jsx` | `handleAttachFile` nutzt Prepare |
| `globalComposer.slice12.test.js` | Golden ohne React/pdfjs |

### Nicht in Slice 12

- OCR  
- Global Composer Drag&Drop  
- Offer + Termin Multi-Action  

---

## Slice 13 – Global Composer PDF

**Status: implementiert**

Dashboard-Composer (`CleverGlobalComposer`) akzeptiert PDF-Drop wie die Akte:

- `extractMagicOfferPdf` → `runComposerPdfAttachTurn` → Review  
- Vertrag → `contract_import_review`; Confirm persistiert via `applyAcceptedSellerTurn` + `updateLead`, dann Akte öffnen  
- Konfigurator bleibt `configurator_pdf`  

| Modul | Rolle |
|-------|--------|
| `runComposerPdfAttachTurn.js` | Prepare + Turn (Dashboard/Akte) |
| `CleverGlobalComposer.jsx` | `onAttachFile` + Contract-Accept |
| `globalComposer.slice13.test.js` | Golden (Stub-Text, Snapshot-Resolve) |

### Nicht in Slice 13

- OCR  
- Offer + Termin Multi-Action  

---

## Slice 14 – Offer + Termin Multi-Action

**Status: implementiert**

Ein Seller-Satz bereitet **Angebot und Terminvorschlag** gemeinsam vor:

> „Erstelle Brandes ein XCeed-Angebot für 28.000 € und schlag ihm Montag 15 Uhr einen Termin vor.“

- Beide Intents `prepare_offer` + `propose_appointment`
- Review: `offer_and_appointment_review` (auch wenn Brandes als Leasing-Kunde Kauf/Leasing-Klärung braucht)
- Cash-Happy-Path: Garritano + 17.000 € → Angebot und Termin beide `prepared`
- CTAs getrennt: Angebot prüfen / Vorschlag senden / Nachricht bearbeiten
- Eine Kundennachricht = Terminvorschlag (kein Auto-Send, kein Auto-Book)

| Modul | Rolle |
|-------|--------|
| `buildUniversalReviewModel.js` | Composite `offer_and_appointment_review` |
| `interpretSellerInput.js` | Create-Offer auch für `XCeed-Angebot` |
| `globalComposer.slice14.test.js` | Golden + Gegenproben |

### Nicht in Slice 14

- OCR  
- Dual-Nachricht mergen / Dual-Accept in einem Klick  
- Kalender als Wahrheit  

---

## Slice 15 – Dual-Accept-Execute / Dual-pendingAction

**Status: implementiert**

Nach Slice-14-Composite:

1. **`pendingAction.type = offer_and_appointment`** trägt Angebot *und* Terminvorschlag (Follow-up „Lieber 16 Uhr“ bleibt möglich).
2. **CTA** `accept_offer_and_appointment` („Angebot & Termin übernehmen“) – nur wenn Angebot wirklich `prepared`.
3. **`executeDualOfferAppointmentAccept`** – expliziter Seller-Klick, `autoSent: false`, `autoBooked: false`.
4. Getrennte CTAs bleiben (Angebot prüfen / Vorschlag senden).

| Modul | Rolle |
|-------|--------|
| `runCleverSellerTurn.js` | Dual-pending + dual Handoff |
| `executeDualOfferAppointmentAccept.js` | Accept ohne Auto-Send/Book |
| `buildUniversalReviewModel.js` | Dual-Accept-CTA |
| `CleverGlobalComposer.jsx` | Action-Wiring |
| `globalComposer.slice15.test.js` | Golden + Gegenproben |

### Nicht in Slice 15

- OCR / Scan-Pipeline  
- Eine gemergte Dual-Kundennachricht (Angebotstext + Termin in einem Body)  
- Kalender als Wahrheit  

---

## Später

- OCR / Scan-Pipeline  

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
