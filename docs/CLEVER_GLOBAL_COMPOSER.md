# Clever Global Composer

**Status:** Slice 5 (kontextbezogene Terminvorschläge + Kundennachricht)  
**Stand:** Juli 2026

## Produktgesetz

> **Der Composer ist Clever.**

> **OpenAI schreibt. Clever beschafft und validiert die Fakten.**

> **Ein vorgeschlagener Termin ist noch kein bestätigter Termin.**

> **Keine erfundene Kalenderverfügbarkeit.**

> **Seller Facts ≠ Customer Truth**

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

- `globalComposer.slice1.test.js` … `globalComposer.slice5.test.js`

## Nächste Slices

Offer + Termin Multi-Action, Attachments, Akte-Composer-Migration.
