# Clever AI Conversation Engine v0.1

## Ziel

Clever ist **kein zweites ChatGPT**. Die Engine beantwortet konkrete Fahrzeugfragen,
erkennt nebenbei Kundenbedürfnisse und übergibt vollständig an den Verkäufer.

Leitsatz: **Gut antworten. Nebenbei verstehen. Vollständig übergeben.**

## Abgrenzung

| Clever | Nicht Clever |
|--------|----------------|
| Verifizierte Fahrzeugdaten via Tools | Freie Modellbehauptungen |
| `lead.crm.needProfile` als Schreibquelle | Paralleles KI-Profil |
| `buildCustomerUnderstanding(lead)` als Lesequelle | Separate AI-Summary als Wahrheit |
| Optional eine sinnvolle Rückfrage | Künstliche Gesprächsverlängerung |

## Datenfluss

```
Kundennachricht
  → buildCustomerUnderstanding(lead)
  → runCleverTurn() [OpenAI Responses API + Tools]
  → CleverTurnResult (Structured Output)
  → Schema + Grounding validieren
  → needProfilePatch über merge/apply
  → buildCustomerUnderstanding() neu
  → UI (CleverConversationTurn) + Session speichern
```

Bei Fehler/Deaktivierung: **bestehender deterministischer Flow**
(`conversationKnowledgeAnswer` + `consultationHappyPath`).

## Zentrale Dateien

| Datei | Rolle |
|-------|--------|
| `src/services/clever/openai/runCleverTurn.js` | Zentraler Service |
| `src/services/clever/openai/openAiResponsesClient.js` | Responses API + Tool-Loop |
| `src/services/clever/openai/cleverConversationInstructions.js` | Systemprompt v0.1 |
| `src/services/clever/openai/tools/*` | Verifizierte Tool-Handler |
| `src/services/clever/openai/applyCleverTurnResult.js` | Session-Anwendung |
| `server/cleverConversationRoutes.js` | POST `/api/v1/clever/conversation-turn` |

## Tool-Vertrag

1. **find_matching_vehicles** – harte Kriterien (Sitze, Antrieb, Karosserie, Anhängelast, WLTP, Budget)
2. **get_verified_vehicle_facts** – einzelne verifizierte Fakten pro Modell
3. **get_supported_offer_parameters** – erlaubte Leasing-/Angebotswerte
4. **get_dealer_offer_options** – reserviert; v0.1 liefert `available: false`

Tools sind **read-only** – keine Lead-Schreiboperationen.

## Structured Output: CleverTurnResult

Felder: `reply`, `intent`, `needProfilePatch`, `vehicleDirections`, `nextAction`, `handoff`, `usedFactIds`.

`nextAction.type = "none"` ist der Standard.

## Fragepolitik

Erlaubte `nextAction.reason`-Werte:

- `vehicle_disambiguation`
- `offer_parameter`
- `customer_uncertainty`
- `handoff_contact`

Keine Standardfragen (Hauptauto, Wallbox, Langstrecke) ohne konkreten Nutzen.

## Grounding

`assertGroundedCleverTurn()` prüft:

- `usedFactIds` existieren in Tool-Ergebnissen
- `verifiedFactIds` in Fahrzeugrichtungen
- bekannte `modelKey`s
- kein Widerspruch candidate/excluded
- nur erlaubte needProfile-Felder und Angebotsoptionen

Bei Fehlschlag: Ergebnis verwerfen → Fallback.

## Fallback

Auslöser: Feature aus, kein API-Key, Timeout, Rate Limit, Schema-/Grounding-Fehler, Tool-Fehler.

Der Kunde sieht keinen Absturz – der deterministische Flow übernimmt.

## Datenschutz

- `OPENAI_API_KEY` nur serverseitig
- Keine Ausweis-/Bank-/Dokumentdaten an OpenAI
- Logs redigiert (`buildCleverTurnContext.redactForLog`)
- Keine Live-Kundendaten in Unit Tests

## Feature-Flag & Umgebungsvariablen

```env
CLEVER_AI_CONVERSATION_ENABLED=false
OPENAI_API_KEY=
OPENAI_CLEVER_MODEL=gpt-4o-mini
CLEVER_AI_TIMEOUT_MS=25000
VITE_CLEVER_AI_CONVERSATION_ENABLED=false
```

## Lokale Aktivierung

1. `.env.local`: `CLEVER_AI_CONVERSATION_ENABLED=true`, `OPENAI_API_KEY=…`
2. Optional Frontend: `VITE_CLEVER_AI_CONVERSATION_ENABLED=true`
3. `npm run dev`
## Live-Eval (20 Golden Turns)

Fixture: `tests/fixtures/cleverGoldenConversationsEval.json` (T01–T20)

```bash
# Einzelmodell (Standard: OPENAI_CLEVER_MODEL aus .env.local)
npm run clever:eval

# Explizites Modell + Report-Datei
npm run clever:eval -- --model gpt-5.6-luna --out eval-reports/luna.json

# Modellvergleich (luna, mini, terra)
npm run clever:eval:compare
npm run clever:eval:compare -- --models gpt-5.6-luna,gpt-4o-mini
```

Ausgabe pro Turn: `mode`, `intent`, `nextAction`, `needProfilePatch`, `usedFactIds`, `durationMs`, `usage`.

Vergleichsreport: `eval-reports/comparison.md` und `comparison.json`.

**Nicht für CI** – erfordert `OPENAI_API_KEY` und `CLEVER_AI_CONVERSATION_ENABLED=true`.

## Tests

```bash
npm run test:clever-ai-conversation
```

Golden Conversations (Mock, CI): `tests/fixtures/cleverGoldenConversations.js`  
Live-Eval (20 Turns): `tests/fixtures/cleverGoldenConversationsEval.json`

## Version

Stand: **v0.1** – Prototyp mit Responses API, Tool Calling, Grounding und Fallback.
