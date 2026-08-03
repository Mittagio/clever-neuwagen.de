# Clever Global Composer

**Status:** Surfaces vereinheitlicht (ein Orchestrator; Dashboard + Akte) · Slice 19 OCR · Inbound leicht  
**Stand:** August 2026

## Produktgesetz

> **Der Composer ist Clever.**

> **OpenAI schreibt. Clever beschafft und validiert die Fakten.**

> **Ein vorgeschlagener Termin ist noch kein bestätigter Termin.**

> **Keine erfundene Kalenderverfügbarkeit.**

> **Seller Facts ≠ Customer Truth**

> **Contract Fact ≠ Customer Truth**

## Surfaces

| Surface | UI | Orchestrator / Kontext |
|---------|-----|------------------------|
| Dashboard (`/backend`) | `CleverGlobalComposer` aktiv | `runCleverSellerTurn` – Kunde per Suche / Snapshot |
| Kundenakte (`/backend/kundenakte/:id`) | `CustomerAkteSharedWorkspace` (Clever-Tab: `hideFeed`) | **derselbe** Orchestrator + Universal Review + Magic-Enricher – fester `lead` / Working Context |
| — | Global Composer in Akte **nicht** gerendert (`shouldShowGlobalComposer` nur Dashboard) | ein Gehirn, zwei Surfaces |

### Orchestrierung

Nur `runCleverSellerTurn()` (+ `enrichSellerTurnWithMagicPropose`, `buildUniversalReviewModel`, `applyAcceptedSellerTurn`; PDF/OCR über `runComposerPdfAttachTurnWithOcr`):

| Feld | Slice |
|------|-------|
| `todayOverview`, `knowledgeResult` | 1 |
| `customerSearchResults`, `customerSummary`, `historySearchResults` | 2 |
| `handoffWorkingContext`, `offer_and_message_review` | 3 |
| `sellerFacts`, grounded knowledge, `knowledge_and_message_review` | 4 |
| `resolvedDateTime`, `preparedAppointment`, `appointment_and_message_review` | 5 |
| `documentClassification`, `contractDraft`, `contract_import_review` | 6 |
| `contractMemoryResult`, `contract_memory_result` | 7 |
| Contract → Golden Moment / Journey Reminder (3/6/12m) | 8 |
| `contractOfferCompareResult`, `contract_offer_compare_result` | 9 |
| `contract_compare_and_message_review` (Vergleich + Nachricht) | 10 |
| PDF → `contract_pdf` / `import_customer_contract` | 11 |
| Akte Attach → classify → contract_pdf \| configurator_pdf | 12 |
| Global Composer PDF-Drop → gleicher Pfad | 13 |
| `offer_and_appointment_review` | 14–15 |
| Dual-pending / `accept_offer_and_appointment` | 15 |
| Scan-OCR-Pipeline / `contract_pdf_ocr` | 16 |
| Produkt-OCR-Provider (`VITE_CLEVER_CONTRACT_OCR`) | 17 |
| Nachfolgeangebot (`prepare_followup_offer`) | 18 |
| Tesseract/Cloud OCR produktiv (`VITE_CLEVER_CONTRACT_OCR`) | 19 |
| `inboundLead` / `inbound_lead_review` (Paste/Forward) | Inbound leicht |

## Slice 5 – Golden Flow

Input (in Akte / mit aktuellem Kunden):

> „Schlag ihm Montag um 15 Uhr einen Termin vor.“

Ablauf:

1. `resolve_customer_context` → „ihm“ = aktueller Kunde
2. `resolve_relative_datetime` → nächster Montag 15:00 (injizierbare Clock)
3. Terminart: `showroom_visit` (keine Probefahrt aus Fahrzeugkontext)
4. Working Context (z. B. Picanto GT-Line) als Anlass, nicht als Customer Truth
5. `availabilityStatus: not_checked` solange keine echte Kalenderprüfung
6. Prepared Appointment + Vorschlagsnachricht
7. Review `appointment_and_message_review`
8. Follow-ups: „Lieber 16 Uhr.“ / „Dann Dienstag.“ über `pendingAction`
9. Handoff `customer_message_edit` – kein Auto-Send, kein Auto-Booking

Gegenproben: kein Kunde; kein Fahrzeug; Probefahrt XCeed; Seller „ist frei“ ≠ Kalendercheck; direkt eintragen ohne Zusage.

## Inbound leicht (Paste/Forward)

**Status:** Composer-Eingang · Propose → Confirm → Action  
**Nicht:** WhatsApp Business API, Telefonie, mobile.de-API, Big Intake Hub

Eingang im Dashboard-Composer (E-Mail-Paste / Weiterleitung):

1. Intent `inbound_lead` (Mail-Header / „Hier eine Anfrage:“ / Forward)
2. Kontakt aus Forward-Rohtext (E-Mail vor HTML-Strip)
3. Resolve per E-Mail → Telefon → Name gegen `leadsSnapshot`
4. Review: erkannter Kunde **oder** „neuen Kunden anlegen?“ + Facts + nächste Aktion
5. Dubletten-Hinweis bei Mehrfachtreffern
6. Übernehmen: verknüpfen / anlegen **nur nach Accept** (`applyAcceptedSellerTurn` + `addLead`)

Modul: `inboundLeadIntake.js` · Test: `inboundLead.golden.test.js`  
Kundenwelt-Intake (Soft Wish / Portal) bleibt getrennt: [CLEVER_CUSTOMER_INTAKE_MANIFEST.md](CLEVER_CUSTOMER_INTAKE_MANIFEST.md).

## Unterlagen-Leitprozess (schlank)

**Status:** Composer · Propose → Confirm → Action  
**Nicht:** WhatsApp-API, Bank-/Vollmachten-Vollsuite, Admin/DMS

1. Seller-Input / Chip („Welche Unterlagen fehlen …?“ / „Unterlagen“)
2. `request_documents` via `cleverUnterlagen` + `prepareSellerWorkspacePackage`
3. Review: fehlende Items + Draft-Nachricht + CTA **Sicheren Upload-Link senden**
4. Accept → `sendSellerWorkspacePackage` (Upload-Link + Karten im Shared Workspace)

Test: `documentsChecklist.golden.test.js`

## Feature-Flag

`VITE_CLEVER_GLOBAL_COMPOSER=false` deaktiviert den Global Composer.

## Tests

- `globalComposer.slice1.test.js` … `globalComposer.slice19.test.js`
- `composerSurfaces.akte.test.js` – Akte-Surface (fester Lead): Nachfassen, PDF/Contract, Termin
- `inboundLead.golden.test.js` – Paste Brandes (Match) / neuer Kunde (Propose-Create)
- `documentsChecklist.golden.test.js` – Unterlagen fehlen Brandes → Review → Confirm → Paket

## Nächste Slices

| Slice | Thema | Spec |
|-------|--------|------|
| später | OCR messen / Cloud-API | [CLEVER_CONTRACT_MEMORY.md](CLEVER_CONTRACT_MEMORY.md) |
| später | weitere Inbound-Kanäle | WhatsApp / Telefonie – bewusst nicht jetzt |

Contract Memory Vision: **Customer Truth ≠ Contract Fact ≠ Seller Fact ≠ Prepared Action**.
