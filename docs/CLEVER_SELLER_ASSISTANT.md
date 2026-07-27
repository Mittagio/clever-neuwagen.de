# Clever Seller Assistant

**Status:** v2.1 – Notizzettel-first + action-driven + Termin-Assistent  
**Stand:** Juli 2026

## Leitsatz

Clever ist kein CRM, das der Verkäufer bedienen muss.  
Clever ist der Assistent, dem der Verkäufer sagt, was für diesen Kunden erledigt werden soll.

**Der Verkäufer nennt das Ziel.  
Clever verwendet vorhandenen Kundenkontext und fragt nur nach den Informationen, die zur Ausführung wirklich fehlen.**

**Notizzettel-Chips sind nicht nur Anzeige.  
Sie sind direkte Arbeitsobjekte des Verkäufers.**

**Termine sind ein Werkzeug von Clever, kein eigenes Hauptprodukt.**  
Clever erkennt einen sinnvollen Terminmoment, der Verkäufer schlägt vor, der Kunde bestätigt, Clever übernimmt den bestätigten Termin in den Prozess (CRM-Wiedervorlage / followUpAt – kein Kalender-Klon).

## UX-Philosophie

Clever-Seite = **Notizzettel + Auf dem Tisch + Clever-Moment + Composer**.

Nicht: zehn Menüs, Formulare, Copy/Paste, parallele ChatGPT-Nutzung, Wizard.

Kundenkontext (customer_need) und Verkäufer-Notizen (seller_input) sind **klar getrennt**.

## Komponenten

| Baustein | Datei |
|----------|--------|
| Notizzettel | `CustomerAkteCleverNotepad.jsx` |
| Konditionen-Sheet | `CustomerAkteWishConditionsSheet.jsx` |
| Shared Chat / Composer | `CustomerAkteSharedWorkspace.jsx` |
| Inline Card | `SellerInlineAssistCard.jsx` |
| Intent | `sellerActionIntent.js` |
| Offer Assist Flow | `sellerOfferAssistFlow.js` |
| Appointment Assist Flow | `sellerAppointmentAssistFlow.js` |
| Magic Offer | `magicOfferService.js` |
| Inline Assist | `sellerInlineComposerAssist.js` |
| Einbindung | `DealerAiLeadFollowUp.jsx` |

## Teil A – Notizzettel bearbeiten

1. Tap auf Konditions-Chip (`Leasing`, `Laufzeit offen`, …) → `WishConditionsSheet` (fokussiertes Feld).
2. Tap auf Wunsch-Chip / `+N` → Kundenhelfer.
3. Übernehmen speichert über bestehende Wish-/Lead-Pfade (`applyWishConditions`) – keine Chip-Doppelwelt.

## Teil B – „Was soll Clever erledigen?“

1. Verkäufer tippt oder spricht im Composer.
2. Intent: `prepare_offer` | `propose_appointment` | `prepare_callback` | `message_customer` | `lookup_fact` | `request_documents` | …
3. Bei `prepare_offer`: `runSellerOfferAssist` → Magic Offer + Kundenterme aus Notizzettel.
4. Bei Termin: `runSellerAppointmentAssist` → Typ + Datum/Uhrzeit → Kundennachricht vorbereiten (Status `proposed`).
5. Kunde bestätigt im Chat → Seller sieht „Termin eintragen“ → CRM `followUpAt` / `testDriveScheduledAt` (Status `scheduled`).
6. Nur fehlende Slots als kurze Inline-Card + Choice-Chips.
7. Follow-up im selben Composer: „21 %“, „Leasing“, „morgen 15 Uhr“ → Korrektur.
8. Situativ: AHK/HUD aus Notizzettel nur wenn die Aktion passt (nicht bei Probefahrt).
9. Verifizierte Facts via `getVerifiedVehicleFacts` – keine erfundenen Zahlen.
10. Bereit → „Angebot vorbereiten“ / „Vorschlag senden“ / „Termin eintragen“ → bestehende Pfade.

## Live Customer Context

`buildSellerInlineContext(lead)` und `buildAttributedWishChips` speisen Notizzettel und Assist.

Inline:

- Debounce ~380 ms
- Offer-State: `previousPreparation` im Shared Workspace
- Appointment-State: `crm.cleverAppointment`
- Fact Conflicts: Verkäuferangabe ≠ verified → Warnung

Siehe [CLEVER_CONVERSATION_UI.md](CLEVER_CONVERSATION_UI.md).

## Safe Offer Boundary

| Angebotsart | Clever darf |
|-------------|-------------|
| Barkauf | Deterministisch rechnen mit verifizierten Preisen + Rabatt |
| Leasing / Finanzierung | Rate/PDF vom Verkäufer übernehmen – keine Bankrate erfinden |

## Source Awareness

| Wert | Typische Source |
|------|-----------------|
| Schwarzmetallic verfügbar | `seller_input` |
| AHK wichtig | `customer_need` |
| 48 Monate / 10.000 km | Wish / Konditionen |

## Tests

```bash
node src/services/dealer/sellerOfferAssistFlow.test.js
node src/services/dealer/sellerAppointmentAssistFlow.test.js
node src/services/dealer/sellerInlineComposerAssist.test.js
node src/services/dealer/magicOfferService.test.js
```
