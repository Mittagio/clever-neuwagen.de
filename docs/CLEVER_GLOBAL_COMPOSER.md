# Clever Global Composer

**Status:** Slice 11 (PDF Contract Intake)  
**Stand:** Juli 2026

## Produktgesetz

> **Der Composer ist Clever.**

> **OpenAI schreibt. Clever beschafft und validiert die Fakten.**

> **Ein vorgeschlagener Termin ist noch kein bestätigter Termin.**

> **Keine erfundene Kalenderverfügbarkeit.**

> **Seller Facts ≠ Customer Truth**

> **Contract Fact ≠ Customer Truth**

## Surfaces

| Surface | Verhalten |
|---------|-----------|
| Dashboard (`/backend`) | `CleverGlobalComposer` aktiv |
| Kundenakte | bestehender Composer; Global Composer ausgeblendet |

### Orchestrierung

Nur `runCleverSellerTurn()`:

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

## Feature-Flag

`VITE_CLEVER_GLOBAL_COMPOSER=false` deaktiviert den Global Composer.

## Tests

- `globalComposer.slice1.test.js` … `globalComposer.slice11.test.js`

## Nächste Slices

| Slice | Thema | Spec |
|-------|--------|------|
| später | Offer + Termin Multi-Action, Attachments/Akte-UI, OCR | [CLEVER_CONTRACT_MEMORY.md](CLEVER_CONTRACT_MEMORY.md) |

Contract Memory Vision: **Customer Truth ≠ Contract Fact ≠ Seller Fact ≠ Prepared Action**.
