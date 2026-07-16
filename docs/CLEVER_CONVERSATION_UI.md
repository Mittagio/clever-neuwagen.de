# Clever Conversation UI v1.1

## Ziel

Ruhiges, modernes **Messenger-Gespräch** mit Verkäufer-Notizzettel.

Leitsatz: **Eine Nachricht. Eine Antwort. Eine nächste Handlung.**

## Messenger-Struktur

| Zone | Verhalten |
|------|-----------|
| Header | Dealer / App-Kopf |
| Notizzettel | Sticky unter dem Header, eine Zeile, horizontal scrollbar |
| Thread | Einziger vertikaler Scrollbereich |
| Composer | Sticky Footer im Flex-Layout (kein fixed Overlay über Inhalt) |

### Bubbles

- **Kunde rechts** – max. 72 % Desktop / 88 % Mobile, dezenter Hintergrund, Kennung „Sie“
- **Clever links** – max. ca. 760 px, ruhige Bubble, Kennung „Clever“
- Fakten, Fahrzeuganhänge und Anschlussfrage gehören **zu diesem Turn**

## Notizzettel

- Sticky, kompakte Chips (~32–36 px)
- overflow-x auto, kein Zeilenumbruch
- Neue Chips: kurze Glow-Animation
- Optionaler Toast max. 1,5 s („Notiert: …“) – blockiert nichts
- Quelle: Customer Understanding / needProfile – keine zweite Wahrheit

## Antwortturn (Darstellungshoheit)

Im **AI-Modus** (`conversationMode === 'ai'` / `turn.aiTurn`):

Nur `CleverTurnResult`-Inhalte:

1. `reply`
2. human-readable `facts`
3. kompakte `vehicleDirections`-Anhänge
4. höchstens eine `nextAction` (Frage **oder** Aktion)

**Nicht gleichzeitig** Legacy-Planner, Reasoning-Panel oder Seller-Thought.

Fallback-Komponenten nur, wenn der Turn tatsächlich im Fallback-Pfad liegt
(keine AI-Turns in der Session / kein AI-Modus).

## Fact-Chips

Erlaubt: `💺 5 Sitze`, `🔋 350 km WLTP`, `🪝 1.000 kg Anhängelast`

Verboten im Kunden-UI: `modelKey`, `variantKey`, Fact-IDs, JSON, `wltpRange`, `EV2 seats`

## Fahrzeuganhänge

- Kompakte Karten (Bild + Name + 1–2 Fakten + eine CTA)
- Mobile: horizontal wischbar mit scroll-snap
- Keine Raten ohne verifizierte Kondition
- Maximal zwei Karten unmittelbar sichtbar

## Anschlussfrage / Aktion

Nach einer Clever-Antwort maximal **eine** Folge:

- Anschlussfrage mit optionalen Antwortchips, **oder**
- eine primäre Aktion (z. B. „EV2 ansehen“)

Freies Eingabefeld bleibt immer sichtbar.

## Angebots-Handoff

Kein permanentes „Wunsch verstanden“-Overlay.

Inline-Karte im Thread nur wenn:

- `offerRequested === true`, oder
- `nextAction.type === offer_handoff`, oder
- `sellerReady` / Handoff-Phase

## Composer

- Placeholder-Standard: „Weiterfragen oder Wunsch ergänzen …“
- Kontext möglich: „Noch eine Frage zum EV9?“
- Keine Pflichtfragen im Placeholder
- safe-area-inset-bottom

## Scrollverhalten

- Nur der Thread scrollt vertikal
- Shell: `height: 100dvh`, `overflow: hidden`
- Fahrzeugkarten dürfen horizontal scrollen
- Kein paralleler Browser- + Innen-Scroll

## Desktop / Mobile

- Shell ca. 860–960 px zentriert
- Nachrichteninhalt ca. 680–760 px
- Mobile: volle Breite, 12–16 px Seitenabstand, Touch ≥ 44 px

## Visuelle Hierarchie

1. Kundenfrage  
2. Clever-Antwort  
3. relevante Fakten  
4. optionale Fahrzeugkarte  
5. eine Anschlussfrage oder Aktion  
6. Notizzettel  

## Komponenten

| Datei | Rolle |
|-------|--------|
| `CleverConversationExperience.jsx` | Shell, AI/Fallback-Gate, Inline-Offer |
| `CleverMemoryBar.jsx` | Notizzettel |
| `CleverConversationTurn.jsx` | Bubbles, Fact-Chips, Anhänge |
| `CleverInlineOfferCard.jsx` | Inline Angebot |
| `conversationFactDisplay.js` | Human-readable Facts |
| `clever-conversation.css` | Layout / Messenger |

## Tests

- AI und Fallback rendern nicht gleichzeitig (Gate in Experience)
- Keine technischen Keys in Fact-Chips
- Kein dauerhaftes Wunsch-Overlay
- Handoff nur bei Angebotsstatus
- `npm run test:clever-ai-conversation` inkl. Fact-Display-Test
