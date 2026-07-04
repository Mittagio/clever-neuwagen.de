# Clever – Conversation Design (Phase 2)

**Status:** UX-Spezifikation · kein Code  
**Stand:** Juli 2026  
**Bezug:** [Produktprinzipien](CLEVER_PRODUCT_PRINCIPLES.md) (verbindlich) · [Manifest](CLEVER_MANIFEST.md) · Phase 1 (`feat: split clever consultation worlds`) – drei Welten, `NeedProfile`, Golden Rules in `.cursor/rules/clever-consultation.mdc`

---

## Der eine Leitsatz

> **Jede UI-Entscheidung muss die Frage beantworten: „Fühlt sich das wie Software an – oder wie ein guter Verkäufer?“**  
> Wenn es sich nach Software anfühlt, ist die Lösung noch nicht gut genug.

---

## Was wir bauen – und was nicht

| Wir bauen **nicht** | Wir bauen |
|---------------------|-----------|
| Messenger (WhatsApp) | Beratungsgespräch |
| Chatbot (ChatGPT) | Digitaler Berater namens Clever |
| Wizard / Formular | Ein Gespräch mit einer Frage pro Moment |
| Vergleichsportal | Eine persönliche Empfehlung |
| Konfigurator-Einstieg | Bedarf zuerst, Fahrzeug danach |

**Kernunterscheidung:** Kein Chat – ein **Gespräch**. Ein Chat ist eine Messenger-Oberfläche. Ein Gespräch ist ein digitaler Berater.

**Metapher:** Nicht „mit einem Bot chatten“, sondern **neben einem ruhigen Verkäufer sitzen**, der mitliest, notiert und am Ende sagt: *„Wissen Sie was – ich würde zuerst hier schauen.“*

**USP:** Nicht KI. Nicht GPT. **Sichtbares Verstehen.**

---

## Drei Welten (Produktarchitektur)

| Welt | Name | Inhalt |
|------|------|--------|
| 1 | **Clever Beratung** | Kein Fahrzeug, kein Trim, keine Rate – nur Bedarf |
| 2 | **Fahrzeugberatung** | Modell gewählt → Ausstattung, Trim, Fahrzeugwissen |
| 3 | **Angebot** | Autohaus: Rate, Portal, Journey, Verkäufer |

Welten dürfen sich **weder technisch noch im UX** vermischen. Welt 1 endet mit **einer Empfehlung** (nicht drei gleichwertigen Karten).

**NeedProfile** ist die digitale DNA des Kunden (`lead.crm.needProfile`) – alle Welten lesen daraus.

---

## Die Geschichte in fünf Akten

```
1. Clever hört mir zu.          → Ich darf erzählen.
2. Clever macht sich Notizen.   → Ich sehe, was er aufschreibt.
3. Clever versteht mich.        → Die Notizen werden vollständiger.
4. Clever empfiehlt mir etwas.  → Eine Richtung, nicht zehn Karten.
5. Mein Berater übernimmt.      → Mensch + Autohaus (Welt 3).
```

---

## Golden Rules (aus Phase 1, für UX verbindlich)

1. **Eine Frage pro Turn** – kein Wizard, keine Fragenliste.
2. **Niemals Bekanntes erneut fragen** – Parser + sichtbare Notizen.
3. **Erster Satz Clever ist nie eine Frage** – der Kunde spricht zuerst.
4. **Empfehlung im Mittelpunkt** – Alternativen sekundär.
5. **Weltwechsel emotional spürbar** – neues Kapitel, nicht nur neuer Inhalt.

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

# Screen 1 – Der Kunde beginnt (Welt 1)

## Emotion
Einladung. Kein Druck. Keine Prüfung.

## Der Kunde sieht NICHT
Fahrzeuge, Preise, Karten, Clever-Fragen.

## Layout

```
                    Hallo.

         Ich bin Clever – Ihr digitaler
         Fahrzeugberater bei [Autohaus].

    Erzählen Sie mir einfach, wonach Sie suchen.

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
| Begrüßung | „Hallo.“ |
| Vorstellung | „Ich bin Clever – Ihr digitaler Fahrzeugberater bei [Autohaus].“ |
| **Erster Satz** | **„Erzählen Sie mir einfach, wonach Sie suchen.“** |
| Eingabe-Platzhalter | „Ich suche …“ |
| Beispiele | „oder ein Beispiel“ |

## Verboten als erster Clever-Satz
- „Wie kann ich Ihnen helfen?“
- „Welche Fahrzeugart suchen Sie?“

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

# Screen 2 – Das Gespräch (Welt 1)

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
| Vor Empfehlung | „Das weiß ich über Sie“ |

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

Wenn nichts Wesentliches fehlt: **keine weitere Frage** → Screen 3.

## Pause vor Empfehlung
400–600 ms, Text: „Clever denkt einen Moment nach …“ – kein Spinner.

## Eingabe unten – dauerhaft
```
[ Ich suche …  ➜ ]
```
Kunde kann jederzeit ergänzen („ach ja, Hund“) – Notizleiste wächst.

---

# Screen 3 – Die Empfehlung (Welt 1 Ende)

## Emotion
Jemand, der mich kennt, sagt ehrlich, womit ich anfangen soll.

## Verboten
- „Hier sind drei passende Fahrzeuge.“
- Leasingrate / „ab 299 €“
- Gleich große Modellkarten

## Layout

```
    [ Notizleiste – vollständig ]

    Das habe ich über Sie gelernt
    ✓ Elektro  ✓ Familie  ✓ 2 Kinder
    ✓ Langstrecke  ✓ Garage  ✓ ~350 €

    ─────────────────────────────────

    Nach Ihren Angaben würde ich zuerst den

              Kia EV3

              ansehen.

         [ ruhiges Fahrzeugbild – Studio, nicht Banner ]

    Warum?

    ✓ passt zu Ihrer Familie
    ✓ ausreichend Reichweite
    ✓ innerhalb Ihres Budgets
    ✓ Anhängerkupplung möglich

    ─── Alternativen ───
         EV4          Niro EV
      (sekundär, kleiner)

    ┌─────────────────────────────────┐
    │   EV3 genauer ansehen        ➜  │
    └─────────────────────────────────┘

         Passt nicht ganz?
         [ Andere Richtung besprechen ]
```

## Copy
- Empfehlung: „Nach Ihren Angaben würde ich zuerst den **Kia EV3** ansehen.“
- Warum-Zeilen immer mit „Sie/Ihr“, nie technisch

## Mikrointeraktion
- Empfehlung: Fade-up 400 ms, Name 100 ms gestaffelt
- „Passt nicht ganz?“ → zurück in Gespräch, Notizen bleiben

## Übergang → Welt 2
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
Nach Fahrzeugberatung: „Ihr Autohaus bereitet ein passendes Angebot vor“ – anderer Screen-Stil (Rate, Portal, Verkäufer).

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
| 1:30 | Er empfiehlt ehrlich |
| 2:00 | Jetzt geht’s um das Auto – logisch |

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
- [ ] Empfehlung zentral, Alternativen sekundär?
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
