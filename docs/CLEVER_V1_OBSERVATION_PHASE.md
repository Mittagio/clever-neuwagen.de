# Clever v1.0 — UX Freeze & Beobachtungsphase

**Status:** Verbindlich ab Post-UX-Freeze (Architektur)  
**Stand:** Juli 2026  
**Bezug:** [Customer Intake Manifest](CLEVER_CUSTOMER_INTAKE_MANIFEST.md) · [Produktprinzipien](CLEVER_PRODUCT_PRINCIPLES.md) · [Conversation Design](clever-conversation-design.md) · [Clever Lead](CLEVER_LEAD.md)

> **Hinweis Kundendialog:** Ranking-, Match-%- und „Seller Reasoning“-Messlatten weiter unten  
> gelten **nicht** für die öffentliche Kunden-UI. Dort gilt das Intake-Manifest.  
> Interne Seller-Werkzeuge dürfen Scores weiterhin nutzen.

---

## Clever v1.0 ist eingefroren

Die Architektur ist abgeschlossen.  
Die Datenmodelle sind abgeschlossen.  
Die Schreibpfade sind abgeschlossen.  
Customer Understanding v1.0 ist abgeschlossen.

Ab jetzt beginnt **keine Entwicklungsphase** mehr, sondern eine **Beobachtungsphase**.

Es werden keine neuen Konzepte eingeführt.  
Es werden keine neuen Systeme eingeführt.

Es werden nur noch reale Nutzungsmuster beobachtet und kleine Verbesserungen vorgenommen.

---

## Die eine Architektur

### Schreiben

| Quelle | Ziel |
|--------|------|
| Kunde | `needProfile` |
| Verkäufer | `sellerInsights` |

### Lesen

```
buildCustomerUnderstanding(lead)
```

**Es gibt keine weiteren Wahrheiten.**

---

## Beobachtungsphase

Bitte **nicht**:

- neue Features entwickeln
- neue Dialoge entwickeln
- neue Builder entwickeln
- neue Speicherorte entwickeln

Stattdessen:

- beobachten
- messen
- lernen
- verfeinern

---

## Worauf wir achten

### Kundenseite

- Wo scrollen Kunden?
- Wo verlassen Kunden den Prozess?
- Welche Chips werden häufig genutzt?
- Welche Chips werden nie genutzt?
- Wann klicken Kunden sofort auf Verkäuferkontakt?
- Wann öffnen Kunden den Optional-Bereich?
- Welche Freitexte werden häufig ergänzt?

### Verkäuferseite

- Welche Informationen werden regelmäßig diktiert?
- Welche Informationen fehlen häufig?
- Welche Gesprächseinstiege funktionieren gut?
- Welche Verkäufer nutzen Sprache regelmäßig?
- Welche `sellerInsights` entstehen immer wieder?

---

## Erlaubte Änderungen

- Parser verbessern
- Neue Erkennungsmuster ergänzen
- Fahrzeugdaten ergänzen
- Texte verbessern
- Weißraum verbessern
- Reihenfolgen optimieren
- Chip-Auswahl anpassen
- Performance verbessern
- Mobile UX verbessern

Alles **innerhalb** der bestehenden Pipeline:

```
Kunde (Chips/Freitext) → mergeTextIntoNeedProfile() → needProfile → buildCustomerUnderstanding()
```

---

## Nicht erlaubt

- neue Datenmodelle
- neue Builder
- neue Schreibpfade
- neue Wahrheiten
- neue Kundenbilder
- neue CRM-Systeme
- neue Architekturideen

---

## Grundsatz bei Problemen

Nicht fragen:

> „Welches neue System brauchen wir?“

Sondern:

> „Kann das innerhalb von `needProfile`, `sellerInsights` und Customer Understanding gelöst werden?“

| Antwort | Vorgehen |
|---------|----------|
| **Ja** | Innerhalb der bestehenden Architektur lösen |
| **Nein** | Problem dokumentieren und sammeln — **nicht** sofort Architektur verändern |

---

## Messlatte

**Kunde:**

> „Die haben mich verstanden.“

**Verkäufer:**

> „Perfekt. Ich kenne diesen Kunden schon.“

Wenn beide Sätze weiterhin wahr sind, bleibt Clever auf Kurs.

---

## Dokumentation neuer Beobachtungen

Probleme und Muster werden gesammelt — z. B. in Sprint-Notizen oder Tickets — **ohne** sofortige Architekturentscheidung.

Verwandte Dokumente:

- [Nutzer-Tests & Verstanden-Gefühl](clever-user-testing.md)
- [Heilige zwei Minuten](clever-sacred-first-two-minutes.md)
- [Clever Lead – Dokument des Verständnisses](CLEVER_LEAD.md)

---

## Seller Reasoning Engine v1.0 — Erweiterung Beobachtungsphase

**Stand:** Juli 2026  
**Implementierung (read-only):** `src/services/clever/sellerReasoningEngine.js`  
**Bezug:** [Golden Conversations v1.0](CLEVER_GOLDEN_CONVERSATIONS.md) · [Need Discovery Engine v1.0](CLEVER_NEED_DISCOVERY_ENGINE.md) · [Conversation Design](clever-conversation-design.md) · [Produktprinzipien](CLEVER_PRODUCT_PRINCIPLES.md)

### Status

Clever ist **nicht mehr** eine Question Engine.

Clever ist eine **Seller Reasoning Engine**.

| Früher | Jetzt |
|--------|-------|
| „Welche Frage kommt als nächstes?“ | „Welche Information würde meine Empfehlung am stärksten verbessern?“ |

Die Architektur bleibt abgeschlossen. `sellerReasoningEngine.js` arbeitet **ausschließlich read-only** auf Basis von `needProfile`, `sellerInsights` und `buildCustomerUnderstanding()`.

---

### Produktregel (verbindlich)

Jede Kundenantwort muss **zwei sichtbare Ergebnisse** erzeugen:

1. **Das Kundenverständnis verbessert sich** (Chips, Spiegelung).
2. **Die Fahrzeugempfehlung verändert sich sichtbar** (Ranking, Match-%, faded cards).

| Nur Punkt 1 | Punkt 1 + Punkt 2 |
|-------------|-------------------|
| Fühlt sich wie ein **Formular** an | Fühlt sich wie **Beratung** an |

---

### Referenzbeispiel (Hybrid + Anhängelast)

**Kunde:** „Hybrid mit 1.500 kg Anhängelast.“

**Falsch:**

> „Haben Sie eine Garage oder Wallbox?“

**Richtig:**

> „Spontan würde ich an den Sportage Hybrid denken.“

- ✓ Sportage HEV steigt
- ✓ EV3 fällt raus (faded)
- ✓ Sorento wird sichtbar

**Erst danach:**

> „Was möchten Sie hauptsächlich ziehen?“

○ Wohnwagen · ○ Pferdeanhänger · ○ Alltag · ○ Noch offen

---

### Seller Reasoning Loop (Beobachtungsrahmen)

Nach **jeder** Kundenantwort berechnet Clever (read-only):

1. Was wissen wir bereits?
2. Welche Fahrzeuge passen aktuell am besten?
3. Welche Information würde die Empfehlung am stärksten verändern?
4. Welche Verkäuferfrage ergibt sich daraus logisch?

In der Beobachtungsphase prüfen wir, ob der Kunde **Schritt 2** sieht, bevor **Schritt 4** kommt.

---

### Beobachtungspunkte

#### 1. Fragt Clever zu früh nach Technik?

HUD, Wallbox, Sitzheizung dürfen **niemals vor Fahrzeuginteresse** kommen.

**Beobachten:** Tritt eine Technikfrage auf, bevor mindestens zwei Fahrzeughypothesen sichtbar waren?

| Signal | Bewertung |
|--------|-----------|
| Wallbox vor Alltag/Urlaub oder Anhängerart | ❌ Formular-Gefühl |
| Fahrzeugkarten sichtbar, dann gezielte Rückfrage | ✓ Verkäufer-Gefühl |

---

#### 2. Wie viele Fahrzeuge gleichzeitig?

| Ziel | Grenze |
|------|--------|
| **Standard** | 2 Fahrzeuge sichtbar (Top-Hypothesen) |
| **Maximum** | 3 Fahrzeuge aktiv |
| **Überlast** | Mehr als 4 → Kunde überfordert |

**Beobachten:** Scrollt der Kunde weg? Klickt er „Gefällt mir nicht“ ohne vorher die Karten gelesen zu haben?

---

#### 3. Wann verschwinden Fahrzeuge?

Empfehlung für die Beobachtung:

| Match | Darstellung |
|-------|-------------|
| **≥ 20 %** | Aktive Karte (🥇 🥈 🥉) |
| **< 20 %** | Faded card mit Begründung (z. B. „✕ Anhängelast zu gering“) |
| Sehr viele Ausgeschlossene | „Weitere Optionen“ statt langer Liste |

**Beobachten:** Versteht der Kunde *warum* ein Fahrzeug zurückfällt — ohne nachzufragen?

---

#### 4. Wann darf Clever Angebote vorbereiten?

Empfehlung:

```
Confidence > 85 %  UND  offene Fragen ≤ 2
        ↓
„Für welche Fahrzeuge dürfen wir etwas vorbereiten?“
```

**Beobachten:**

- Klickt der Kunde Angebot **vor** 60 Sekunden (zu früh)?
- Klickt er **nicht**, obwohl Match hoch ist (zu spät / unklarer CTA)?

---

### Verkäuferrealität — Kette beobachten

Der Kunde beantwortet **keine Fragen**.  
Der Kunde **erlebt**, wie sich die Empfehlung verbessert.

Das Fahrzeug muss **bereits nach der ersten Aussage** sichtbar sein.

| Kundenaussage | Erwartete sichtbare Reaktion |
|---------------|------------------------------|
| „Elektro Familie“ | EV3, EV5 sichtbar |
| „400 km Reichweite“ | EV6 steigt |
| „800V wichtig“ | EV6 übernimmt Führung |
| „zu teuer“ | EV6 fällt zurück, EV3 steigt |
| „gefällt mir optisch nicht“ | Fahrzeug verschwindet sofort |

**Beobachten:** Entsteht nach jeder Zeile eine **sichtbare** Kartenbewegung — nicht nur ein neues Chip?

---

### Die goldene Regel

Ein guter Verkäufer denkt:

> „Welches Auto passt aktuell am besten?“

Ein sehr guter Verkäufer denkt:

> „Welche Information würde meine Empfehlung noch besser machen?“

Genau diese **zweite Denkweise** bildet Clever ab.  
In der Beobachtungsphase messen wir, ob der Kunde **beides** spürt: Passung **und** Mitdenken.

---

### Erfolgsmessung (Zeitachse)

| Zeit | Kundengefühl |
|------|----------------|
| **20 s** | „Die verstehen mich.“ |
| **40 s** | „Die denken mit.“ |
| **60 s** | „Der EV5 wäre tatsächlich spannend.“ |
| **90 s** | „Machen Sie mir bitte ein Angebot.“ |

**Beobachten:** An welcher Sekunde bricht die Kette ab? Wo nur Chips, aber keine Kartenbewegung?

---

### Definition of Done (Beobachtungsphase)

Der Kunde fühlt sich **nicht** durch einen Fragebaum geführt.

Der Kunde fühlt sich **durch eine Empfehlung** begleitet.

**Done**, wenn in echten Sessions wiederholt gilt:

- [ ] Nach erster Aussage sind Fahrzeuge sichtbar
- [ ] Jede Antwort verschiebt mindestens eine Karte oder Match-%
- [ ] Technikfragen kommen erst nach Fahrzeuginteresse
- [ ] Ausgeschlossene Fahrzeuge sind begründet sichtbar (faded)
- [ ] Angebots-CTA erst bei hoher Confidence und wenigen offenen Fragen
- [ ] 90-Sekunden-Moment („Angebot bitte“) tritt ohne Push auf

---

### Erlaubte Verfeinerungen (nur innerhalb der Pipeline)

- Texte in `buildSellerQuestionPrompt()` / Reaktions-Copy
- Schwellwerte Match-% und Confidence (UI, read-only)
- Reihenfolge der Impact-Fragen im Planner
- Fahrzeugdaten in `KIA_MODEL_ATTRIBUTES` / Katalog
- Parser-Erkennung → bessere Chips

**Nicht erlaubt:** neue Schreibpfade, neue Wahrheiten, parallele Empfehlungs-Engines.

