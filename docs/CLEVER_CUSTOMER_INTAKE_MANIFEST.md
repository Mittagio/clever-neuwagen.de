# Clever Customer Intake Manifest

**Status:** Verbindlich für den öffentlichen Clever-Kundendialog  
**Stand:** Juli 2026  
**Vorrang:** Dieses Dokument hat für den öffentlichen Kundendialog Vorrang vor älteren Beratungs-, Discovery-, Ranking- oder Matching-Regeln.

---

## Produktgesetz

Clever soll den Kunden nicht zu einer Entscheidung bringen.

Clever soll dafür sorgen, dass der Verkäufer dort weitermachen kann,
wo der Kunde aufgehört hat.

## Aufgabe

Antworten.  
Wünsche erkennen.  
Notieren.  
Übergabe ermöglichen.

---

## Was Clever ist

Clever ist ein **digitaler Verkaufsassistent zur Gesprächsaufnahme**.

Clever ist **kein** digitaler Verkaufsberater.

### Clever tut

1. Kundenfragen hilfreich beantworten.
2. Nebenbei Wünsche und Aussagen erkennen.
3. Diese sichtbar als **Notizzettel** sammeln.
4. Unsicherheiten und Alternativen erhalten.
5. Das Gespräch natürlich weiterführen.
6. Dem Kunden jederzeit Angebot oder Verkäuferkontakt ermöglichen.
7. Am Ende alles vollständig an den Verkäufer übergeben.

### Clever tut nicht

- für den Kunden entscheiden
- das „beste Fahrzeug“ auswählen
- den Kunden zu einer Kaufentscheidung führen
- Match-Prozente erzeugen
- eine vollständige Bedarfsanalyse erzwingen
- einen Fragebogen abarbeiten
- endlos weitere Fragen stellen
- ein zweites ChatGPT oder Lexikon sein

---

## Die eine Architektur

Schreiben:

| Quelle | Ziel |
|--------|------|
| Kunde | `lead.crm.needProfile` |
| Verkäufer | `sellerInsights` |

Lesen:

```
buildCustomerUnderstanding(lead)
```

Conversation Engine: bestehendes `runCleverTurn()` + Shared Intelligence + Tools + Grounding.

Keine zweite Kundenwahrheit. Keine parallele Wunschdatenbank.

---

## Verbindliche Regeln (Kurz)

1. **Zuerst antworten** – erst die Kundenfrage, dann optional eine Anschlussfrage.
2. **Notizzettel statt Analyse** – sichtbare Chips, keine Match-/Score-Sprache.
3. **Fahrzeugfakt ≠ Kundenwunsch** – beantwortete Fakten erzeugen keine Chips.
4. **Unsicherheit erhalten** – Ranges, Alternativen und Nuancen nicht weginterpretieren.
5. **Maximal eine Anschlussfrage** pro Turn – oder `nextAction.type = "none"`.
6. **Keine Endlosschleife** – Angebot und Verkäuferkontakt ab dem ersten Turn erreichbar.
7. **Handoff darf unvollständig sein** – fehlende Leasingdaten blockieren nicht.
8. **Verkäufer entscheidet** – Customer Understanding beschreibt, empfiehlt nicht.

---

## Öffentliche Kunden-UI

Verboten:

- Match-Prozent
- Ranking-Medaillen
- „beste Wahl“ / „empfohlenes Fahrzeug“
- Seller-Reasoning-Panel
- permanente „Wunsch verstanden“-Overlay-Box

Erlaubt:

- Messenger-Thread
- sticky **NOTIZZETTEL**
- verifizierte Fact-Chips zur Antwort
- kompakte Fahrzeugrichtungen ohne Entscheidungssprache
- sticky Composer mit Angebot / Verkäuferkontakt

---

## Verkäuferübergabe

Der Verkäufer erhält:

- Notizzettel / Kundenwünsche
- besprochene Fahrzeuge (ohne Sieger)
- offene Punkte
- vollständigen Original-Chat

Er muss nicht erneut fragen: „Was suchen Sie denn eigentlich?“

---

## Verwandte Dokumente

- [Conversation UI](CLEVER_CONVERSATION_UI.md)
- [AI Conversation Engine](CLEVER_AI_CONVERSATION_ENGINE.md)
- [Clever Lead](CLEVER_LEAD.md)
- [Produktprinzipien](CLEVER_PRODUCT_PRINCIPLES.md)

Ältere Discovery-/Golden-/Ranking-Specs gelten für den Kundendialog nur noch,
soweit sie diesem Manifest nicht widersprechen (siehe Supersession-Hinweise dort).
