# Clever Seller Assistant

**Status:** v2.2 – Universal Input Orchestrator + Notizzettel-first  
**Stand:** Juli 2026

## Leitsatz

Clever ist kein CRM, das der Verkäufer bedienen muss.  
Clever ist der Assistent, dem der Verkäufer sagt, was für diesen Kunden erledigt werden soll.

**„Wirf mir alles hin. Ich kümmere mich darum.“**

**Der Verkäufer nennt das Ziel (oder wirft unsortierte Infos hin).  
Clever verwendet vorhandenen Kundenkontext und fragt nur nach den Informationen, die zur Ausführung wirklich fehlen.**

Der Composer ist der **universelle Eingang** – nicht nur Texteingabe. Siehe [CLEVER_UNIVERSAL_INPUT.md](CLEVER_UNIVERSAL_INPUT.md).

**Notizzettel-Chips sind nicht nur Anzeige.  
Sie sind direkte Arbeitsobjekte des Verkäufers.**

**Termine sind ein Werkzeug von Clever, kein eigenes Hauptprodukt.**  
Clever erkennt einen sinnvollen Terminmoment, der Verkäufer schlägt vor, der Kunde bestätigt, Clever übernimmt den bestätigten Termin in den Prozess (CRM-Wiedervorlage / followUpAt – kein Kalender-Klon).

## Architektur: Universal Orchestrator

| Baustein | Datei |
|----------|--------|
| `runCleverSellerTurn` | `src/services/cleverSeller/runCleverSellerTurn.js` |
| Fact-/Intent-Interpretation | `interpretSellerInput.js` |
| proposedUpdates | `proposeSellerUpdates.js` |
| Missing Info | `resolveMissingInformation.js` |
| Action Plan | `planSellerActions.js` |

`runSellerAssistantTurn` hängt das Universal-Result unter `universal` an (Flag `CLEVER_SELLER_ORCHESTRATOR_ENABLED`).

**Regel:** Interpretation ≠ Persistenz. Persistenz nur über bestehende Pfade nach Review.

## UX-Philosophie

**Eine geöffnete Kundenansicht = ein scrollbarer Feed.**

| Zone | Rolle |
|------|--------|
| Header + Notizzettel | Kopf des Verkäufers (sticky / collapsible, semantisch gruppiert) |
| Verlauf | Die Kundenakte (chronologisch: Chat, Clever, Angebote, Docs, Termine) |
| Composer | Der Schreibtisch (Intent → sichtbare Clever-Result-Card → Bestätigung) |

**Magic:** Jede natürliche Seller-Eingabe erzeugt, wenn sinnvoll, sofort eine sichtbare Clever-Reaktion (verstanden / bekannt / fehlt / nächste Aktion). Keine technischen CTAs wie „Angebotsrechner öffnen“ als Primärmoment.

Keine permanenten Tabs Kunde | Clever | Angebote | Mehr innerhalb des Kunden.  
Strukturierte Übersichten liegen unter **Name / •••** (Messenger-Kontaktinfos).

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
node src/services/cleverSeller/runCleverSellerTurn.test.js
```
