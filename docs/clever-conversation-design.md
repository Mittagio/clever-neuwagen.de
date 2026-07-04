# Clever – Conversation Design (Phase 2)

**Status:** UX-Spezifikation · kein Code  
**Stand:** Juli 2026  
**Bezug:** [Produktprinzipien](CLEVER_PRODUCT_PRINCIPLES.md) (verbindlich) · [Manifest](CLEVER_MANIFEST.md) · [Clever Lead](CLEVER_LEAD.md) · Phase 1 (`feat: split clever consultation worlds`) – drei Welten, `NeedProfile`, Golden Rules in `.cursor/rules/clever-consultation.mdc`

---

## Begriffe (verbindlich)

| Bevorzugt | Verwendung |
|-----------|------------|
| Wunsch aufnehmen | Welt 1 – Bedarf sammeln |
| Wunsch ergänzen | Kunde fügt im Gespräch hinzu |
| Wunschprofil | `NeedProfile` – wächst sichtbar |
| Clever Lead | Ergebnis – Übergabe an Verkäufer |
| Übergabe an Berater / Verkäufer übernimmt | Welt 3 |
| Offene Punkte | Ehrliche Lücken – besser als falsche Empfehlung |

| Nur wenn … | Begriff |
|------------|---------|
| Konkretes Modell im Gespräch | **Fahrzeugberatung** (Welt 2) |

**Nicht** als Identität oder Einstieg: „digitaler Fahrzeugberater“, „Clever findet das perfekte Auto“.

---

## Der eine Leitsatz

> **Jede UI-Entscheidung muss die Frage beantworten: „Fühlt sich das wie Software an – oder wie ein guter Verkäufer?“**  
> Wenn es sich nach Software anfühlt, ist die Lösung noch nicht gut genug.

---

## Was wir bauen – und was nicht

| Wir bauen **nicht** | Wir bauen |
|---------------------|-----------|
| Messenger (WhatsApp) | Bedarfsgespräch |
| Chatbot (ChatGPT) | Verkaufsassistent namens Clever |
| Wizard / Formular | Ein Gespräch mit einer Frage pro Moment |
| Vergleichsportal | Ein Clever Lead – Wünsche verstanden, Verkäufer vorbereitet |
| Konfigurator-Einstieg | Wunsch zuerst, Fahrzeug danach |

**Kernunterscheidung:** Kein Chat – ein **Gespräch**. Ein Chat ist eine Messenger-Oberfläche. Ein Gespräch ist ein Verkaufsassistent, der zuhört und vorbereitet.

**Metapher:** Nicht „mit einem Bot chatten“, sondern **am Empfang sitzen**, während jemand aufmerksam mitnotiert und am Ende sagt: *„Ich habe alles für Ihren Berater vorbereitet.“*

**USP:** Nicht KI. Nicht GPT. **Sichtbares Verstehen** – und ein **Clever Lead**, der den Verkäufer nicht bei Null beginnen lässt.

---

## Drei Welten (Produktarchitektur)

| Welt | Name | Inhalt |
|------|------|--------|
| 1 | **Wunsch aufnehmen** | Kein Fahrzeug, kein Trim, keine Rate – nur Bedarf und Wunschprofil |
| 2 | **Fahrzeugberatung** | Nur wenn Modell konkret im Gespräch → Ausstattung, Trim, Fahrzeugwissen |
| 3 | **Übergabe** | Autohaus: Clever Lead, Kontakt, Verkäufer übernimmt |

Welten dürfen sich **weder technisch noch im UX** vermischen. Welt 1 endet mit einem **Clever Lead** – optional mit einer ersten Richtung, nie mit drei gleichwertigen Karten.

**NeedProfile** ist die digitale DNA des Kunden (`lead.crm.needProfile`) – alle Welten lesen daraus. Der **Clever Lead** ist die menschenlesbare Übergabe. Siehe [CLEVER_LEAD.md](CLEVER_LEAD.md).

---

## Die Geschichte in fünf Akten

```
1. Clever hört mir zu.          → Ich darf erzählen.
2. Clever macht sich Notizen.   → Ich sehe, was er aufschreibt.
3. Clever versteht mich.        → Das Wunschprofil wird vollständiger.
4. Clever fasst zusammen.       → Clever Lead – optional erste Richtung.
5. Der Verkäufer übernimmt.     → Mensch + Autohaus (Welt 3).
```

---

## Golden Rules (aus Phase 1, für UX verbindlich)

1. **Eine Frage pro Turn** – kein Wizard, keine Fragenliste.
2. **Niemals Bekanntes erneut fragen** – Parser + sichtbare Notizen.
3. **Erster Satz Clever ist nie eine Frage** – der Kunde spricht zuerst.
4. **Clever Lead im Mittelpunkt** – Wünsche, Fakten, offene Punkte; Richtung optional, nie erzwungen.
5. **Weltwechsel emotional spürbar** – neues Kapitel, nicht nur neuer Inhalt.
6. **Fahrzeugfragen beantworten, wenn der Kunde fragt** – Gespräch beginnt nie mit Fahrzeugwissen.

---

## Gesprächsoberfläche – Anatomie

Keine Chatblasen links/rechts. Vertikale **Beratungsfläche**:

```
┌──────────────────────────────────────────┐
│  [dezent: Händler-Name, optional]        │
│  ┌ Notizleiste – wächst langsam ───────┐ │
│  │ Clever notiert sich … / kennt …    │ │
│  │  ✓ Elektro   ✓ Familie   +plop     │ │
│  └────────────────────────────────────┘ │
│         ·  viel Weißraum  ·              │
│     [ Gesprächsverlauf, max. ~420 px ]   │
│         ·  viel Weißraum  ·              │
├──────────────────────────────────────────┤
│  [ Ich suche …                    ➜ ]   │  ← immer sichtbar
└──────────────────────────────────────────┘
```

- **Typografie:** groß, ruhig, wenig Chrome
- **Clever:** Textblock mit Marke „Clever“, keine Sprechblase
- **Kunde:** zentriert, leicht hervorgehoben, keine Bubble
- **Farbe:** viel Weiß, Akzente sparsam, keine KI-Gradienten
- **Apple-Test:** weniger UI, mehr Inhalt; Animation mit Zweck; Premium = Ruhe

---

# Screen 1 – Der Kunde beginnt (Welt 1: Wunsch aufnehmen)

## Emotion
Einladung. Kein Druck. Keine Prüfung.

## Der Kunde sieht NICHT
Fahrzeuge, Preise, Karten, Clever-Fragen.

## Layout

```
         Willkommen im Autohaus [Name].

    Erzählen Sie mir einfach, wonach Sie suchen.

    Ich nehme Ihre Wünsche auf und bereite alles
    für Ihren persönlichen Berater vor.

    ┌─────────────────────────────────────┐
    │  Ich suche …                     ➜ │
    └─────────────────────────────────────┘
              🎤  oder sprechen

    ─────────── oder ein Beispiel ───────────

      Familie    SUV    Elektro    Hybrid
      bis 350 €   Hund   Wohnwagen
```

## Copy (fest)

| Element | Text |
|---------|------|
| Begrüßung | „Willkommen im Autohaus [Name].“ |
| Einladung | **„Erzählen Sie mir einfach, wonach Sie suchen.“** |
| Vorbereitung | „Ich nehme Ihre Wünsche auf und bereite alles für Ihren persönlichen Berater vor.“ |
| Eingabe-Platzhalter | „Ich suche …“ |
| Beispiele | „oder ein Beispiel“ |

## Verboten als erster Clever-Satz
- „Ich bin Clever – Ihr digitaler Fahrzeugberater …“
- „Wie kann ich Ihnen helfen?“
- „Welche Fahrzeugart suchen Sie?“
- Fahrzeugwissen, Specs, Modellnamen

## Interaktion
- ➜ in der Eingabezeile sendet – **kein „Weiter“-Button**
- Beispiel-Chips: direkt senden (empfohlen) oder kurz ins Feld
- 🎤 = Diktat in dieselbe Leiste

## Mikrointeraktion
- Erstes Tippen: Eingabe hebt sich minimal (1 px Schatten)
- Chip-Tap: sanftes Fill, kein Knall

## Übergang → Screen 2
Kundentext erscheint ruhig im Verlauf → Notizleiste erscheint → erste ✓ per plop (wenn Parser etwas erkannt hat).

---

# Screen 2 – Das Gespräch (Welt 1: Wunsch ergänzen)

## Emotion
Jemand hört zu und schreibt mit – nicht „KI verarbeitet“.

## Darstellung (kein Chat)

**Kunde** (zentriert, ohne Bubble):
```
                    Auch im Urlaub – längere Strecken.
```

**Clever** (ruhiger Block, Abstand 32–48 px):
```
    Clever
    Darf ich noch kurz fragen: Fahren Sie im
    Alltag eher kurze Strecken – oder auch
    regelmäßig längere, zum Beispiel in den Urlaub?
```

## Nach jeder Kundenantwort – Signature-Moment

**Nicht:** „Ich habe verstanden.“  
**Sondern:**

```
    ─── Das habe ich über Sie gelernt ───

         ✓ Langstrecke
         ✓ Urlaub / längere Fahrten

    ───────────────────────────────────
```

Wie ein Verkäufer, der ins Notizbuch schreibt.

## Wachsende Notizleiste (sticky)

| Phase | Label |
|-------|-------|
| Anfang | „Clever notiert sich …“ |
| Mitte | „Clever kennt bereits …“ |
| Vor Zusammenfassung | „Das weiß ich über Sie“ |
| Offene Punkte | „Noch offen …“ (ehrlich, nicht versteckt) |

**Verhalten:**
- Jeder neue Punkt: **plop** (200 ms, scale 0.92→1, opacity 0→1)
- Chronologische Reihenfolge wie gelernt
- Bereits Bekanntes pulsiert nicht erneut
- Kunde **beobachtet**, wie Clever schlauer wird

## Eine Frage pro Moment

Optional kleine Hilfen unter der Frage:
```
    [ 1–2 ]  [ 3–4 ]  [ 5 ]  [ 6–7 ]
```
Freitext in der unteren Leiste geht immer.

## Fragen-Priorität (max. ~8 Turns)

1. Personen / Familie / Kinder  
2. Antrieb (falls unklar)  
3. Fahrzeugart (falls unklar)  
4. Budget + Zahlungsart  
5. Kilometer/Jahr  
6. Langstrecke vs. Stadt  
7. Laden zuhause  
8. Anhänger / Hund / Stauraum  

Nur fragen, was Parser + NeedProfile noch nicht mit hoher Confidence haben.

## Beispiel-Dialog (Happy Path)

**Kunde:** *„Ich suche ein Elektroauto für zwei Kinder, bis etwa 350 Euro im Monat.“*

**Notizleiste** (plop nacheinander, 150 ms Abstand):  
`✓ Elektro` · `✓ Familie` · `✓ 2 Kinder` · `✓ Budget ~350 €`

**Lern-Block:** dieselben Punkte unter „Das habe ich über Sie gelernt“

**Clever** (eine Lücke):
```
Gut – noch eine Sache: Fahren Sie eher kurze Strecken
im Alltag, oder auch regelmäßig längere – zum Beispiel in den Urlaub?
```

**Kunde:** *„Auch Urlaub.“*  
→ Lern-Block: `✓ Langstrecke` · Notizleiste plop

**Clever** (falls nötig):
```
Können Sie zu Hause laden – Garage oder Wallbox?
```

**Kunde:** *„Ja, Garage.“*  
→ Lern-Block: `✓ Laden zuhause`

Wenn nichts Wesentliches fehlt: **keine weitere Frage** → Screen 3 (Clever Lead).

## Fahrzeugfragen des Kunden (jederzeit)

Wenn der Kunde fragt: *„Wie groß ist der Kofferraum vom Sportage?“* – Clever antwortet kurz und kehrt zum Wunschprofil zurück.

Clever **beginnt** das Gespräch nie mit Fahrzeugwissen.

## Pause vor Zusammenfassung
400–600 ms, Text: „Clever denkt einen Moment nach …“ – kein Spinner.

## Eingabe unten – dauerhaft
```
[ Ich suche …  ➜ ]
```
Kunde kann jederzeit ergänzen („ach ja, Hund“) – Notizleiste wächst.

---

# Screen 3 – Clever Lead & optional erste Richtung (Welt 1 Ende)

## Emotion
Jemand, der mich kennt, fasst ehrlich zusammen – und bereitet den Berater vor.

## Verboten
- „Hier sind drei passende Fahrzeuge.“
- Leasingrate / „ab 299 €“ als Einstieg
- Gleich große Modellkarten als Pflicht
- Falsche Empfehlung statt offener Punkte

## Layout

```
    [ Notizleiste – vollständig ]

    Clever Lead – So habe ich Sie verstanden

    ✓ Elektro  ✓ Familie  ✓ 2 Kinder
    ✓ Langstrecke  ✓ Garage  ✓ ~350 €

    Offene Punkte:
    • jährliche Kilometer
    • Leasing oder Kauf

    ─────────────────────────────────

    [ Optional – nur wenn sinnvoll ]

    Nach Ihren Angaben würde ich zuerst den

              Kia EV3

              ansehen.

         [ ruhiges Fahrzeugbild – Studio, nicht Banner ]

    Warum?

    ✓ passt zu Ihrer Familie
    ✓ ausreichend Reichweite
    ✓ innerhalb Ihres Budgets

    ─── Alternativen ───
         EV4          Niro EV
      (sekundär, kleiner)

    ┌─────────────────────────────────┐
    │   Berater kontaktieren       ➜  │
    └─────────────────────────────────┘

         Noch etwas ergänzen?
         [ Wunsch ergänzen ]
```

## Copy
- Zusammenfassung: „So habe ich Sie verstanden“ – nicht „Ich habe verstanden“
- Optional Richtung: „Nach Ihren Angaben würde ich zuerst den **Kia EV3** ansehen.“
- Offene Punkte immer sichtbar, wenn vorhanden
- Primärer CTA: **Übergabe an Berater** – nicht „Jetzt kaufen“

## Mikrointeraktion
- Clever Lead: Fade-up 400 ms
- Optionale Richtung: gestaffelt nach Zusammenfassung
- „Noch etwas ergänzen?“ → zurück ins Gespräch, Notizen bleiben

## Übergang → Welt 2 (nur bei Modell-Fokus)
```
Clever
Prima. Dann schauen wir uns den Kia EV3
gemeinsam etwas genauer an.
```
400 ms Pause → sichtbarer Weltwechsel (Screen 4).

---

# Screen 4 – Fahrzeugberatung (Welt 2)

## Emotion
Jetzt kennen wir uns. Jetzt geht es um dieses eine Auto.

## Weltwechsel – spürbar
- Header: „Fahrzeugberatung · Kia EV3“
- Feine visuelle Änderung (Linie, minimal wärmerer Ton)
- **Notizleiste bleibt** – Clever vergisst nichts
- Crossfade Header 300 ms

## Erster Turn
```
    Clever
    Schön. Beim EV3 gibt es verschiedene
    Ausstattungslinien – ist Ihnen eher
    Reichweite oder Komfort/Ausstattung wichtiger?
```

Danach: Wärmepumpe, GT-Line, HUD, Earth, AHK – nur modellbezogen.

## Eingabe
Gleiche Leiste, Platzhalter optional: „Noch eine Frage zum EV3 …“

## Welt 3 (Ausblick)
Nach Übergabe: Verkäufer übernimmt mit Clever Lead – Rate, Portal, persönlicher Kontakt (Welt 3).

---

# Mikrointeraktionen – Katalog

| Moment | Animation | Dauer |
|--------|-----------|-------|
| Neuer ✓ Notizleiste | plop (scale + fade) | 200 ms |
| Lern-Block | Fade-up 12 px | 250 ms |
| Clever-Text neu | Fade-in, kein Typewriter | 300 ms |
| Vor Empfehlung | „Denkt einen Moment nach …“ | 400–600 ms |
| Empfehlung EV3 | Name nach Bild gestaffelt | ~500 ms |
| Welt 1 → 2 | Header crossfade | 300 ms |
| Korrektur | Chip-Update, kurzes Highlight | 200 ms |

**Nie:** Konfetti, „KI analysiert“, blinkende Badges, Typewriter für alles.

---

# Emotionale Landkarte (~2 Minuten)

| Zeit | Kunde fühlt |
|------|-------------|
| 0:00 | Ich darf erzählen |
| 0:30 | Er notiert sich das |
| 0:45 | Er versteht mich |
| 1:30 | Alles ist zusammengefasst – Clever Lead |
| 2:00 | Optional: konkretes Modell – oder direkt Übergabe |

**Ziel-Satz:** *„Das war kein Formular. Das war ein Gespräch.“*

---

# Design-Checkliste (vor Implementierung)

- [ ] Fühlt sich das wie ein guter Verkäufer an – oder wie Software?
- [ ] Spricht der Kunde zuerst?
- [ ] Nur eine Frage pro Moment?
- [ ] „Das habe ich über Sie gelernt“ statt „Ich habe verstanden“?
- [ ] Wächst die Notizleiste organisch mit plop?
- [ ] Keine Chatblasen?
- [ ] Eingabe unten immer – kein „Weiter“?
- [ ] Clever Lead sichtbar – Wünsche und offene Punkte getrennt?
- [ ] Offene Punkte statt falscher Empfehlung?
- [ ] Gespräch beginnt beim Menschen – nicht mit Fahrzeugwissen?
- [ ] Fahrzeugfragen nur auf Kundenanfrage?
- [ ] Empfehlung optional, nie Pflicht?
- [ ] Welt 2 emotional neues Kapitel?
- [ ] Keine Rate vor Welt 3?

---

# Offene Design-Entscheidungen

1. **Beispiel-Chips:** direkt senden (empfohlen) vs. ins Feld füllen  
2. **Antwort-Hilfen:** immer oder nur bei geschlossenen Fragen  
3. **„Passt nicht?“:** Freitext-Turn vs. zurück zu Fragen  
4. **Händler-Branding:** Logo klein vs. Clever-neutral  
5. **Desktop:** max. 420 px zentrierte Spalte (empfohlen)

---

# Nächste Schritte (Design, kein Code)

- [ ] Happy Path Turn-für-Turn mit exaktem Copy dokumentieren  
- [ ] Edge Cases: „weiß noch nicht“, „nur Tesla“, Korrekturen  
- [ ] Notizleiste: Max-Chips, Scroll, Korrektur-UX  
- [ ] Phase 2 Implementierung: `ConsultationConversation` UI-Komponente  

---

# Technischer Bezug (Phase 1, bereits im Repo)

| Baustein | Pfad |
|----------|------|
| Drei Welten | `src/services/consultation/consultationWorlds.js` |
| NeedProfile | `src/services/consultation/needProfileService.js` |
| Fragen Welt 1/2 | `src/services/consultation/consultationQuestions.js` |
| Primärempfehlung | `src/services/consultation/consultationRecommendation.js` |
| Golden Rules | `.cursor/rules/clever-consultation.mdc` |
| Tests | `npm run test:consultation` |
