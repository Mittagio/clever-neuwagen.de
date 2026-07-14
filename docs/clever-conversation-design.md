# Clever – Conversation Design (Phase 2)

**Status:** UX-Spezifikation · kein Code  
**Stand:** Juli 2026  
**Bezug:** [Produktprinzipien](CLEVER_PRODUCT_PRINCIPLES.md) (verbindlich) · [Manifest](CLEVER_MANIFEST.md) · **[Vier Aufgaben](CLEVER_FOUR_TASKS.md)** · [Clever Lead](CLEVER_LEAD.md) · **[Need Discovery Engine v1.0](CLEVER_NEED_DISCOVERY_ENGINE.md)** · **[Knowledge Conversation v1.0](CLEVER_KNOWLEDGE_CONVERSATION.md)** · **[Golden Conversations v1.0](CLEVER_GOLDEN_CONVERSATIONS.md)**

**Verbindliche Produktentscheidung (Juli 2026):** Clever besteht aus **genau zwei Welten** — Wunschgespräch und Fahrzeuggespräch. Übergabe an den Verkäufer ist kein drittes Gespräch, sondern das gemeinsame Ende beider Wege.

---

## Begriffe (verbindlich)

| Bevorzugt | Intern | Bedeutung |
|-----------|--------|-----------|
| **Wunschgespräch** | Need Conversation | Welt 1 — Lebenssituation, Wünsche, Orientierung |
| **Fahrzeuggespräch** | Vehicle Conversation | Welt 2 — ein konkretes Fahrzeug, Passung prüfen |
| **Übergabe** | Handoff | Clever Lead → Verkäufer übernimmt |
| Wunschprofil | `NeedProfile` | Wächst sichtbar in beiden Welten |
| Clever Lead | — | Dokument des Verständnisses für den Verkäufer |
| Offene Punkte | — | Ehrliche Lücken — besser als falsche Richtung |

**Nicht** als Identität oder Einstieg: „digitaler Fahrzeugberater“, „Clever findet das perfekte Auto“, Angebot, Leasing, Kauf.

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

## Der Leitsatz

> **Clever beginnt immer dort, wo der Kunde gerade steht.**

Nicht dort, wo der Konfigurator beginnt. Nicht dort, wo das Autohaus beginnen möchte.

---

## Die zwei Welten

Clever besteht aus **genau zwei Welten**. Nicht mehr.

| Welt | Name | Intern | Inhalt |
|------|------|--------|--------|
| **1** | **Wunschgespräch** | Need Conversation | Lebenssituation, Wünsche, Orientierung — **kein** konkretes Fahrzeug |
| **2** | **Fahrzeuggespräch** | Vehicle Conversation | **2A:** Ein Modell — Passung prüfen · **2B:** Anschaffung vorbereiten |

### Die wichtigste Regel

Die beiden Welten dürfen sich **weder inhaltlich noch im UX** vermischen.

| Welt 1 | Welt 2 |
|--------|--------|
| Menschen | Ein konkretes Fahrzeug |
| Lebenssituationen | Ausstattung, Reichweite, Anhängelast |
| Wünsche | Passungsprüfung |
| Orientierung (Richtungen) | Nicht das gesamte Portfolio |

### Beide Welten enden gleich

```
Verständnis  →  Clever Lead  →  Verkäufer übernimmt
```

Nicht: Angebot. Nicht: Leasingrechner. Nicht: Vertragsabschluss.

Anschaffungsfragen (Budget, Kilometer, Kaufart) gehören in **Welt 2B** — nicht in den Hero, nicht als erste Frage in Welt 1.

### Der Gesprächsfluss

```
Wunschgespräch  (Welt 1)
       ↓
Fahrzeuggespräch  (Welt 2)
   ├─ 2A  Fahrzeug prüfen
   └─ 2B  Anschaffung vorbereiten
       ↓
Übergabe  (Clever Lead)
```

### Zwei Einstiege

**Einstieg A** — *„Ich suche ein Auto."*

```
Wunschgespräch  →  optional Fahrzeuggespräch  →  Übergabe  →  Verkäufer
```

**Einstieg B** — *„Ich möchte den EV5."*

```
Fahrzeuggespräch  →  Übergabe  →  Verkäufer
```

**NeedProfile** wächst in beiden Welten sichtbar. Der **Clever Lead** entsteht nach Welt 1, nach Welt 2 oder nach beiden — je nach Einstieg. Siehe [CLEVER_LEAD.md](CLEVER_LEAD.md).

---

## Die Geschichte in fünf Akten

Entspricht den [vier Aufgaben](CLEVER_FOUR_TASKS.md) — über beide Welten:

```
1. Clever hört mir zu.          → Zuhören
2. Clever versteht mich.        → Verstehen (Chips)
3. Clever ordnet ein.           → Einordnen (Richtungen) — vor allem Welt 1
4. Clever prüft die Passung.    → Fahrzeuggespräch — Welt 2
5. Der Verkäufer übernimmt.     → Übergeben (Clever Lead)
```

---

## Golden Rules (aus Phase 1, für UX verbindlich)

Siehe [Die vier Aufgaben](CLEVER_FOUR_TASKS.md) und [vier Produktfragen](CLEVER_FOUR_TASKS.md#die-vier-produktfragen).

1. **Eine Frage pro Turn** – nur wenn Verstehen/Einordnen es erfordert; Fragen sind keine Pflicht.
2. **Niemals Bekanntes erneut fragen** – Parser + sichtbare Notizen.
3. **Erster Satz Clever ist nie eine Frage** – der Kunde spricht zuerst (Zuhören).
4. **Orientierung statt Empfehlung** – Einordnen, Kunde reagiert; Clever Lead bei Übergeben.
5. **Weltwechsel emotional spürbar** — neues Kapitel: vom Wunschgespräch zum Fahrzeuggespräch.
6. **Fahrzeugwissen auf Nachfrage** (Welt 1) / **im Dienst der Passung** (Welt 2).
7. **Kein Angebot vor Übergabe** — Clever endet mit Verständnis, nicht mit Leasing oder Kauf.

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

# Screen 1 – Der Kunde beginnt (Welt 1: Wunschgespräch / **Empfang**)

Die Händler-Startseite ist der **digitale Empfang** – nicht Landingpage, nicht Suche, nicht Modellkatalog.

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

# Screen 2 – Das Wunschgespräch (Welt 1)

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

## Fragen-Priorität Welt 1 (Wunschgespräch)

Nur fragen, was Parser + NeedProfile noch nicht erkannt haben.

1. Lebenssituation / Nutzung (Familie, Kinder, Hund, Arbeitsweg, Urlaub)  
2. Antrieb — **nur** wenn unklar und relevant  
3. Fahrzeugart — **nur** wenn unklar  
4. Stadt / Langstrecke / Anhänger / Zugfahrzeug  
5. **Fahrzeugrichtungen** zeigen — Kunde reagiert  

**Nicht in Welt 1 systematisch:** Kilometer/Jahr, Leasing/Finanzierung/Kauf, Laufzeit, Anzahlung.

**Ausnahme:** Der Kunde nennt Budget oder Kaufart selbst → sofort als Chip.

## Fragen-Priorität Welt 2A (Fahrzeug prüfen)

1. Nutzung / Passt das zum Alltag?  
2. Platz / Kofferraum / Größe  
3. Reichweite / Batterie (bei Elektro)  
4. Anhängelast / AHK  
5. Ausstattung / Bedenken / Farbe / Lieferzeit  

## Fragen-Priorität Welt 2B (Anschaffung vorbereiten)

**Erst nach klarem Fahrzeuginteresse.** Eine Frage pro Moment.

1. Leasing, Finanzierung, Kauf — oder noch offen?  
2. Wunschbudget (z. B. bis 300 / 400 / 500 € — oder offen)  
3. Kilometer pro Jahr (10.000 / 15.000 / 20.000 — oder offen)  
4. Laufzeit — wenn relevant  
5. Anzahlung / Inzahlungnahme — wenn relevant  
6. Gewünschter Zeitraum  

**Übergang von 2A → 2B:**

```
Damit Ihr Berater das passend vorbereiten kann:
Möchten Sie den EV5 eher leasen, finanzieren oder kaufen?
```

## Beispiel-Dialog Welt 1 (Zugfahrzeug)

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

# Screen 3 – Übergabe (Clever Lead)

Gilt nach **Welt 1 allein**, nach **Welt 1 + Welt 2**, oder nach **Welt 2 allein** (Einstieg B).

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

## Übergang → Welt 2 (Fahrzeuggespräch)

Nur wenn der Kunde ein Modell wählt oder klar Interesse zeigt:

```
Clever
Schauen wir gemeinsam, ob der Kia EV3
wirklich zu Ihrem Wunsch passt.
```

400 ms Pause → sichtbarer Weltwechsel (Screen 4).

**Einstieg B** überspringt Screen 1–3 und beginnt direkt bei Screen 4.

---

# Screen 4 – Fahrzeuggespräch (Welt 2)

## Emotion
Jetzt kennen wir den Wunsch — oder der Kunde kam direkt mit einem Modell. Jetzt geht es um **Passung**.

## Weltwechsel – spürbar
- Header: „Fahrzeuggespräch · Kia EV3"
- Feine visuelle Änderung (Linie, minimal wärmerer Ton)
- **Notizleiste bleibt** — Clever vergisst nichts aus dem Wunschgespräch
- Crossfade Header 300 ms

## Erster Turn (Einstieg B)

```
    Clever
    Schauen wir gemeinsam, ob der EV5
    wirklich zu Ihrem Wunsch passt.
```

## Erster Turn (nach Welt 1)

```
    Clever
    Schön. Beim EV3 gibt es verschiedene
    Ausstattungslinien — ist Ihnen eher
    Reichweite oder Komfort/Ausstattung wichtiger?
```

Danach: Wärmepumpe, GT-Line, HUD, Earth, AHK — nur modellbezogen, immer mit der Frage: **Passt das zu Ihnen?**

## Eingabe
Gleiche Leiste, Platzhalter optional: „Noch eine Frage zum EV3 …"

## Ende Welt 2

Nicht mit Rate oder Angebot.

Nach **2A** (Passung geklärt) und **2B** (Anschaffung vorbereitet, soweit sinnvoll):

**Clever Lead** → Übergabe → Verkäufer übernimmt.

### Übergang 2A → 2B (verbindlich)

Sichtbarer Moment — neues Kapitel innerhalb Welt 2, nicht Weltwechsel:

```
Clever
Damit Ihr Berater das passend vorbereiten kann:
Möchten Sie den EV5 eher leasen, finanzieren oder kaufen?
```

Danach einzeln: Budget → Kilometer → ggf. Laufzeit, Anzahlung, Inzahlungnahme, Zeitraum.

Jede Antwort → Chip. Offenes bleibt unter **Offene Punkte** im Lead.

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
| 1:30 | Alles ist zusammengefasst — Clever Lead |
| 2:00 | Optional: Fahrzeuggespräch — oder direkt Übergabe |

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
- [ ] Welt 2 emotional neues Kapitel (Fahrzeuggespräch)?
- [ ] Kein Angebot, keine Rate — nur Übergabe?
- [ ] Einstieg B: direkt Fahrzeuggespräch möglich?

---

*Clever ist der digitale Empfang des Autohauses. Er holt den Kunden genau dort ab, wo er gerade steht, und übergibt ihn erst dann, wenn ein gutes Verkaufsgespräch beginnen kann.*

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

# Technischer Bezug (Implementierung — kann von dieser Spezifikation abweichen)

| Baustein | Hinweis |
|----------|---------|
| Zwei Welten | Wunschgespräch + Fahrzeuggespräch — siehe [Vier Aufgaben](CLEVER_FOUR_TASKS.md) |
| NeedProfile | Wächst sichtbar in beiden Welten |
| Übergabe | Clever Lead — kein drittes Gespräch |
