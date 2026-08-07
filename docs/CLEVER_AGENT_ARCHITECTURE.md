# Clever Agent Architecture

Leitarchitektur ab jetzt:

**Verkäufer → natürliche Sprache → OpenAI Responses API → Clever Tool Layer → bestehende Business-Logik → Ergebnis → natürliche Clever-Antwort**

OpenAI ist das Gehirn. Clever bleibt die Wahrheit und führt aus.

## A. Bestehende Conversation-/Intent-Architektur (Inventur)

| Schicht | Pfad | Rolle |
|--------|------|--------|
| Composer UI | `CustomerAkteSharedWorkspace.jsx` | Absenden → `runCleverSellerTurn` / Chips |
| Deterministischer Seller-Turn | `cleverSeller/runCleverSellerTurn.js` | Intent/Facts → `planSellerActions` → Review |
| Seller Tool Registry (ohne LLM-Loop) | `cleverSeller/toolRegistry.js` | `prepare_offer`, `draft_customer_message`, … |
| Magic Offer | `dealer/magicOfferService.js` | Intent → Grounding → Safe Calc |
| Offer Persistenz | `dealerAiOfferCreate.js` (`executeSaveOfferDraft`, `finalizeLeadWithOfferDraft`) | Karte/Offer auf Lead |
| Message Writer | `crm/magic/generateCleverCustomerMessage.js` + `prepareGroundedCustomerMessageSync.js` | Kundennachricht |
| Portfolio/Link | `crm/customerOfferPortfolioService.js` | Kundenlink vorbereiten |
| **Kunden-**Conversation Agent (Vorbild) | `clever/openai/runCleverTurn.js` + `openAiResponsesClient.js` | Responses API + Tool-Loop (Endkunde) |
| Server Seller-Turn | `POST /api/v1/clever/seller-turn` | Slim-Lead + optional OpenAI-Interpret |

Primäre Seller-Logik heute: **Keyword/Intent/Chip → planSellerActions → Review → Accept**.  
Das bleibt als Fallback; der neue Agent ersetzt die Interpretation.

## B. Business-Funktionen als Tools (wiederverwenden)

| Tool | Bestehende Logik |
|------|------------------|
| `get_customer_context` | `buildCustomerUnderstanding`, Wish/NeedProfile, Snapshot-Fakten |
| `list_offers` / `get_offer` | `crm.vehicleOffers`, Board-/Kartenfelder, Working Context |
| `create_offer` | `enrichOfferTextWithCustomerWish` → `prepareMagicOffer` → `finalizeLeadWithOfferDraft` |
| `create_message` | `prepareGroundedCustomerMessageSync` (Prepare, kein Send) |
| `create_customer_link` | `prepareCustomerOfferPortfolio` |

## C. UI-gekoppelt (dünne Schicht nötig)

- Offer-Save brauchte früher `DealerAIPage`-Closure (`addLead`/`updateLead`).  
  Agent liefert **Lead-Mutation**; Composer wendet sie lokal an.
- Universal Review bleibt für Legacy-Turns; Agent-Pfad kann direkt Mutationen + Composer-Draft setzen.

## D. Behalten

- Magic Offer / Safe Calc (keine LLM-Raten)
- Grounded Message Writer
- Portfolio/Link
- OpenAI nur serverseitig (`OPENAI_API_KEY`)
- `openAiResponsesClient`-Muster (Tool-Loop)

## E. Später entfallen / zurückstufen

- Chip-Keyword-Steuerung als Hauptlogik
- Riesige Intent-Listen in `interpretSellerInput` als Primärpfad
- Hardcodierte Antworttexte für „Angebot erstellen“

Chips bleiben **Quick Prompts** → gleicher Agent-Endpoint.

## Neue Module

```
src/services/cleverAgent/
  cleverAgentService.js      # Agent-Loop Orchestrierung
  cleverSystemPrompt.js
  cleverContextBuilder.js
  cleverToolRegistry.js
  cleverToolExecutor.js
  cleverAgentTypes.js
  cleverAgentResultSchema.js
  applyCleverAgentMutations.js
  cleverAgentClient.js       # Browser → POST /api/v1/clever-agent
  tools/*.js

server/cleverAgentRoutes.js  # POST /api/v1/clever-agent
```

## Agent-Loop

1. User-Nachricht + Lead-Snapshot  
2. `buildCleverCustomerContext(lead)`  
3. Responses API + Tool-Definitionen  
4. Tool Calls validieren → ausführen → Ergebnis zurück  
5. max. 8 Runden  
6. Finale Antwort: `{ message, artifacts, suggestedActions, mutations, debug? }`

## Read / Write / External

- **READ:** context, list/get offer  
- **WRITE:** create_offer, create_message (Prepare), create_customer_link (Prepare)  
- **EXTERNAL SEND:** später `send_email` / Portfolio senden – nur bei klarer Sendeabsicht

## E2E-Szenarien (Tools)

| Eingabe | Erwartetes Tool | Notes |
|--------|-----------------|-------|
| „Angebot erstellen“ | `create_offer` | Konditionen aus Context; Mutation auf Lead |
| „Mach das gleiche mit 15.000 km“ | `create_offer` (baseOnCurrentOffer) | Override nur km |
| „Wie hoch ist das aktuelle Angebot?“ | `get_offer` / `list_offers` | kein create |
| „Schreib ihm freundlich …“ | `create_message` | Draft, kein Send |
| „Fass mir den Kunden zusammen“ | oft kein Tool / `get_customer_context` | nur Kontext |
| „Schick ihm die Mail“ | später Send-Tool; jetzt Prepare + Hinweis | Send ≠ Prepare |

## Feature Flags

```
CLEVER_AGENT_ENABLED=true
VITE_CLEVER_AGENT_ENABLED=true
OPENAI_API_KEY=...
OPENAI_CLEVER_AGENT_MODEL=gpt-4.1   # oder OPENAI_MODEL
CLEVER_AGENT_DEBUG=true            # Dev only
CLEVER_AGENT_MAX_TOOL_ROUNDS=8
```

## Definition of Done (dieser Schritt)

In der Kundenakte: „Angebot erstellen“ → Tool `prepare_offer` → Prepared Action (keine Blind-Persistenz) → Clever bestätigt Konditionen.  
„Schreib ihm …“ → `create_message` → Draft, kein Auto-Send.  
„Schick ihm …“ → Draft + Confirmation.  
„das gleiche mit 15.000 km“ → Working Memory.  
Messy: EV2 Air + WP + weiß → Grounding + Registry.

Golden: `src/services/cleverAgent/cleverAgent.golden.test.js`

