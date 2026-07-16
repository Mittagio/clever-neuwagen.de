# Clever Conversation UI

## Ziel

Das Kundengespräch fühlt sich wie ein **Messenger mit Verkäufer-Notizzettel** an –
nicht wie ein Lexikon und nicht wie ein Formular-Interview.

Leitsatz: **Antworten. Verstehen. Notieren. Weiterführen.**

## Layout

| Zone | Inhalt |
|------|--------|
| Oben | Schmale Sticky-Leiste: Clevers **Notizzettel** (Chips) |
| Mitte | Messenger-Thread (Kundenbubble, Clever-Bubble, Fakten, Karten) |
| Unten | Texteingabe immer verfügbar; optionale Antwortchips |

### Notizzettel (Chips)

- Abgeleitet aus **Customer Understanding / needProfile** – keine zweite Kundenwahrheit.
- Nur verkaufsrelevante Infos (z. B. SUV, 7 Sitze, ca. 2 m Ladelänge, Elektro, Leasing).
- Ruhig ergänzen, sobald ein **echter Kundenwunsch** erkannt wurde.
- Keine technischen Keys, keine Debug-Ausgabe, keine Match-Prozente.

### Thread

- Kundenbubble und Clever-Bubble
- Fahrzeugfakten **innerhalb** der Clever-Bubble (lesbar formatiert)
- Fahrzeugkarten als Anhang
- Maximal **eine** Anschlussfrage pro Turn (als Folge-Bubble und/oder Option-Chips)
- Kein großes Status-Overlay („Wunsch verstanden“ etc.)

## Fakt vs. Wunsch in der UI

Ein beantworteter Fahrzeugfakt erzeugt **keinen** neuen Chip.

Erst die Kundenbestätigung (z. B. „Ich brauche ca. zwei Meter Ladelänge“)
führt zu sichtbaren Notizzetteln.

## Komponenten

| Datei | Rolle |
|-------|--------|
| `CleverConversationExperience.jsx` | Shell: Sticky-Notizzettel + Thread + Composer |
| `CleverMemoryBar.jsx` | Notizzettel-Chips |
| `CleverConversationTurn.jsx` | Bubbles, Fakten, Optionen |
| `clever-conversation.css` | Sticky-Leiste, Messenger-Optik |

## Abgrenzung

Lexikon und Verkäufer-Dashboard nutzen die **gleiche Intelligenz**,
aber andere Oberflächen (keine Verkaufs-Notizzettel-Leiste im Lexikon).
