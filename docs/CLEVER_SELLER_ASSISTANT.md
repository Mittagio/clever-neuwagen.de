# Clever Seller Assistant

**Status:** v3.0 – Composer = zentraler Verkaufsassistent  
**Stand:** Juli 2026

## Produktgesetz

> **Der Composer ist nicht ein Eingabefeld in Clever. Der Composer ist Clever.**

Der Verkäufer formuliert sein Ziel. Clever beschafft den Kontext, denkt mit,
bereitet die Arbeit vor und fragt nur das wirklich Fehlende.

Clever ersetzt drei klassische Assistenzen **über denselben Composer**:

1. **Wissensassistent** – verifizierte Fahrzeugfakten, Pakete, Preise (keine erfundenen Zahlen)
2. **Kommunikationsassistent** – Kundennachrichten, Ton, Erklärung
3. **Organisationsassistent** – Akte, Angebote, Termine, Verlauf, Dokumentation

## Leitsatz

Clever ist kein CRM, das der Verkäufer bedienen muss.  
Clever ist der Assistent, dem der Verkäufer sagt, was für diesen Kunden erledigt werden soll.

**„Wirf mir alles hin. Ich kümmere mich darum.“**

Chips (+ Angebot, + Nachfassen, …) hängen Kontext an oder inspirieren – sie ersetzen nicht den freien Composer.

## Zentraler Datenfluss

```
SELLER INPUT
  → Intent + Ziel verstehen
  → Kunden- und Working-Context laden (resolveAssistantContext)
  → Fakten / Tools bestimmen
  → Verifizierte Daten abrufen
  → Fehlende Infos bestimmen
  → Aktionen planen (planSellerActions)
  → Kompakte Review
  → Seller bestätigt
  → Ausführen und dokumentieren
```

OpenAI interpretiert und formuliert. Clever lädt, validiert, plant, persistiert – und führt externe Aktionen **erst nach Freigabe** aus.

## Architektur: Central Assistant Turn

| Baustein | Datei |
|----------|--------|
| `runCleverSellerTurn` | `src/services/cleverSeller/runCleverSellerTurn.js` |
| Context Resolver | `resolveAssistantContext.js` |
| Tool Registry | `toolRegistry.js` |
| Fact-/Intent-Interpretation | `interpretSellerInput.js` |
| proposedUpdates | `proposeSellerUpdates.js` |
| Missing Info | `resolveMissingInformation.js` |
| Action Plan | `planSellerActions.js` |
| Review Model | `buildUniversalReviewModel.js` |
| Result Contract | `cleverSellerTurnResultSchema.js` |

**Rückgabevertrag (Auszug):** `intent`, `interpretedGoal`, `resolvedCustomer`, `resolvedWorkingContext`, `extractedFacts`, `retrievedFacts`, `usedCustomerContext`, `missingInformation`, `proposedUpdates`, `preparedActions`, `messageDraft`, `warnings`, `confidence`, `uiEffects.progressLines`.

Nicht nur `{ text: "..." }`.

**Regel:** Interpretation ≠ Persistenz. Persistenz nur über bestehende Pfade nach Review.  
Kein Full-Lead-JSON an OpenAI – nur `buildMinimalTaskContext` / `buildMinimalMessageContext`.

## Golden Cases

| Case | Input | Erwartung |
|------|--------|-----------|
| 1 | „Schreibe Garritano ein Angebot für den Picanto GT-Line für 17.000 €.“ | Kunde + Fahrzeug + Kaufpreis → Angebot + Nachricht in einer Review |
| 2 | „Schreib Garritano … schwarzen Picanto … Technologie-Paket …“ | Seller-Facts + verifiziertes Paketwissen → Nachricht |
| 3 | „Schlag ihm vor, Montag 15 Uhr …“ | Termin + Kundennachricht aus Working Context |
| 4 | „Was hatte ich Garritano … Lieferzeit geschrieben?“ | Verlaufssuche, **keine** neue Kundennachricht |
| Brandes | „Sportage zu teuer, XCeed findet er gut, AHK/Rot/Lieferzeit“ | Spuren: deferred + Favorit · Review „einsortiert“ · Angebot anpassen |
| Golden Moment | „Was ist der nächste Schritt?“ | Erklärbarer nächster Schritt aus Journey/`buildGoldenMoment` |
| Attachments | PDF/Dokument am Composer | Working Context (`document`/`offer`) – keine Customer Truth |
| Chips / Magic | Inspiration → zentraler Turn | Kein paralleler Text-Silo; Multi-Accept für Angebot+Nachricht+Termin |

Ambiguity: Leasing-Lead + „17.000 €“ → einmalige Klärung Kauf vs. Leasingbasis.

**Master-Suite:** `src/services/cleverSeller/masterGoldenFlows.test.js` – alle Flows inkl. Multi-Accept-Shape und Legacy-Bridge.  
**Global Composer (Slice 1):** `src/services/cleverSeller/globalComposer.slice1.test.js` – Dashboard „Was liegt heute an?“ + „XCeed Anhängelast?“.  
**Global Composer (Slice 2):** `src/services/cleverSeller/globalComposer.slice2.test.js` – Kundensuche, Kontext, Historie, Offer-Sent.  
**Global Composer (Slice 3):** `src/services/cleverSeller/globalComposer.slice3.test.js` – Kunde + Kaufangebot + Nachricht + Handoff.  
**Global Composer (Slice 4):** `src/services/cleverSeller/globalComposer.slice4.test.js` – verifiziertes Fahrzeugwissen + natürliche Kundennachricht.  
**Global Composer (Slice 5):** `src/services/cleverSeller/globalComposer.slice5.test.js` – Terminvorschlag + Nachricht + Follow-ups.  
**Global Composer (Slice 6):** `src/services/cleverSeller/globalComposer.slice6.test.js` – Altvertrag Intake + Review + Confirm.  
**Global Composer (Slice 7):** `src/services/cleverSeller/globalComposer.slice7.test.js` – Vertrag nachschlagen aus Contract Memory.  
**Global Composer (Slice 8):** `src/services/cleverSeller/globalComposer.slice8.test.js` – Vertragsende → Golden Moment / Journey Reminder.  
**Global Composer (Slice 9):** `src/services/cleverSeller/globalComposer.slice9.test.js` – Altvertrag vs. Angebot vergleichen.  
**Global Composer (Slice 10):** `src/services/cleverSeller/globalComposer.slice10.test.js` – Vergleichsnachricht aus Diffs (kein Auto-Send).  
**Global Composer (Slice 11):** `src/services/cleverSeller/globalComposer.slice11.test.js` – PDF-Text → Contract Intake (`contract_pdf`).  
**Global Composer (Slice 12):** `src/services/cleverSeller/globalComposer.slice12.test.js` – Akte-PDF Klassifikation Vertrag vs. Konfigurator.  
**Global Composer (Slice 13):** `src/services/cleverSeller/globalComposer.slice13.test.js` – Dashboard-PDF → Contract Intake + Snapshot-Resolve.  
**Global Composer (Slice 14):** `src/services/cleverSeller/globalComposer.slice14.test.js` – Angebot + Terminvorschlag gemeinsam.  
**Global Composer (Slice 15):** `src/services/cleverSeller/globalComposer.slice15.test.js` – Dual-pending + Dual-Accept ohne Auto-Send/Book.

Siehe auch [CLEVER_GLOBAL_COMPOSER.md](CLEVER_GLOBAL_COMPOSER.md).  
**Contract Memory:** [CLEVER_CONTRACT_MEMORY.md](CLEVER_CONTRACT_MEMORY.md).

## Legacy-Bridge

`runSellerAssistantTurn` (älterer Einstieg) ruft bei aktivem Orchestrator zuerst `runCleverSellerTurn` auf und mappt über `mapUniversalTurnToAssistantResult` auf die bisherigen Result-Typen (`offer_draft`, `message_draft`, `appointment_draft`, `workspace_package`). Rückgabe enthält immer `universal` (voller Turn) sowie `path: 'universal' | 'legacy'` – `universal`, wenn das Mapping greift (Angebot, Dokumente, Termin, Draft); sonst Legacy-Fallback (z. B. reine Verfügbarkeitsnotiz ohne `messageDraft`). Die UI im Shared Workspace nutzt bevorzugt den Universal-Turn direkt (Review + Multi-Accept).

## UX-Philosophie

**Eine geöffnete Kundenansicht = ein scrollbarer Feed.**

| Zone | Rolle |
|------|--------|
| Header + Notizzettel | Kopf des Verkäufers (sticky / collapsible, semantisch gruppiert) |
| Verlauf | Die Kundenakte (chronologisch: Chat, Clever, Angebote, Docs, Termine) |
| Composer | Der Schreibtisch (Ziel → Progress → Review → Bestätigung) |

**Magic sichtbar:** kurze Progress-Zeilen (Kunde / Fahrzeug / Preis erkannt), dann kompakte Review-Card. Keine Show ohne Inhalt.

Keine permanenten Tabs Kunde | Clever | Angebote | Mehr innerhalb des Kunden.  
Strukturierte Übersichten liegen unter **Name / •••** (Messenger-Kontaktinfos).

Kundenkontext (customer_need) und Verkäufer-Notizen (seller_input) sind **klar getrennt**.

## Komponenten

| Baustein | Datei |
|----------|--------|
| Notizzettel | `CustomerAkteCleverNotepad.jsx` |
| Konditionen-Sheet | `CustomerAkteWishConditionsSheet.jsx` |
| Shared Chat / Composer | `CustomerAkteSharedWorkspace.jsx` |
| Universal Review | `SellerUniversalReviewCard.jsx` |
| Inline Card | `SellerInlineAssistCard.jsx` |
| Intent | `sellerActionIntent.js` |
| Offer Assist Flow | `sellerOfferAssistFlow.js` |
| Appointment Assist Flow | `sellerAppointmentAssistFlow.js` |
| Magic Offer / grounded Message | `src/services/crm/magic/` |
| Inline Assist | `sellerInlineComposerAssist.js` |
| Akte-Suche | `composerAkteSearch.js` |
| Einbindung | `DealerAiLeadFollowUp.jsx` |

## Teil A – Notizzettel bearbeiten

1. Tap auf Konditions-Chip (`Leasing`, `Laufzeit offen`, …) → `WishConditionsSheet` (fokussiertes Feld).
2. Tap auf Wunsch-Chip / `+N` → Kundenhelfer.
3. Übernehmen speichert über bestehende Wish-/Lead-Pfade (`applyWishConditions`) – keine Chip-Doppelwelt.

## Teil B – „Was soll Clever erledigen?“

1. Verkäufer tippt oder spricht im Composer.
2. Ein Turn → ggf. **mehrere** `preparedActions` (Angebot + Nachricht + Termin).
3. Review zeigt gemeinsame Vorbereitung; keine Auto-Sendung.
4. Follow-up im selben Composer: „21 %“, „Leasing“, „morgen 15 Uhr“ → Korrektur.
5. Verifizierte Facts via Clever-Datenquellen – keine erfundenen Zahlen.
6. Freigabe → bestehende Persistenz-/Sendepfade.

## Live Customer Context

`resolveAssistantContext` Priorität: geöffneter Kunde → genannter Name → angehängtes Angebot/Fahrzeug → Workspace → Fahrzeugspur → letzte Aktivität → Historie (nur bei Suche).

`buildSellerInlineContext(lead)` und `buildAttributedWishChips` speisen Notizzettel und Assist.

Siehe [CLEVER_CONVERSATION_UI.md](CLEVER_CONVERSATION_UI.md) und [CLEVER_UNIVERSAL_INPUT.md](CLEVER_UNIVERSAL_INPUT.md).

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
node src/services/cleverSeller/composerAssistant.golden.test.js
node src/services/cleverSeller/runCleverSellerTurn.test.js
node src/services/dealer/sellerOfferAssistFlow.test.js
node src/services/dealer/sellerAppointmentAssistFlow.test.js
node src/services/dealer/sellerInlineComposerAssist.test.js
node src/services/crm/composerAkteSearch.test.js
```
