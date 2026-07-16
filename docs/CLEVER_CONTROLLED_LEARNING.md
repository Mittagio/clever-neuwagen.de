# Clever Controlled Learning & Official Knowledge Loop v1.0

Leitsatz: **Gut antworten. Nebenbei verstehen. Vollständig übergeben.**

Clever ist kein zweites ChatGPT. OpenAI bleibt Sprach- und Denkzentrum; Clever bleibt Kundengedächtnis, Verkaufsprozess, Fahrzeugdaten, Händlerübergabe und Qualitätskontrolle.

## Warum Clever nicht automatisch aus Chats lernt

- OpenAI lernt **nicht** automatisch aus Kundengesprächen.
- Es gibt **keine** Logik, die Chats als Wahrheit übernimmt, Fahrzeugdaten ungeprüft speichert, den Systemprompt selbst ändert oder Fine-Tuning startet.
- Verbesserung läuft über einen **kontrollierten Kreislauf**:

```
Kundengespräch → Verkäuferfeedback → Qualitätsfall → menschliche Prüfung
→ Golden Conversation / Datenkorrektur → Tests → Freigabe → nächste Clever-Version
```

## Dreistufige Wissensarchitektur

| Stufe | Quelle | Status | Verhalten |
|-------|--------|--------|-----------|
| 1 | Intern verifizierte Clever-Daten | `verified` | Höchste Wahrheit, keine Websuche |
| 2 | Offizielle Herstellerdomains | `provisional_official_source` | Nur bei fehlenden internen Daten |
| 3 | Allgemeines Modellwissen | – | Nur Sprache/Intent, **keine** technischen Zahlen allein |

### Stufe 1 – Intern

Tool: `get_verified_vehicle_facts`

### Stufe 2 – Offizielle Herstellerquellen

Tool: `search_official_manufacturer_knowledge`  
Service: `src/services/clever/knowledge/searchOfficialManufacturerKnowledge.js`  
Domain-Allowlist: `src/config/officialManufacturerDomains.js`

Kundenformulierung bei Stufe 2:

- „Laut den aktuell verfügbaren Herstellerinformationen …“
- Bei Varianten: Verkäufer prüft verbindlich im Angebot.

### Stufe 3 – Modellwissen

Erlaubt für Begriffe, Intent, Formulierung.  
Bei fehlenden Stufe-1/2-Daten: transparente Verkäuferprüfung, nicht raten.

## Evidence & Grounding

`CleverTurnResult` enthält `evidence[]` und `usedFactIds`.

- Intern: `sourceTier: internal_verified`, `status: verified`
- Web: `sourceTier: official_web`, `status: provisional_official_source`

Grounding (`assertGroundedCleverTurn`) prüft:

- Evidence-IDs existieren
- Domains auf Allowlist
- Keine technische Zahl ohne Evidence
- Keine unbemerkten Datenkonflikte

## Wissenslücken-Inbox

Persistenz: `data/knowledge-gaps.json` (via `server/knowledgeGapStore.js`)

Admin: **Datenprüfung → Clever Qualität → Neue Wissenslücken**

Aktionen: Übernehmen, Ablehnen, Bereits vorhanden – **keine** direkte Registry-Manipulation.

## Verkäuferfeedback

UI: `CleverTurnFeedback` im Verkäufer-Gespräch (`CustomerAkteCleverGespraech`)  
API: `POST /api/v1/clever/seller-feedback`

Kategorien: Passt, Falsche Fahrzeuginfo, Unnötige Rückfrage, Kundenwunsch übersehen, Klingt nicht wie Verkäufer.

Feedback ändert **nicht** automatisch Prompt oder Fahrzeugdaten.

## Golden Conversations

Akzeptiertes Gesprächsfeedback → Golden-Conversation-Kandidat  
Admin: „Als Golden Conversation übernehmen“ → Fixture-Erweiterung / Review-Datei

Akzeptiertes Datenfeedback → Knowledge-Gap-/Datenkorrektur-Aufgabe

## Modell-Routing

| Rolle | Env | Standard |
|-------|-----|----------|
| Primary (Luna) | `OPENAI_CLEVER_MODEL` | `gpt-5.6-luna` |
| Eskalation (Terra) | `OPENAI_CLEVER_ESCALATION_MODEL` | `gpt-5.6-terra` |

Eskalation nur bei komplexen Fällen, max. **einmal pro Turn**.  
Flag: `CLEVER_AI_ESCALATION_ENABLED=false` (Standard aus).

## Feature-Flags (Standard: aus / staging)

```env
CLEVER_AI_CONVERSATION_ENABLED=false
CLEVER_OFFICIAL_WEB_SEARCH_ENABLED=false
CLEVER_OFFICIAL_WEB_CACHE_TTL_MS=
CLEVER_AI_ESCALATION_ENABLED=false
OPENAI_CLEVER_MODEL=gpt-5.6-luna
OPENAI_CLEVER_ESCALATION_MODEL=gpt-5.6-terra
```

## Datenschutz

Websuche erhält nur: Marke, Modell, Variante, Markt, Fakt.  
Keine Namen, Kontaktdaten, Adressen oder vollständigen Chatverläufe.

Redaction: `src/services/clever/knowledge/redactVehicleQuery.js`

## Kostenkontrolle

1. Interne Daten zuerst  
2. Websuche nur bei echter Lücke  
3. Cache für Herstellerquellen (`officialWebSearchCache.js`)  
4. Registry-Update invalidiert Cache (TTL-konfigurierbar)

## Tests

```bash
npm run test:clever-ai-conversation
```

Enthält Controlled-Learning-Tests ohne Live-OpenAI-API.

## Lokale Aktivierung

1. `.env.local` mit `OPENAI_API_KEY`
2. Optional: `CLEVER_AI_CONVERSATION_ENABLED=true`
3. Optional Staging: `CLEVER_OFFICIAL_WEB_SEARCH_ENABLED=true`
4. **Keine** Produktionsaktivierung ohne Freigabe

## Admin-Leitstand

**Datenprüfung → Clever Qualität**

- Neues Verkäuferfeedback
- Offene Wissenslücken
- Fallback / Webquelle / Konflikt / Eskalation (Metriken)
- Golden-Conversation-Kandidaten
