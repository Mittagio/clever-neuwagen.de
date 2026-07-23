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
Weiterhelfen.  
Übergeben.

---

## Was Clever ist

Clever ist die **digitale Verkaufstheke** des Autohauses – ein Assistent zur Gesprächsaufnahme.

Clever ist **kein** digitaler Verkaufsberater.

### Clever tut

1. Kundenfragen hilfreich beantworten.
2. Nebenbei Wünsche und Aussagen erkennen.
3. Diese sichtbar als **Notizzettel** sammeln.
4. Unsicherheiten und Alternativen erhalten.
5. Mit Next Topics beim Weiterfragen helfen.
6. Dem Kunden jederzeit die **Wunschübergabe** ermöglichen.
7. Am Ende Wünsche und Gespräch vollständig an den Verkäufer übergeben.

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

## Wunschübergabe (intern) / „Meine Wünsche weitergeben“ (Kunden-UI)

**Definition:** Der Moment, in dem Clever die bisher gesammelten Kundenwünsche und den vollständigen Gesprächskontext an den echten Verkäufer übergibt.

Sie ist **keine** Kaufentscheidung, **keine** Bestellung und **kein** sofortiger Callcenterkontakt.

### Öffentlicher CTA

Primär:

**„Meine Wünsche weitergeben“**

Nicht als Standard:

- Verkäufer kontaktieren
- Verkäufer anrufen
- Kontakt aufnehmen
- Rückmeldung wünschen
- Angebot anfordern
- Übergabe (als Headline)

Intern dürfen technische Begriffe bleiben (`handoff`, `offer_handoff`, …).

### CTA-Reifung

Grundbegriff bleibt „Meine Wünsche weitergeben“. Nur bei klarem Kundenwunsch konkretisieren:

| Situation | CTA |
|-----------|-----|
| Noch kein Modell | Meine Wünsche weitergeben |
| EV9 klar interessant | Meine EV9-Wünsche weitergeben |
| Expliziter Angebotswunsch | Für Angebot weitergeben |
| Leasingdaten weitgehend da | Wünsche & Leasingdaten weitergeben |

### Erreichbarkeit

Ab dem **ersten echten Kundenturn**. Unvollständige Übergaben sind erlaubt.

### Nach dem Klick

**Soft Wish Enrichment** (optional) → E-Mail → Code → Erfolg.

#### Soft Wish Enrichment

Freiwilliger kurzer Moment unmittelbar vor der Identifikation.

Headline: „Möchten Sie dem Verkäufer noch etwas mitgeben?“  
Subline: „Damit er direkt weiß, worauf es Ihnen ankommt.“

- 4–6 dynamische Vorschläge (Gespräch / Modell / noch nicht notiert)
- AI darf Vorschläge machen – erst aktive Auswahl wird Kundenwunsch
- Freitext möglich („Etwas anderes?“)
- Buttons: **Weiter** / **So passt es** (keine Pflichtauswahl)
- Kein Akkordeon-Fragebogen (Verfügbarkeit / Bezahlung / Ausstattung)

Danach Identifikation:

Headline: „Meine Wünsche weitergeben“  
Pflicht: E-Mail + Datenschutz → Code senden → Code bestätigen

Erfolg: „Ihre Wünsche sind angekommen“ + kompakte Wunschchips + Rückkehr zur Händlerseite / „Noch etwas ergänzen“.

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
4. **AI-Richtung ≠ Wunsch** – `vehicleDirections` schreiben keinen Notizzettel.
5. **Unsicherheit erhalten** – Ranges, Alternativen und Nuancen nicht weginterpretieren.
6. **Maximal eine Anschlussfrage** pro Turn – oder `nextAction.type = "none"`.
7. **Next Topics statt Fragebogen** – 0–4 Navigations-Chips, keine Pflichtkette.
8. **Keine Endlosschleife** – Wunschübergabe ab dem ersten Turn erreichbar.
9. **Handoff darf unvollständig sein** – fehlende Leasingdaten blockieren nicht.
10. **Verkäufer entscheidet** – Customer Understanding beschreibt, empfiehlt nicht.

---

## Drei Chip-Ebenen

| Ebene | Ort | Persistenz |
|-------|-----|------------|
| **Notizzettel** | Sticky oben | needProfile / Understanding |
| **Next Topics** | Unter Clever-Turn | Nur UI-Navigation |
| **Wunschübergabe** | Composer-CTA | Startet Handoff-Flow |

### Smart Notizzettel

Darstellungslogik über dem bestehenden Notizzettel:

- Wenige **Kernwünsche** bleiben direkt sichtbar.
- Details landen in kompakten Gruppen (**Konditionen**, **Wünsche**).
- Magic Capture: kurz bestätigen → einsortieren → Count/Glow.
- Keine neue Datenstruktur / keine zweite Kundenwahrheit.
- Customer-only: nur Gesagtes, Gewähltes, Bestätigtes, Korrigiertes.
- „Interessant“ auf Fahrzeugkarte → Modellinteresse; „Mehr erfahren“ → nur Navigation.

Siehe [CLEVER_CONVERSATION_UI.md](CLEVER_CONVERSATION_UI.md#smart-notizzettel).

---

## Öffentliche Kunden-UI

Verboten:

- Match-Prozent
- Ranking-Medaillen
- „beste Wahl“ / „empfohlenes Fahrzeug“
- Seller-Reasoning-Panel
- permanente „Wunsch verstanden“-Overlay-Box
- Standard-CTA „Verkäufer kontaktieren“

Erlaubt:

- Messenger-Thread
- sticky **NOTIZZETTEL**
- verifizierte Fact-Chips zur Antwort
- kompakte Fahrzeugrichtungen ohne Entscheidungssprache
- Next-Topic-Chips
- sticky Composer mit **Meine Wünsche weitergeben**

---

## Verkäuferansicht

Bereich: **Wunschübergabe von Clever**

- **Notizzettel** oben in der Akte (Wunsch-Chips), nicht Kategorie-Kacheln
- Kein „Unterlagen“-Chip im Notizzettel (Ordner in der Action-Bar)
- **+ Info hinzufügen** im Notizzettel-Body (kein kleines „+ Info“ rechts im Header)
- **Konditionen** darunter: harte Fakten inkl. Zahlungsart (Leasing/Kauf · Laufzeit · km · Anzahlung · Verfügbarkeit)
- Zahlungsart **nur** unter Konditionen – nicht im Soft-Wish-Hub / Notizzettel (keine Doppelung)
- Soft-Wish-Hub: Ausstattung · Verfügbarkeit · Leben & Alltag · Freitext
- Am Notizzettel: 🎤 Memo · 📷 Scan → Chip-Vorschau mit VK-Kürzel
- Sheets teilen dieselbe Akte-Optik (Indigo-Übernehmen)
- Leben & Alltag bündelt Familie / Auto / Geld / …
- Clever sagt: kompakt (Headline + Primary); Details aufklappbar
- besprochene Fahrzeuge (ohne Sieger)
- offene Punkte
- vollständigen Original-Chat („Gespräch ansehen“)

**Chip-Herkunft:** Kundenwünsche ohne Badge. Vom Verkäufer ergänzte Chips
tragen das **Kürzel** (z. B. MQ, CG) – Fallback „VK“, wenn kein Name bekannt ist.
`needProfile` bleibt kundenrein; VK-Zusätze liegen in `sellerInsights`.

Er muss nicht erneut fragen: „Was suchen Sie denn eigentlich?“

---

## Verwandte Dokumente

- [Dealer Plugin](CLEVER_DEALER_PLUGIN.md) – eingebettete Händlerseiten-Erfahrung (Page Context, Resume, Escape, Branding; **ohne** Bestandsintegration)
- [Conversation UI](CLEVER_CONVERSATION_UI.md)
- [AI Conversation Engine](CLEVER_AI_CONVERSATION_ENGINE.md)
- [Clever Lead](CLEVER_LEAD.md)
- [Produktprinzipien](CLEVER_PRODUCT_PRINCIPLES.md)

Ältere Discovery-/Golden-/Ranking-Specs gelten für den Kundendialog nur noch,
soweit sie diesem Manifest nicht widersprechen (siehe Supersession-Hinweise dort).

Dealer-Plugin-Verhalten ist in [CLEVER_DEALER_PLUGIN.md](CLEVER_DEALER_PLUGIN.md) spezifiziert.