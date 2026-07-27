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

## Was bewusst nicht gebaut wurde

- Keine zweite Customer-Truth / Notizzettel-DB
- Kein Full-Lead-JSON an OpenAI
- Kein Auto-Send an Kunden
- Kein Slash-Command-Zwang

## Nächste Schritte

1. Composer UI: Universal-Result-Card (Review → Confirm → Execute)
2. Attachment-Pipeline an bestehende Document-/SA-Services
3. Optionale AI-Escalation über `runCleverSellerCopilot` (Safe Context)
4. Persistenz-Adapter nur für `autoApply`-Updates über Seller Insights / Need Profile

Siehe auch: [CLEVER_SELLER_ASSISTANT.md](CLEVER_SELLER_ASSISTANT.md), [CLEVER_MANIFEST.md](CLEVER_MANIFEST.md)
