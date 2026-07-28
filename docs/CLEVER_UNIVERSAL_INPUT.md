# Clever Universal Input

**Status:** v1.0 – Orchestrator Contract  
**Stand:** Juli 2026

## USP

> Wirf mir alles hin. Ich kümmere mich darum.

Der Verkäufer sortiert nicht. Clever sortiert.

Der Composer ist **nicht nur Texteingabe**. Er ist der universelle Eingang in Clever: tippen, sprechen, paste, Dokument, Foto. Clever versteht, klassifiziert, strukturiert, erkennt Fehlendes und bereitet Aktionen vor.

## Architekturgesetz

| Rolle | Verantwortung |
|-------|----------------|
| OpenAI (optional) | Interpretiert Sprache, Entities, Mehrdeutigkeit |
| Clever | Validiert, entscheidet Persistenz, plant Actions |
| Bestehende CRM-Pfade | Schreiben Customer Truth / Messages / Docs / Offer |

**Nicht:** „KI schreibt alles ins CRM.“  
**Sondern:** „KI schlägt Interpretation vor – Clever validiert und schreibt über definierte Pfade.“

## Entry

```js
import { runCleverSellerTurn } from '../services/cleverSeller/runCleverSellerTurn.js';

const result = runCleverSellerTurn({
  lead,
  sellerInput,
  attachments,
});
```

Feature-Flag: `CLEVER_SELLER_ORCHESTRATOR_ENABLED` (Default an; `false` = kein Action-Plan, Interpretation bleibt).

## Result Contract (`CleverSellerTurnResult`)

- `intent` / `intents[]` – Multi-Intent
- `inputMode` – `clever_work_input` | `customer_message` | `ambiguous`
- `extractedFacts[]` – mit `factClass`, `source`, `confidence`, `needsConfirmation`
- `proposedUpdates[]` – **Vorschläge**, kein Blind-Write
- `missingInformation[]` – nur was für die Aufgabe fehlt
- `preparedActions[]` – an bestehende Assist-Flows gebunden
- `assistantReply` – menschenlesbar
- `pendingAction` – Seller Working State ≠ Customer Truth
- `uiEffects.capturedFacts` – für Magic Capture

## Fact-Klassen (Auszug)

`customer_fact` ≠ `customer_need` ≠ `commercial_preference` ≠ `vehicle_interest` ≠ `trade_in_fact` ≠ `self_disclosure_fact` ≠ `offer_instruction`

## Module

| Datei | Rolle |
|-------|--------|
| `runCleverSellerTurn.js` | Orchestrator |
| `interpretSellerInput.js` | Multi-Fact + Multi-Intent |
| `proposeSellerUpdates.js` | proposedUpdates + Dedup |
| `resolveMissingInformation.js` | Missing Info |
| `planSellerActions.js` | Tool-Anbindung |
| `cleverSellerTurnResultSchema.js` | Result Contract |
| `buildUniversalReviewModel.js` | „Clever hat verstanden“-UI-Model |
| `applyAcceptedSellerTurn.js` | Übernehmen → sellerInsights / tradeIn |

## Review-Flow (Priorität 1 – gebaut)

```
Composer-Eingabe
  → runCleverSellerTurn()
  → shouldShowUniversalReview? → SellerUniversalReviewCard
  → [Übernehmen] → applyAcceptedSellerTurn()
  → Persistenz über onPersistLead (sellerInsights + tradeIn + wish/contact/needProfile)
  → Notizzettel zeigt neue Chips
```

**Kein Auto-Apply.** Verkäufer bestätigt immer die Review-Card.

Nach **Übernehmen** schreibt `applyStructuredFactsToLead` u. a. Wunschrate, km, Laufzeit, Telefon/Name, needProfile (Haushalt/Finanzen/Farbe/Modell).

### Review-Handoff (Schritt 1a)

Nach **Übernehmen**:
- `prepare_offer` vorbereitet → Angebotsflow öffnen
- `draft_message` vorbereitet → Nachricht im Composer zum Senden
- Explizit „Schreib ihm …“ → **kein** Universal-Review (Message-Pfad)
- Portal „Antworten“ → Composer mit Seed (nicht CleverAntworten-Sheet)

### CRM Heute (Schritt 2)

- `buildSellerTodayWorklist` – fällig / überfällig / call_today
- `matchesFollowUpView` inkl. überfällige `followUpAt`
- `getDueToday` mischt Reminder + CRM-Wiedervorlagen
- Dashboard „Clever empfiehlt heute“ priorisiert überfällige WV

### Composer → Portfolio (Schritt 3)

- Intent `send_portfolio` („Schick ihm die Angebote / Kundenlink“)
- Inline-CTA → `handlePrepareCustomerLink` (bestehendes Share-Sheet)
- Magic-Handoff: Composer/Review → `magic-offer-review` in DealerAIPage

## Was bewusst nicht gebaut wurde

- Keine zweite Customer-Truth / Notizzettel-DB
- Kein Full-Lead-JSON an OpenAI
- Kein Auto-Send an Kunden (weiterhin Share-Sheet mit Bestätigung)
- Kein Slash-Command-Zwang
- Kein großflächiges Auto-Apply (auch nicht nach Review)
- CleverAntworten noch nicht entfernt

## Nächste Schritte (Launch-Loop)

1. ~~Review-Handoff + Message-Pfad + Portal→Composer~~ ✓
2. ~~Strukturierte Übernahme (wish/contact/needProfile)~~ ✓
3. ~~Verkäufer-Alltag härten: WV / Pipeline ohne KI~~ ✓
4. ~~Composer → Portfolio-Mail + Magic-Handoff~~ ✓
5. Smoke laut [CLEVER_PILOT_LAUNCH_CHECKLIST.md](./CLEVER_PILOT_LAUNCH_CHECKLIST.md) – 2 Wochen Pilot

Siehe auch: [CLEVER_SELLER_ASSISTANT.md](CLEVER_SELLER_ASSISTANT.md), [CLEVER_MANIFEST.md](CLEVER_MANIFEST.md)
