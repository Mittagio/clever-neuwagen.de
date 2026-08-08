# Clever 2.0 – Architecture Gap Audit + 3-Sprint-Plan

**Status:** Sprint 1 + 2 + 3 + Post-Polish + Residual Fixes **code-exhausted** (kein Big Bang). UI (Akte/Chips/Dashboard) eingefroren – Feed/Conversation polish innerhalb bestehender Patterns.  
**Produktsatz:** Der Verkäufer bedient kein CRM. Er spricht mit Clever.  
**Hinweis:** Abschnitte A–H unten sind die **Ausgangslage** vor den Sprints. Aktueller Stand → Sprint-Status + Residual + Ship Checklist.

---

## Gap Audit

### A. Welche Composer-Pfade existieren noch parallel?

| Surface | Entry | Agent? | Deterministik |
|---------|--------|--------|----------------|
| **Kundenakte** | `CustomerAkteSharedWorkspace.runCleverProposeFromInput` | Ja, wenn `VITE_CLEVER_AGENT_ENABLED` + Route `clever_agent` → `POST /api/v1/clever-agent` | Sonst / Fallback: `runCleverSellerTurnWithCalendar` |
| **Dashboard Global Composer** | `CleverGlobalComposer` | **Nein** – kein Agent-Client | Nur `runCleverSellerTurn` (+ optional Server `/clever/seller-turn` bei OpenAI-Interpret) |
| **Legacy Magic** | `runMagicCompose` in SharedWorkspace | Nein | Orchestrator + Message Writer |
| **Chips / Shortcuts** | gleicher Akte-Pfad | Gleich wie Freitext wenn Agent an | Intent-Constraint filtert Facts |
| **PDF / Screenshot** | `handleAttachFile` / OCR Turn | Nein | `runComposerPdfAttachTurnWithOcr` → Seller Turn |
| **Server** | `server/cleverAgentRoutes.js` | Agent-Loop | Flags: `CLEVER_AGENT_ENABLED` + `OPENAI_API_KEY` |
| **Server seller-turn** | `POST /api/v1/clever/seller-turn` | Interpret-Eskalation | Default Orchestrator |

**Kernproblem:** Zwei Surfaces, zwei Gehirne. Global Composer kennt den Agenten nicht. Akte hat Agent nur hinter Flags (Default oft aus).

**Nachtrag (Detail-Audit):** Agent wird in der Akte zusätzlich umgangen durch:
- `isComposerAkteSearchQuery` → sync `runCleverSellerTurn`
- `runMagicCompose` → Calendar/Orchestrator ohne Agent
- PDF/OCR-Attach-Turns
- Deterministische Akte-Turns aktualisieren `agentWorkingMemory` **nicht**

Chip-Pipeline: `runComposerChipThroughTurn.js` → nur Seller-Turn.

---

### B. Wo wird `conversationHistory` leer übergeben?

| Ort | Befund |
|-----|--------|
| `CustomerAkteSharedWorkspace.jsx` | `requestCleverAgent({ … conversationHistory: [] })` – **hardcoded leer** |
| `server/cleverAgentRoutes.js` | akzeptiert `conversationHistory = []` Default |
| `cleverAgentService.js` | kann History nutzen, bekommt aber nichts |
| `clever/openai/runCleverTurn.js` | Kunden-Agent hat History-Param – **Seller-Composer nutzt das nicht** |

**Working Memory (partiell):**  
`cleverAgentWorkingMemory.js` – lastIntent, vehicle, offer, pending, previousOfferPreparation, lastRequestedChanges.  
**Fehlt:** Turn-Log (Seller/Clever messages), last message draft id, last appointment proposal, last search query, customer switch (“und Brandes?”), rewrite chain.

**Follow-up-Mapping:**
| Phrase | Heute | Gap |
|--------|--------|-----|
| „das gleiche mit … km“ | `previousOfferPreparation` + Route | kein History; Global ohne Agent-Memory |
| „doch lieber rot“ | `lastRequestedChanges` Heuristik | kein Color-Slot; Deterministik speichert Memory nicht |
| „schreib ihm das“ | – | kein `lastPreparedMessage` |
| „lieber Montag“ | Seller-Turn `isAppointmentFollowUpInput` | nicht in Agent-Memory; kein Appointment-Tool |
| „und Brandes?“ | – | Akte sendet kein `leadsSnapshot` an Agent |

---

### C. Welche Agent Tools existieren bereits?

Aus `cleverToolRegistry.js` / `CLEVER_AGENT_TOOLS` (**nach Sprint 2: 33 Tools**):

| Tool | Status |
|------|--------|
| `get_customer_context` | implementiert |
| `summarize_customer` | implementiert (wrap `summarizeCustomerContext`) |
| `remember_customer_information` | implementiert |
| `search_customer_history` | implementiert (Akte/Global History) |
| `list_offers` / `get_offer` | implementiert |
| `prepare_offer` / `create_offer` | implementiert (Confirmation) |
| `create_message` | implementiert (kein Auto-Send) |
| `create_customer_link` | implementiert |
| `find_customer` / `open_customer` / `update_customer_facts` | Sprint 2 – Legacy wrap |
| `lookup_vehicle_fact` / `lookup_package` / `lookup_equipment` / `compare_vehicles` | Sprint 2 |
| `modify_offer` / `import_offer_pdf` / `compare_contract_offer` | Sprint 2 |
| `rewrite_message` / `intend_send` | Sprint 2 |
| `propose_appointment` / `modify_appointment` / `check_availability` | Sprint 2 |
| `classify_attachment` / `import_contract` | Sprint 2 |
| `prepare_trade_in` | Sprint 2 |
| `get_today_overview` / `create_follow_up` | Sprint 2 |
| `search_offers` / `search_contracts` / `search_documents` | Sprint 2 |

Legacy-Registry bleibt Quelle der Wahrheit; Agent wrappt über `wrapSellerTool` / `tools/sellerCoverageTools.js`.

---

### D. Legacy Services → sofort Tools (keine zweite Engine)

| Domain | Bestehende Logik (Anbindung) | Agent heute |
|--------|------------------------------|-------------|
| Customer find/open | `resolveAssistantContext`, FIND/OPEN in planSellerActions | fehlt |
| summarize / remember / history | summarizeCustomerContext, remember tool, search_customer_history | teilweise |
| update | `applyStructuredFactsToLead` / applyAcceptedSellerTurn | nur via remember-Insights |
| Vehicle fact/package/equipment | `answerSellerVehicleKnowledge`, lookup tools in seller registry | fehlt |
| comparison | knowledge / lineup helpers | fehlt |
| Offer prepare/modify | magicOffer / prepare_offer, baseOnCurrentOffer | prepare ja, modify schwach |
| Offer import/compare | contract import/compare services | fehlt |
| Customer room / portfolio | `prepareCustomerOfferPortfolio` | `create_customer_link` |
| Message draft/rewrite | prepareGrounded / generateCleverCustomerMessage | draft ja, rewrite fehlt |
| Appointment | sellerAppointmentAssistFlow, propose in planSellerActions | fehlt |
| Document/OCR/contract | extractMagicOfferPdf, contract intake | fehlt |
| Trade-in | detectTradeIn, prepare_trade_in | fehlt |
| Today / follow-up | get_today_overview, Clever Empfiehlt | fehlt |
| Search offers/contracts/docs | composerAkteSearch / contract search | history partial |

---

### E. Welche Turn-Typen erzeugen unnötig Reviews?

`shouldShowUniversalReview` (`buildUniversalReviewModel.js`) ist **sehr breit**:

- Wissen / Lookup / Today / History / Summary → Review (**sollte DIRECT_ANSWER sein**)
- Recommend next step → Review (**COMPACT oder Direct + Actions**)
- Fast jeder Dump mit ≥2 Facts → Review (**COMPACT_CONFIRMATION reicht oft**)
- Zero-Loss save_with_undo / partial umgeht Review für Merken – gut
- Offer incomplete / Appointment / Inbound / Contract / Send → Review (**korrekt PREPARED_ACTION**)

**Folge:** Lesen und Merken fühlen sich wie Formulare an.

---

### F. Seller-facing Assistant Response – zentral modellieren?

| Heute | Problem |
|-------|---------|
| `buildSellerAssistantReply` | Template-Zeilen, oft hinter Review versteckt |
| `agentResult.message` | Agent-Antwort, UI oft Feed-Card oder still |
| Universal Review titles | „✨ Angebot“ statt Gespräch |
| Feedback-Toasts | stark reduziert; kein Chat-Thread |

**Vorschlag (neues schmales Modul, kein UI-Big-Bang):**

`src/services/cleverAgent/cleverAssistantResponse.js`

```ts
{
  responseKind: 'direct_answer' | 'compact_confirmation' | 'clarification' | 'prepared_action_review',
  message: string,          // seller-facing
  chips?: string[],         // für compact
  undoAvailable?: boolean,
  clarificationOptions?: [],
  preparedAction?: {},      // nur bei prepared_action_review
  artifacts?: [],
}
```

Composer rendert: Message im Feed immer; Review-Card **nur** bei `prepared_action_review`.

---

### G. Pending / Conversation Memory

| Struktur | Wo | Für Follow-ups |
|----------|-----|----------------|
| `agentWorkingMemory` | Akte state | „das gleiche“, km/Farbe teilweise |
| `previousOfferPreparation` | memory + API | Offer-Follow-ups |
| `pendingAction` | memory / agentResult | Confirm Send/Offer |
| `universalTurn` | UI state | Legacy Review, nicht Agent-History |
| `offerPrep` | UI | Offer confirm |
| `lastComposerAction` | CRM helper | Message edit, schwach |
| `conversationHistory` | **leer** | **blockiert** „schreib ihm das“, „kürzer“, „lieber Montag“ |

**Für Golden Follow-ups nötig:**

- lastMessageDraft (+ body)
- lastAppointmentProposal
- lastKnowledgeAnswer
- lastResolvedCustomer / cross-customer hint (“Brandes”)
- lastTurns: [{ role, kind, summary, refs }] max 8–12
- pendingConfirmation

---

### H. Full-Lead-Dumps an OpenAI – Risiko?

| Pfad | Schutz |
|------|--------|
| `buildCleverCustomerContext` | **Kompakt** – kein Full-Lead, keine Raw-CRM-Dumps; hasEmail/hasPhone statt Klartext-Kontakt in Teilen |
| `buildSellerInterpretSafeContext` | Labels/Hints, redacted PDF excerpts, Input capped |
| Agent Route | slim lead + contextPreview |
| Risk | `leadsSnapshot` bei search wenn ungekürzt; Debug logs; Attachments wenn Excerpts zu groß |

**Fazit:** Grundrichtung gut. Hardening: Snapshot-Caps, nie `JSON.stringify(lead)`, PII-Policy in Prompt behalten.

**Nachtrag Slim-Lead:** `slimLeadForAgent` (Server) ist größer als Interpret-Safe-Context: kann Phone/Email, Portfolio-Token/URL, bis 12 Configs enthalten – Prompt selbst nutzt `buildCleverCustomerContext` (kompakter), HTTP-Body und Runtime bleiben sensibel. Akte setzt `leadsSnapshot` am Agent-Call derzeit nicht → globales Finden im Agent schwach.

**Quellen:** Detail-Kartierung [Clever 2.0 Gap Audit](c2d199b1-574a-49a5-b61a-f85980ecd20a).

---

## Zero-Loss (verbindlich, bleibt)

Bereits: `zeroLossIntake.js`, unresolvedNotes, Partial Success.  
Sprint-Ergänzung: Korrektur ersetzt Wert, Dedup, Audit-History, later structure notes – **ohne** UI-Redesign.

---

## 3-Sprint-Plan

### Sprint 1 – One Agent / Conversation Loop

**Ziel:** Freier Clever-Modus = Agent-Pfad; History; Response Policy; weniger Review.

| Arbeit | Dateien |
|--------|---------|
| Agent Default in Akte wenn Server ready | `CustomerAkteSharedWorkspace.jsx`, `cleverAgentClient.js`, Flags `.env.example` |
| Global Composer Agent-Pfad (gleicher Client) | `CleverGlobalComposer.jsx` |
| Conversation Memory erweitern + History füllen | `cleverAgentWorkingMemory.js`, SharedWorkspace state, Agent payload |
| Response Policy + Feed-Message statt Review | **neu** `cleverAssistantResponse.js`, anbinden Agent + Seller Turn |
| `shouldShowUniversalReview` verschärfen | `buildUniversalReviewModel.js` – Knowledge/Today/History → direct |
| Follow-up Golden | `cleverAgent.golden.test.js` + neues `conversationLoop.golden.test.js` |
| Deterministik behält Validator/Safety/Fast Path | `routeSellerRequest.js`, `runCleverSellerTurn` Fallback |

**Risiken:** Flag-Chaos (Vite restart); Global vs Akte Drift; zu aggressive Review-Reduktion bei Inbound.

**DoD Sprint 1:**  
„Merk dir…“ → Compact Confirmation.  
„Was hatte ich … geschrieben?“ → Direct Answer.  
„Das gleiche mit 15.000 km“ → Follow-up ohne Modulwechsel.  
Keine Review für reine Knowledge/History.

**Status (implementiert):** Response Policy (`cleverAssistantResponse.js`), Conversation Memory + History, `shouldShowUniversalReview` verschärft (Knowledge/Today/History/Next-Step → kein Review; Brandes/reviseFavorite → Review), Agent-Pfad + Policy in Akte und Global Composer, Tests `conversationLoop.sprint1` + angepasste Golden. Manuell mit `CLEVER_AGENT_ENABLED` / `VITE_CLEVER_AGENT_ENABLED` + `OPENAI_API_KEY` smoke-testen.

---

### Sprint 2 – Tool Coverage

**Ziel:** Registry an Legacy hängen – keine zweite Engine.

| Batch | Tools (wrap existing) | Quellen |
|-------|----------------------|---------|
| Customer | `find_customer`, `open_customer`, `update_customer_facts` | resolveAssistantContext, applyStructuredFacts |
| Knowledge | `lookup_vehicle_fact`, `lookup_package`, `lookup_equipment`, `compare_vehicles` | seller toolRegistry / answerSellerVehicleKnowledge |
| Offer | `modify_offer`, `import_offer_pdf`, `compare_contract_offer` | magicOffer, contract compare |
| Message | `rewrite_message`, `intend_send` (confirm) | generateCleverCustomerMessage |
| Appointment | `propose_appointment`, `modify_appointment`, `check_availability` | sellerAppointmentAssistFlow |
| Document | `classify_attachment`, `import_contract` | PDF/OCR/contract intake |
| Trade-in | `prepare_trade_in` | detectTradeIn + plan |
| Task | `get_today_overview`, `create_follow_up` | today overview / Empfiehlt |
| Search | `search_offers`, `search_contracts`, `search_documents` | composerAkteSearch / contract search |

**Dateien:** `cleverToolRegistry.js`, `tools/sellerCoverageTools.js`, `wrapSellerTool.js`, `buildAgentReviewTurn.js`, Prompt `cleverSystemPrompt.js`, Server `leadsSnapshot`/`attachments`, Client Fallback-Härtung.

**Risiken:** Tool-Explosion → Prompt/Latency; Calendar provider missing; Contract false positives.

**DoD Sprint 2:** Golden System Test Inputs 1–10 end-to-end mit Agent (Mock OpenAI oder forced tools + 1 Live-Smoke).

**Status (implementiert):** Agent-Tool-Set von ~10 auf 33 Tools erweitert (Legacy-Wrapper, keine zweite Engine). Review-Bridge `buildAgentReviewTurn` → Universal Review bei `confirmationRequired`. Fallback `shouldFallbackToSellerTurn` (network/agent_error/feature_disabled). Server akzeptiert `leadsSnapshot` + `attachments`. Tests: `toolCoverage.sprint2.test.js` + bestehende Golden.

---

### Sprint 3 – Chat-Native Experience

**Ziel:** Feed = Assistant Conversation; Seller bleibt im Gespräch. **Kein** großes UI-Redesign – Feed-Items + Response kinds nutzen bestehende Chat-Shell.

| Arbeit | Dateien |
|--------|---------|
| Assistant messages als Feed-Karten (seller-facing) | SharedWorkspaceChat / WorkspaceChatCards, postCleverAssistFeedCard |
| Rewrite chain („kürzer“) über Memory lastDraft | workingMemory + create_message/rewrite |
| „senden“ → Confirmation only | pendingAction + Response Policy |
| „Mach zuerst Brandes“ → find/open + context switch | find_customer tool + memory.resolvedCustomer |
| Progress nur bei langen Jobs | optional, dezent |
| Golden conversation script | neues Integrationstest-Skript |

**Risiken:** Feed-Rauschen; Doppel-Posts Agent+Legacy; Undo UX ohne „Gespeichert“-Spam (Compact Confirmation mit Undo-Link).

**DoD Sprint 3:** Dialog „Was liegt heute an? → Brandes → AHK/Rot → kürzer → senden“ ohne Modulwechsel.

**Status (implementiert):**
- Agent-Result merged `resolvedCustomer` / `customerSearchResults` / `messageDraft` (`cleverAgentResultSchema` + Service).
- Working Memory: Rewrite-Chain (`lastMessageDraft` + `messageDraftHistory`), `open_customer` / `rewrite_message` / `intend_send` Intents.
- Feed-Helfer `cleverAssistantFeed.js` + Clever-Card Payload (`responseKind`, chips, open-CTA).
- Akte + Global Composer: chat-native Feed/Conversation-Card; Context-Switch Brandes (`autoOpen` / Picker mit `leadId`).
- `rewrite_message` „kürzer“ deterministisch; `intend_send` nur Confirmation (kein Auto-Send).
- Tests: `chatNative.sprint3.test.js` (DoD-Dialog + Golden 1–10 forced).

**Post-Sprint-3 Polish (implementiert):**
- Progress-Hints nur bei langen Jobs (`cleverProgressHint.js`, Delay ~1s) – Agent / PDF / Screenshot / Server-Interpret / Magic; schnelle Turns still.
- Undo-Link in Clever Feed-Card + Clever-Tab Conversation-Slot (`undoToken` + `rememberUndo`); Global Composer Compact Confirmation mit Undo im Slot.
- Global Composer Conversation-Slot auch für Seller-Turn Direct/Compact (nicht nur `agentDirect`); Lead-Feed bei aktivem Kundenkontext.

**Residual Fixes (nach Polish, implementiert):**
- Agent-Memory speichert `lastAppointmentProposal` / normalisiertes `lastKnowledgeAnswer` (`updateAgentWorkingMemory`) – Follow-up „lieber Montag“ auf Agent-Pfad.
- `routeSellerRequest`: Follow-ups für Termin / Rewrite-Send / Offer-Änderungen explizit → Agent.
- Akte-Suche (`isComposerAkteSearchQuery`): mit Agent → Propose-Pfad; ohne Agent → Memory + Response Policy + Feed (kein reiner Toast-Bypass).

**Code-Status Clever 2.0:** Sprint 1–3 + Polish + Residual **exhausted**. Keine sinnvollen mittleren Code-Lücken mehr ohne Scope-Creep (UI-Freeze, Live-Smoke, Flag-Default-Policy sind Produkt/Ops).

**Noch offen / deferred (kein Code-Sprint):**
- Live-OpenAI Smoke mit Flags (manuell; siehe Ship Checklist)
- Akte-UI / Dashboard Freeze bleibt
- kein Big-Bang Redesign
- PDF/OCR/Magic-Compose bleiben bewusst Deterministik (nicht Agent) – Fallback-Produktentscheid

### Ship Checklist (manuelle Smoke + Flags)

**Flags (Dev, Restart nötig):**
```
CLEVER_AGENT_ENABLED=1
VITE_CLEVER_AGENT_ENABLED=1
OPENAI_API_KEY=…
# optional: CLEVER_AGENT_DEBUG=1, OPENAI_CLEVER_AGENT_MODEL=…
```

**Automatisierte Gate-Tests (vor Commit):**
```
node src/services/cleverSeller/conversationLoop.sprint1.test.js
node src/services/cleverAgent/toolCoverage.sprint2.test.js
node src/services/cleverAgent/chatNative.sprint3.test.js
node src/services/cleverAgent/cleverProgressHint.test.js
node src/services/cleverAgent/cleverAgent.golden.test.js
node src/services/cleverSeller/zeroLossIntake.golden.test.js
```

**Manuelle Smoke (Live-OpenAI):**
1. Akte: „Merk dir, zwei Kinder, Hund und Blau“ → Compact Confirmation + **Rückgängig** in Feed (Chat-Tab) bzw. Slot (Clever-Tab).
2. Undo klicken → Facts weg; kein Toast-Spam nötig.
3. „Was liegt heute an?“ → Direct Answer, **kein** „Clever arbeitet…“ bei schnellem Turn.
4. PDF/Screenshot anhängen (langsam) → Progress-Hint erst nach ~1s; schneller Local-Turn bleibt still.
5. Dashboard Global Composer: gleiche Compact/Direct-Antworten im Conversation-Slot; bei offener Akte auch Lead-Feed.
6. Dialog: Today → Brandes → AHK/Rot → kürzer → senden (Confirm only).
7. „Schlag Montag 15 Uhr vor“ → Review; danach „lieber Dienstag 10 Uhr“ → Follow-up ohne Modulwechsel.
8. „Was hatte ich … geschrieben?“ → Direct Answer im Feed (nicht nur Toast).

**Nächster User-Schritt:** Code-Arbeit Clever 2.0 ist done → **Commit** (User muss „commit“ sagen). Optional vorher Live-Smoke.

---

## Reihenfolge / Nicht tun

1. ~~Sprint-Planung~~ → erledigt.  
2. **Nicht:** Big Bang UI, Chips neu erfinden, zweite Business Engine, Push ohne Review.  
3. **UI Freeze:** Kundenakte / Kundenwissen / Dashboard Controls – nur Composer-Loop + Feed-Messages anfassen.

---

## Golden System Test (Abnahme über 3 Sprints)

| # | Input | Erwartung |
|---|--------|-----------|
| 1 | Merk dir, zwei Kinder, Hund und Blau | Compact Confirmation + Undo |
| 2 | Was hatte ich Brandes zur Lieferzeit geschrieben? | Direct + Search |
| 3 | EV4 vs EV6 Reichweite | Direct Knowledge |
| 4 | Garritano Picanto 17.000 | Prepared Offer Review |
| 5 | Das gleiche mit 15.000 km | Follow-up Memory |
| 6 | Schreib ihm, dass ich es angepasst habe | Message Draft |
| 7 | Schlag Montag 15 Uhr vor | Appointment Review |
| 8 | Smart fortwo kommt in Zahlung | Trade-in / Zero-Loss |
| 9 | Lies den alten Vertrag … wann endet er? | Contract + Direct/Review |
| 10 | Was muss ich heute noch erledigen? | Today Direct + Actions |

---

## Empfohlene nächste konkrete Schritte

1. Ship Checklist Tests grün + optional Live-Smoke.  
2. User: **commit** anfordern (kein Auto-Commit).  
3. Danach: Flag-Defaults / Rollout-Entscheidung (Produkt), nicht weiterer Composer-Umbau.
