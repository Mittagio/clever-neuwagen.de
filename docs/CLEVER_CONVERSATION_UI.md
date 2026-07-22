# Clever Conversation UI v1.3

> **Produktvorrang:** [CLEVER_CUSTOMER_INTAKE_MANIFEST.md](CLEVER_CUSTOMER_INTAKE_MANIFEST.md)

## Ziel

Ruhiges, modernes **Messenger-Gespräch** mit Verkäufer-**Notizzettel**.

Leitsatz: **Antworten. Wünsche erkennen. Notieren. Weiterhelfen. Übergeben.**

## Messenger-Struktur

| Zone | Verhalten |
|------|-----------|
| Header | Dealer / App-Kopf |
| Notizzettel | Sticky unter dem Header, eine Zeile, horizontal scrollbar |
| Thread | Einziger vertikaler Scrollbereich |
| Clever-Turn | Antwort · Facts · Karte · Next Topics |
| Composer | Sticky Footer + **Meine Wünsche weitergeben** |

### Bubbles

- **Kunde rechts** – max. 72 % Desktop / 88 % Mobile, dezenter Hintergrund, Kennung „Sie“
- **Clever links** – max. ca. 760 px, ruhige Bubble, Kennung „Clever“
- Fakten, Fahrzeuganhänge, Next Topics und Anschlussfrage gehören **zu diesem Turn**

## Notizzettel

- Label: **Notizzettel** (nicht „Wunschprofil“, nicht „Analyse“)
- Sticky, kompakte Chips (~32–36 px), löschbar (×)
- overflow-x auto, kein Zeilenumbruch
- Neue Chips: kurze Magic-/Fly-in- + Glow-Animation (`prefers-reduced-motion` beachten)
- Optionaler Toast max. 1,5 s („Notiert: …“) – blockiert nichts
- Quelle: Customer Understanding / needProfile – keine zweite Wahrheit
- Fahrzeugfakt in der Antwort erzeugt **keinen** Wunsch-Chip
- AI-`vehicleDirections` erzeugen **keinen** Wunsch-Chip
- Kundenbestätigung eines Modells → z. B. „EV9 interessant“

## Antwortturn (Darstellungshoheit)

Im **AI-Modus** (`conversationMode === 'ai'` / `turn.aiTurn`):

Nur `CleverTurnResult`-Inhalte:

1. `reply`
2. human-readable `facts`
3. kompakte `vehicleDirections`-Anhänge
4. 0–4 `nextTopics` (Navigation)
5. höchstens eine `nextAction` (Frage **oder** Aktion)

**Nicht gleichzeitig** Legacy-Planner, Reasoning-Panel oder Seller-Thought.

Fallback-Komponenten nur, wenn der Turn tatsächlich im Fallback-Pfad liegt
(keine AI-Turns in der Session / kein AI-Modus).

## Next Topics

Unter dem aktiven Clever-Turn:

> Was möchten Sie noch wissen?

Chips wie Reichweite · Anhängelast · Platz & Kofferraum · Ausstattung

- Reine Navigation – **nicht** in needProfile
- Klick → natürliche Kundennachricht → normaler `runCleverTurn()`-Flow
- Max. 4 · ältere Turns optisch zurückgetreten

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
- Next Topics, **oder**
- klare Aktion

`nextAction.type = "none"` ist erlaubt. Freies Eingabefeld bleibt immer sichtbar.
Keine Frage nur weil ein Profilfeld leer ist.

## Meine Wünsche weitergeben (ab Turn 1)

Am sticky Composer immer erreichbar:

**Meine Wünsche weitergeben**

CTA-Evolution nur bei klarem Kundenwunsch:

- „Meine Wünsche weitergeben“
- „Meine EV9-Wünsche weitergeben“
- „Für Angebot weitergeben“
- „Wünsche und Leasingdaten weitergeben“

Nicht als Standard: „Verkäufer kontaktieren“, „Angebot anfordern“, Headline „Übergabe“.

## Soft Wish Enrichment + Identifikation

**SOFT WISH ENRICHMENT:** Freiwilliger kurzer Moment unmittelbar vor der Identifikation,
bei dem Clever dem Kunden noch wenige relevante, bisher nicht genannte Wünsche anbietet.
Erst eine aktive Auswahl wird Teil des Kunden-Notizzettels.

Kein permanentes „Wunsch verstanden“-Overlay.

Nach Klick Inline:

1. Soft Wish Enrichment – „Möchten Sie dem Verkäufer noch etwas mitgeben?“
2. 4–6 Chips + optional Freitext · **Weiter** / **So passt es**
3. „Meine Wünsche weitergeben“ – E-Mail + Datenschutz → Code senden
4. Code → Handoff
5. Erfolg: „Ihre Wünsche sind angekommen“ + Wunschchips + Rückkehr

Unvollständige Profile sind erlaubt.

## Composer

- Placeholder-Standard: „Weiterfragen oder Wunsch ergänzen …“
- Kontext: „Weitere Frage oder Wunsch zum EV9 …“
- Keine Pflichtfragen im Placeholder
- Permanenter CTA „Meine Wünsche weitergeben“
- safe-area-inset-bottom

## Öffentliche UI – verboten

- Match-Prozent, Ranking-Medaillen, „beste Wahl“
- Seller-Reasoning-Panel im Kundendialog
- parallele Legacy-Empfehlungsausgabe neben AI-Turns
- Headline „Übergabe“

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

1. Notizzettel (sticky)
2. Kundenfrage
3. Clever-Antwort
4. relevante Fakten
5. optionale Fahrzeugkarte
6. Next Topics
7. CTA „Meine Wünsche weitergeben“
8. Composer

## Komponenten

| Datei | Rolle |
|-------|--------|
| `CleverConversationExperience.jsx` | Shell, AI/Fallback-Gate |
| `CleverMemoryBar.jsx` | Notizzettel |
| `CleverConversationTurn.jsx` | Bubbles, Fact-Chips, Next Topics, Anhänge |
| `CleverComposerExits.jsx` | CTA „Meine Wünsche weitergeben“ |
| `CleverPersonalHandoff.jsx` | Soft Wish Enrichment → E-Mail → Code |
| `CleverHandoffComplete.jsx` | Erfolg mit Wunschchips |
| `softWishEnrichmentSuggestions.js` | Soft-Opt-in-Vorschläge |
| `customerIntakeExits.js` | CTA-Copy |
| `clever-conversation.css` | Layout / Messenger |

## Tests

- Soft Opt-in vor E-Mail, optional, ohne Auto-Speichern von Vorschlägen
- Keine Headline „Übergabe“
- AI und Fallback rendern nicht gleichzeitig
- `npm run test:clever-ai-conversation`
- `npm run test:consultation` inkl. Soft-Wish-Tests
