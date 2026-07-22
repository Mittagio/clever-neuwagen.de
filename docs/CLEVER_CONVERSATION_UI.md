# Clever Conversation UI v1.2

> **Produktvorrang:** [CLEVER_CUSTOMER_INTAKE_MANIFEST.md](CLEVER_CUSTOMER_INTAKE_MANIFEST.md)

## Ziel

Ruhiges, modernes **Messenger-Gespräch** mit Verkäufer-**Notizzettel**.

Leitsatz: **Antworten. Wünsche erkennen. Notieren. Übergabe ermöglichen.**

## Messenger-Struktur

| Zone | Verhalten |
|------|-----------|
| Header | Dealer / App-Kopf |
| Notizzettel | Sticky unter dem Header, eine Zeile, horizontal scrollbar |
| Thread | Einziger vertikaler Scrollbereich |
| Composer | Sticky Footer + permanente Ausgänge Angebot / Verkäuferkontakt |

### Bubbles

- **Kunde rechts** – max. 72 % Desktop / 88 % Mobile, dezenter Hintergrund, Kennung „Sie“
- **Clever links** – max. ca. 760 px, ruhige Bubble, Kennung „Clever“
- Fakten, Fahrzeuganhänge und Anschlussfrage gehören **zu diesem Turn**

## Notizzettel

- Label: **Notizzettel** (nicht „Wunschprofil“, nicht „Analyse“)
- Sticky, kompakte Chips (~32–36 px), löschbar (×)
- overflow-x auto, kein Zeilenumbruch
- Neue Chips: kurze Magic-/Fly-in- + Glow-Animation (`prefers-reduced-motion` beachten)
- Optionaler Toast max. 1,5 s („Notiert: …“) – blockiert nichts
- Quelle: Customer Understanding / needProfile – keine zweite Wahrheit
- Fahrzeugfakt in der Antwort erzeugt **keinen** Wunsch-Chip

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
- eine primäre Aktion (z. B. „Angebot anfordern“)

`nextAction.type = "none"` ist erlaubt. Freies Eingabefeld bleibt immer sichtbar.
Keine Frage nur weil ein Profilfeld leer ist.

## Permanente Ausgänge (ab Turn 1)

Am sticky Composer immer erreichbar:

- **Angebot anfordern** (Copy darf mit dem Gespräch wachsen)
- **Verkäufer kontaktieren**

Der Kunde muss keine Bedarfsanalyse abschließen.

CTA-Evolution (nur wenn eindeutig aus dem Gespräch):

- „Angebot anfordern“
- „Angebot mit meinen Wünschen anfordern“
- „EV9-Angebot anfordern“
- „Angebote für 2 Fahrzeuge anfordern“

## Angebots-Handoff

Kein permanentes „Wunsch verstanden“-Overlay.

Unvollständige Profile sind erlaubt. Beispiel:

> Gerne. Ihre bisherigen Wünsche nehmen wir direkt mit.
> Sie können die Leasingdaten noch ergänzen oder der Verkäufer
> klärt den Rest mit Ihnen.

Aktionen: **Jetzt anfragen** · **Leasingdaten ergänzen**

Zusätzlich Inline-Karte im Thread wenn der Kunde Angebot/Kontakt wählt.

## Composer

- Placeholder-Standard: „Weiterfragen oder Wunsch ergänzen …“
- Kontext möglich: „Noch eine Frage zum EV9?“
- Keine Pflichtfragen im Placeholder
- Permanente Ausgänge Angebot / Kontakt
- safe-area-inset-bottom

## Öffentliche UI – verboten

- Match-Prozent, Ranking-Medaillen, „beste Wahl“
- Seller-Reasoning-Panel im Kundendialog
- parallele Legacy-Empfehlungsausgabe neben AI-Turns

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
