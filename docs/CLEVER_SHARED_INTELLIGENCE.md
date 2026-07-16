# Clever Shared Intelligence – Lexikon + Verkäufer-Dashboard v1.0

Leitsatz: **Eine Intelligenz. Drei Oberflächen. Eine Wahrheit.**

```
              CLEVER INTELLIGENCE CORE
  ------------------------------------------------
  Fahrzeugdaten · Herstellerquellen · Grounding
  Händlerkonditionen · Customer Understanding
  OpenAI Responses API · Tool Calling · Feedback
  ------------------------------------------------
           ↓                ↓                 ↓
      Kundenchat         Lexikon        Verkäuferbereich
```

## Architektur

Kein zweites KI-System. Shared Core + dünne Adapter:

| Schicht | Datei |
|---------|--------|
| Core | `src/services/clever/intelligence/runCleverIntelligenceCore.js` |
| Base Prompt | `cleverBaseInstructions.js` |
| Config/Flags | `cleverIntelligenceConfig.js` |
| Kundenchat | bestehendes `runCleverTurn()` |
| Lexikon | `runCleverLexiconQuery.js` |
| Verkäufer | `runCleverSellerCopilot.js` |

Alle Oberflächen nutzen dieselben Tools (`get_verified_vehicle_facts`, `search_official_manufacturer_knowledge`, …) und dieselbe Wissenshierarchie.

## Wissenshierarchie

1. Intern verifiziert  
2. Offizielle Herstellerquellen (`provisional_official_source`)  
3. Modellwissen nur für Sprache/Erklärung  

## Lexikon

- Standard **ohne** Lead-/Kundendaten  
- Keine automatische NeedProfile-Änderung  
- Quellenstatus: ✓ intern / ◷ Hersteller / ⚠ Prüfung  
- Aktion „Für Kundenakte übernehmen“ nur mit Speichermodus + Vorschau + Bestätigung  
- Cache: `lexiconQueryCache.js`  
- Flag: `CLEVER_LEXICON_AI_ENABLED=false` → bestehende Regelsuche bleibt

## Verkäufer-Copilot

- Liest `buildCustomerUnderstanding(lead)` (Wahrheit)  
- Safe Context ohne Dokumente/Kontodaten  
- Zusammenfassung ist Darstellung, keine parallele Wahrheit  
- Snapshot-Cache; stale bei geändertem Understanding  
- Entwürfe (WhatsApp/E-Mail) nur Vorschläge, `requiresSellerConfirmation=true`  
- Kein Auto-Senden  
- Flag: `CLEVER_SELLER_COPILOT_ENABLED=false` → bestehende Journey/NBS

## API

```
POST /api/v1/clever/lexicon-query
POST /api/v1/clever/seller-copilot
POST /api/v1/clever/lexicon-transfer
GET  /api/v1/clever/shared-intelligence/health
```

Bestehende Route `POST /api/v1/clever/lexikon-query` leitet bei aktiviertem Flag auf Shared Intelligence um.

## Feature-Flags

```env
CLEVER_LEXICON_AI_ENABLED=false
CLEVER_SELLER_COPILOT_ENABLED=false
VITE_CLEVER_LEXICON_AI_ENABLED=false
VITE_CLEVER_SELLER_COPILOT_ENABLED=false
```

## Lokale Aktivierung

1. `OPENAI_API_KEY` setzen  
2. Server-Flags und passende `VITE_*`-Flags in `.env.local`  
3. Keine Produktionsaktivierung ohne Freigabe  

## Tests

```bash
npm run test:clever-ai-conversation
```

Enthält Shared-Intelligence-Tests ohne Live-API.

## Feedback

Bestehendes Verkäuferfeedback / Clever Qualität – keine automatische Prompt- oder Datenänderung.
