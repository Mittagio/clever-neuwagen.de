# Clever AI Conversation Engine

> **Produktvorrang:** Für den öffentlichen Kundendialog gilt  
> **[CLEVER_CUSTOMER_INTAKE_MANIFEST.md](CLEVER_CUSTOMER_INTAKE_MANIFEST.md)**.  
> Clever berät nicht und rankt nicht – Clever nimmt das Gespräch auf.

## Ziel

Clever ist der **digitale Verkaufsassistent zur Gesprächsaufnahme** – kein Verkaufsberater, kein zweites ChatGPT und kein reines Lexikon.

Leitsatz: **Antworten. Wünsche erkennen. Notieren. Weiterhelfen. Übergeben.**

## Abgrenzung

| Clever | Nicht Clever |
|--------|----------------|
| Verifizierte Fahrzeugdaten via Tools | Freie Modellbehauptungen |
| `lead.crm.needProfile` als Schreibquelle | Paralleles KI-Profil |
| `buildCustomerUnderstanding(lead)` als Lesequelle | Separate AI-Summary als Wahrheit |
| Höchstens eine themenbezogene Anschlussfrage (oder `none`) | Generische Interview-Fragen / Endlosschleife |
| Echte Kundenwünsche als Notizzettel | Fahrzeugfakten als Wunsch speichern |

## Datenfluss

```
Kundennachricht
  → buildCustomerUnderstanding(lead)
  → runCleverTurn() [OpenAI Responses API + Tools]
  → CleverTurnResult (Structured Output)
  → Schema + Grounding validieren
  → needProfilePatch über merge/apply (nur echte Wünsche)
  → buildCustomerUnderstanding() neu → Notizzettel-Chips
  → UI (CleverConversationTurn) + Session speichern
```

Bei Fehler/Deaktivierung: **bestehender deterministischer Flow**
(`conversationKnowledgeAnswer` + `consultationHappyPath`).

## Antwort-und-Frage-Regel (pro Turn)

1. Kundenfrage direkt beantworten
2. Bedürfnis hinter der Frage erkennen
3. Bestehendes needProfile aktualisieren (nur bestätigte Wünsche)
4. Chips aus Customer Understanding aktualisieren
5. Genau eine passende Anschlussfrage, wenn sie zum Ziel führt
6. Sonst `nextAction.type = "none"`

### Sinnvolle Rückfrage

- Bedarf hinter dem Anliegen klären (`need_clarification`)
- Harte Anforderung präzisieren
- Fahrzeuge/Varianten unterscheiden (`vehicle_disambiguation`)
- Angebot vorbereiten (`offer_parameter`)
- Handoff ermöglichen (`handoff_contact`)

### Verboten (ohne Themenbezug)

- Hauptauto / Zweitwagen
- „Wie nutzen Sie das Fahrzeug überwiegend?“
- „Was ist Ihnen am wichtigsten?“
- Wallbox / Langstrecke als Standardfrage

## Fakt und Kundenwunsch trennen

Fahrzeugfakt in der Antwort ≠ Kundenwunsch im needProfile.

Beispiel EV9-Laderaum: Zuerst nur Fakt beantworten und Sitz-/Ladebedarf fragen.
Erst nach Kundenbestätigung („ca. zwei Meter Ladelänge“) Chip und Profil aktualisieren.

## Gesprächszielstufen (optional, kein Funnel-Zwang)

1. Anliegen beantworten  
2. Geäußerte Wünsche notieren  
3. Bei Bedarf eine themenbezogene Anschlussfrage  
4. Fahrzeugrichtungen zeigen (ohne Entscheidungssprache)  
5. Wunschübergabe – jederzeit, auch unvollständig  

Stufen sind Orientierung, kein Pflichtfragebogen.  
`nextAction.type = "none"` ist ausdrücklich erlaubt.  
Fehlende Angebotsparameter blockieren die Wunschübergabe nicht.

Öffentlicher CTA: **Meine Wünsche übergeben** (nicht „Verkäufer kontaktieren“).

## Next Topics

`nextTopics: [{ id, label, customerMessage }]` – max. 4.

Reine UI-Navigation. Werden **nicht** in needProfile geschrieben.
Klick erzeugt eine natürliche Kundennachricht für den normalen Turn-Flow.

## Zentrale Dateien

| Datei | Rolle |
|-------|--------|
| `src/services/clever/openai/runCleverTurn.js` | Zentraler Service |
| `src/services/clever/openai/openAiResponsesClient.js` | Responses API + Tool-Loop |
| `src/services/clever/openai/cleverConversationInstructions.js` | Systemprompt (Intake) |
| `src/services/clever/intelligence/cleverBaseInstructions.js` | Shared Base + Surface |
| `src/services/clever/openai/tools/*` | Verifizierte Tool-Handler |
| `src/services/clever/openai/applyCleverTurnResult.js` | Session-Anwendung |
| `server/cleverConversationRoutes.js` | POST `/api/v1/clever/conversation-turn` |
| `docs/CLEVER_CUSTOMER_INTAKE_MANIFEST.md` | **Produktgesetz Kundendialog** |
| `docs/CLEVER_CONVERSATION_UI.md` | Messenger + Notizzettel |

## Tool-Vertrag

1. **find_matching_vehicles** – harte Kriterien  
2. **get_verified_vehicle_facts** – verifizierte Fakten  
3. **get_supported_offer_parameters** – erlaubte Angebotswerte  
4. **get_dealer_offer_options** – reserviert; kann `available: false` liefern  
5. **search_official_manufacturer_knowledge** – nur wenn intern fehlt (provisional)

Tools sind **read-only** – keine Lead-Schreiboperationen.

## Structured Output: CleverTurnResult

Felder: `reply`, `intent`, `needProfilePatch`, `vehicleDirections`, `nextAction`, `nextTopics`, `handoff`, `usedFactIds`, `evidence`.

`nextTopics` sind keine Wünsche. `vehicleDirections` sind keine Wünsche.
Nur bestätigte Kundenaussagen dürfen in den Notizzettel.

## Grounding

`assertGroundedCleverTurn()` prüft Evidence-IDs, modelKeys, erlaubte needProfile-Felder.
Bei Fehlschlag: Ergebnis verwerfen → Fallback.

## Feature-Flag & Umgebungsvariablen

```env
CLEVER_AI_CONVERSATION_ENABLED=false
OPENAI_API_KEY=
OPENAI_CLEVER_MODEL=gpt-4o-mini
CLEVER_AI_TIMEOUT_MS=25000
VITE_CLEVER_AI_CONVERSATION_ENABLED=false
```

Produktion: Flags standardmäßig **aus**.

## Live-Eval / Golden Conversations

Fixture: `tests/fixtures/cleverGoldenConversations.js`  
Live-Eval: `tests/fixtures/cleverGoldenConversationsEval.json`

Neue Zielgerichtete Fälle u. a.:

- Fahrzeugfakt ohne Wunsch-Chip  
- Bestätigte Ladelänge → sichtbarer Chip  
- Anschlussfrage zu Sitzkonfiguration / Laderaum  
- Keine generischen Haupt-/Zweitwagen-Fragen  
- Fortschritt Richtung Vergleich / Angebot / Handoff  

```bash
npm run test:clever-ai-conversation
npm run clever:eval
```

## Version

Stand: **v0.3** – zielgerichtete Verkaufsberatung mit Notizzettel-Chips (Shared Intelligence unverändert).
