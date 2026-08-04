# Clever Global Composer

**Status:** Surfaces vereinheitlicht (ein Orchestrator; Dashboard + Akte) · Slice 19 OCR · Kalender Availability-Hook · Inbound leicht · Zwei-Wege-Mail leicht  
**Stand:** August 2026

## Produktgesetz

> **Der Composer ist Clever.**

> **OpenAI schreibt. Clever beschafft und validiert die Fakten.**

> **Ein vorgeschlagener Termin ist noch kein bestätigter Termin.**

> **Kein Auto-Booking ohne Verkäufer-Confirm.** Propose → Confirm → Action.

> **Kalender:** ohne Adapter `availabilityStatus: not_checked`; mit Adapter nur Status (`available` / `busy` / `unknown` / `error`) – nie stille Buchung.

> **Seller Facts ≠ Customer Truth**

> **Contract Fact ≠ Customer Truth**

## Surfaces

| Surface | UI | Orchestrator / Kontext |
|---------|-----|------------------------|
| Dashboard (`/backend`) | `CleverGlobalComposer` als **feste Fußleiste** (fixed bottom); Dashboard: Kacheln → Heute → Suche | `runCleverSellerTurn` – Kunde per Suche / Snapshot |
| Kundenakte (`/backend/kundenakte/:id`) | `CustomerAkteSharedWorkspace` (Clever-Tab: `hideFeed`) | **derselbe** Orchestrator + Universal Review + Magic-Enricher – fester `lead` / Working Context |
| — | Global Composer in Akte **nicht** gerendert (`shouldShowGlobalComposer` nur Dashboard); kein paralleler „Clever Beratung“-Hero auf dem Dashboard | ein Gehirn, zwei Surfaces |

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
| Nachfolgeangebot (`prepare_followup_offer`) – Heute/Golden → Composer → Confirm | 18 (betrieblich) |
| Tesseract/Cloud OCR produktiv (`VITE_CLEVER_CONTRACT_OCR`) | 19 |
| Kalender Availability / Draft (`VITE_CLEVER_CALENDAR`) | Calendar |
| Lexikon/Vergleich = Landing-Pipeline (`buildAdvisoryAnswer`) | Seller Knowledge |
| `inboundLead` / `customer_intake_review` (Alias `inbound_lead_review`) | Kundenanfrage / Inbound leicht |
| `customerReply` / `customer_reply_review` (Paste/Forward) | Zwei-Wege-Mail leicht |

## Migration: Composer ersetzt Verkaufen-Hub-Einstieg

**Stand:** Dashboard ohne Verkaufen-Kachel – Composer ist der primäre Einstieg (Lexikon + Manager + Organizer).

| Einstieg | Pfad |
|----------|------|
| Composer (Dashboard-Fußleiste) | Chips: Showroom starten · Modell auswählen · Neue Anfrage |
| Showroom-Workspace | `/verkaufsassistent?view=showroom` |
| Modell-Workspace | `/verkaufsassistent?view=model` |
| Verkaufen-Hub (Deep-Link) | Backend-Area `verkaufen` / `BackendVerkaufenHub` – **bleibt**, kein Dashboard-Tile |

**Intake-Review:** `reviewType: customer_intake_review` mit `legacyReviewType: inbound_lead_review`. Accept bleibt `accept_inbound_lead` (Handler akzeptiert beide Review-Typen).

**Erkennung:** Forward/Mail-Header, Cue `Hier eine Anfrage:`, **oder strukturierte Händler-Notiz** (Name + Kunden-Mail/Tel + Fahrzeug/Kondition) – ohne dass daraus eine Kundennachricht vorbereitet wird. Review-Copy trennt **Erkannt** / **Bitte prüfen**; bei Ambiguous fehlt `clarify_customer_for_intake`.

### Multi-Source Intake (Dump + Altvertrag)

**Leitsatz:** Text, Dokument und Arbeitskontext bilden **einen** Clever-Turn.

| Baustein | Rolle |
|----------|--------|
| `normalizeSellerUnits.js` | Unit-first: `10.000 km` ≠ Kaufpreis; `48 10.000 km` → Laufzeit + Jahres-km |
| `detectTradeInFromSellerInput.js` | `GW` / Inzahlungnahme → Trade-in, nicht Vehicle Interest |
| `multiSource/contractKindRegistry.js` | Erweiterbare Vertragsarten (Leasing, Finanzierung, **3-Wege**, Kauf, …) |
| `multiSource/buildMultiSourceIntake.js` | Merge Seller-Dump + Attachment → Action Plan (deterministisch) |
| `multiSource/evaluateComplexSellerTurn.js` | Complexity Router → OpenAI nur bei komplexen Turns |
| `multiSource/interpretMultiSourceWithOpenAi.js` | Optional: Responses API + Schema `CleverMultiSourceIntakePlan` |
| Review `customer_contract_tradein_intake_review` | Eine Karte: Kunde, Wunsch, Konditionen, GW, Altvertrag, Konflikte, Offen |

Trigger eng: `Abgleich` **oder** Wunsch + GW + Vertrags-PDF. Inbound/Reply/reiner Contract-Import bleiben eigene Pfade. Kein Auto-Persist.

Neue Vertragsart: Eintrag in `CONTRACT_KIND_REGISTRY` (+ optional `enrichExtracted`) – kein Mazzei-/Picanto-Hardcode im Core.

#### OpenAI Multi-Source Interpret (optional)

Default **aus**. Aktivierung:

| Env | Rolle |
|-----|--------|
| `CLEVER_SELLER_OPENAI_INTERPRET_ENABLED=true` | Server: OpenAI-Pfad freischalten |
| `OPENAI_API_KEY` | Pflicht für Server-Interpret |
| `VITE_CLEVER_SELLER_OPENAI_INTERPRET_ENABLED=true` | UI: komplexe Turns via `POST /api/v1/clever/seller-turn` (kein Browser-Key) |

**Ablauf:** `shouldUseSemanticInterpreter` / Complexity Router (`complexityReasons`) → bei komplex: Async `runCleverSellerTurnAsync` → `extractMinimalContractContext` (kein Full-PDF) → OpenAI Structured Plan (`CleverMultiSourceIntakePlan` via `openAiResponsesClient`) als **primäres Sprachverständnis** → Post-AI-Validatoren → Review aus validiertem Plan. Einfache Turns bleiben sync/deterministisch.

Bei Flag aus, fehlendem Key oder AI-Fehler: deterministischer Fallback (`interpreterSource: fallback`) mit **sichtbarer** UI-Warnung – kein stiller Erfolg. Diagnose ohne PII: `interpreterSource`, `attachmentContextMode`, `complexityReasons`, `schemaValid`, `validatorWarningsCount`, `toolCalls`, `fallbackReason`, `durationMs`, `responseId`, `model`.

Tests: `multiSourceOpenAiInterpret.golden.test.js` · Smoke: `scripts/smoke-multi-source-openai.mjs`

## Slice 5 – Golden Flow

Input (in Akte / mit aktuellem Kunden):

> „Schlag ihm Montag um 15 Uhr einen Termin vor.“

Ablauf:

1. `resolve_customer_context` → „ihm“ = aktueller Kunde
2. `resolve_relative_datetime` → nächster Montag 15:00 (injizierbare Clock)
3. Terminart: `showroom_visit` (keine Probefahrt aus Fahrzeugkontext)
4. Working Context (z. B. Picanto GT-Line) als Anlass, nicht als Customer Truth
5. `availabilityStatus: not_checked` ohne Adapter (`VITE_CLEVER_CALENDAR` aus); mit Adapter / `window.__cleverCalendarProvider`: `available` \| `busy` \| `unknown` \| `error`
6. Prepared Appointment + Vorschlagsnachricht (`bookable: false`)
7. Review `appointment_and_message_review` (CTA „Kalender prüfen“ nutzt denselben Provider)
8. Follow-ups: „Lieber 16 Uhr.“ / „Dann Dienstag.“ über `pendingAction`
9. Handoff `customer_message_edit` – kein Auto-Send, kein Auto-Booking
10. Nach Confirm: bestehender CRM-Persist-Pfad; optional `createDraftEvent` (Entwurf, nicht gebucht)

Gegenproben: kein Kunde; kein Fahrzeug; Probefahrt XCeed; Seller „ist frei“ ≠ Kalendercheck; direkt eintragen ohne Zusage; Flag aus → `not_checked`.

### Kalender-Adapter (schlank)

| Baustein | Rolle |
|----------|--------|
| `resolveCleverCalendarProvider` | Flag + `window.__cleverCalendarProvider` + Local-Stub |
| `runCleverSellerTurnWithCalendar` | Orchestrator: Propose + optional Availability |
| `checkCalendarAvailability` / `maybeCreateCalendarDraftEvent` | Normalize Status · Draft-Hook |
| `refreshSellerTurnCalendarCheck` | Review-CTA „Kalender prüfen“ |

Kein Google-/Microsoft-OAuth in der Produktpflicht – Hook oder Local-Stub reicht. Test: `globalComposer.calendar.test.js`.

## Inbound leicht (Paste/Forward) → Kundenanfrage

**Status:** Composer-Eingang · Propose → Confirm → Action  
**Nicht:** WhatsApp Business API, Telefonie, mobile.de-API, Big Intake Hub

Eingang im Dashboard-Composer (E-Mail-Paste / Weiterleitung / Chip „Neue Anfrage“):

1. Intent `inbound_lead` (Mail-Header / „Hier eine Anfrage:“ / Forward)
2. Kontakt aus Forward-Rohtext (E-Mail vor HTML-Strip)
3. Resolve per E-Mail → Telefon → Name gegen `leadsSnapshot`
4. Review `customer_intake_review` (Alias `inbound_lead_review`): erkannter Kunde **oder** „Neue Kundenakte anlegen“ + Facts + nächste Aktion
5. Dubletten-Hinweis bei Mehrfachtreffern; Secondary: Erneut suchen / Verwerfen
6. Übernehmen: verknüpfen / anlegen **nur nach Accept** (`accept_inbound_lead` → `applyAcceptedSellerTurn` + `addLead`)

Modul: `inboundLeadIntake.js` · Test: `inboundLead.golden.test.js`  
Kundenwelt-Intake (Soft Wish / Portal) bleibt getrennt: [CLEVER_CUSTOMER_INTAKE_MANIFEST.md](CLEVER_CUSTOMER_INTAKE_MANIFEST.md).

## Zwei-Wege-Mail leicht (Kundenantwort Paste/Forward)

**Status:** Composer-Eingang · Propose → Confirm → Action  
**Nicht:** echte IMAP-/WhatsApp-API (Paste/Forward als Kanal-Adapter; Hook `adaptInboundChannelToPaste` für spätere Inbox)

Golden-Beispiel:

> „Der XCeed gefällt mir, aber bitte in Rot und mit AHK. Montag 16 Uhr passt.“

Ablauf:

1. Intent `customer_reply` (Cue „Kundenantwort“, Betreff `Re:`/`AW:`, oder Antwort-Signale im Mail-Paste)
2. Resolve Kunde (offene Akte → E-Mail → Telefon → Name) – **kein** Propose-Create
3. Facts: Favorit / Farbe / AHK / Termin (+ Universal Facts)
4. Prepared Actions: Wünsche übernehmen · Terminvorschlag · Angebot anpassen
5. Review `customer_reply_review` → Persistenz **nur nach Confirm**

Modul: `customerReplyIntake.js` · Test: `customerReply.golden.test.js`  
Abgrenzung: Erst-Anfrage bleibt `inbound_lead` („Hier eine Anfrage:“ ohne Antwort-Signale).

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

`VITE_CLEVER_CALENDAR=true` aktiviert Availability-Check / Local-Stub (sonst `not_checked`).  
Cloud-Kalender nur über `window.__cleverCalendarProvider` – kein OAuth-Key in `.env`.

## Tests

- `globalComposer.slice1.test.js` … `globalComposer.slice19.test.js`
- `globalComposer.calendar.test.js` – Flag aus → `not_checked`; Mock-Provider → `available`/`busy`; Draft ≠ Booking
- `composerSurfaces.akte.test.js` – Akte-Surface (fester Lead): Nachfassen, PDF/Contract, Termin
- `inboundLead.golden.test.js` – Paste Brandes (Match) / neuer Kunde (Propose-Create)
- `customerReply.golden.test.js` – Kundenantwort Brandes (Favorit/Rot/AHK/Termin) → Review → Confirm
- `documentsChecklist.golden.test.js` – Unterlagen fehlen Brandes → Review → Confirm → Paket

## Nächste Slices

| Slice | Thema | Spec |
|-------|--------|------|
| Phase 4 Kern | Admin-Leitstand (Flags/Magic/OCR/Mail) | [CLEVER_CONTRACT_MEMORY.md](CLEVER_CONTRACT_MEMORY.md) · `/admin/system` |
| später | OCR messen / Cloud-API | [CLEVER_CONTRACT_MEMORY.md](CLEVER_CONTRACT_MEMORY.md) |
| später | Inbox/IMAP an `adaptInboundChannelToPaste` | echte Mail-Inbox – bewusst nicht jetzt |
| später | weitere Inbound-Kanäle | WhatsApp / Telefonie – bewusst nicht jetzt |

Contract Memory Vision: **Customer Truth ≠ Contract Fact ≠ Seller Fact ≠ Prepared Action**.
