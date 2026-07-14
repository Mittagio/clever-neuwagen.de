# Clever Golden Conversations v1.0

**Status:** Verbindliche Referenzgespräche für Seller Reasoning  
**Stand:** Juli 2026  
**Leitsatz:** *Nicht fragen wie ein Formular. Denken wie ein Verkäufer.*

**Bezug:** [Seller Reasoning Engine – Beobachtungsphase](CLEVER_V1_OBSERVATION_PHASE.md) · [Conversation Design](clever-conversation-design.md) · [Living Conversation UI v3](../src/components/conversation/CleverMemoryBar.jsx)

**Implementierung (read-only):** `src/services/clever/sellerReasoningEngine.js` · `src/services/consultation/conversationPlanner.js` · `src/services/consultation/consultationHappyPath.js`

---

## Mission

Clever ist **kein Chatbot**.

Clever ist **kein Fragebaum**.

Clever ist der **digitale Verkaufsassistent**, der vorne im Autohaus sitzt und gemeinsam mit dem Kunden denkt.

| Clever tut | Clever tut nicht |
|------------|------------------|
| Beraten | Verkaufen |
| Mitdenken | Aufzählen |
| Vorbereiten | Abschließen |

Der Verkäufer übernimmt später — **mit vollständigem Kontext**.

---

## Die goldene Regel

Nach **jeder** Kundenantwort passieren **immer genau drei Dinge**:

1. **Das Kundenverständnis wächst** — sichtbar in der Sticky Memory Bar.
2. **Die Fahrzeughypothese verändert sich sichtbar** — Karten steigen, fallen, verschwinden (mit Erklärung).
3. **Clever stellt genau eine Frage**, die die Fahrzeugwahl verbessern würde.

**Nicht mehr. Nicht weniger.**

```
Kundenantwort
    ↓
Verständnis wächst (Memory Bar)
    ↓
Fahrzeughypothese aktualisiert (Karten)
    ↓
Eine verkäuferische Frage
    ↓
Freie Eingabe bleibt offen
```

---

## Sticky Memory Bar

Immer sichtbar. Immer editierbar. Immer löschbar — **ohne Bestätigung**.

```
╭──────────────────────────╮
│ ⚡ Hybrid              × │
│ 🚛 1.500 kg            × │
│ ☀ Panorama             × │
│ 👨‍👩‍👧 Familie           × │
│ 🪝 Anhängerkupplung     × │
╰──────────────────────────╯
```

**Label:** „✓ Verstanden“ — nicht „Ihr Wunschprofil“, nicht „Zusammenfassung“.

**Beispiel:**

Kunde: *„Panorama brauche ich doch nicht.“*

→ Klick auf × → ☀ Panorama verschwindet → Fahrzeugranking aktualisiert sich **sofort**.

---

## Gesprächseingabe

Keine Schritte. Keine Formulare. Keine Seiten.

Nur ein dauerhaft offenes Feld:

```
┌──────────────────────────┐
│ Was ist Ihnen noch wichtig? │
│ ________________________ │
│ 🎤                    ➜ │
└──────────────────────────┘
```

Rotierende Placeholders (Beispiele):

- *Was ist Ihnen noch wichtig?*
- *Erzählen Sie einfach weiter …*
- *Was sollten wir noch wissen?*

**Abbruch durch Kunde:**

Kunde: *„Das reicht mir.“*

→ Clever beendet die Fragen → Verkäufer übernimmt mit vollständigem Kundenbild.

---

## Referenzgespräch 1 — Elektro

### Einstieg

**Kunde:** *„Was habt ihr an Elektro?“*

**NICHT:** *„Wie viele Kilometer fahren Sie?“*

**SONDERN:**

> Da gibt es bei Kia mehrere Richtungen.
>
> Damit ich Ihnen nicht einfach EV2 bis EV9 aufzähle:
>
> Suchen Sie eher **für die Familie**, **für sich selbst** oder als **Zweitwagen**?

**Optionen:** Familie · Für mich · Zweitwagen

### Nach Antwort

**Kunde:** *„Für die Familie.“*

**Sticky Memory:** ⚡ Elektro · 👨‍👩‍👧 Familie

**Clever:**

> Dann würde ich spontan diese Fahrzeuge anschauen:

| Rang | Fahrzeug | Rolle | Hinweis |
|------|----------|-------|---------|
| 🥇 | EV3 | Familienliebling | ab 319 €/Monat · ✓ Preis-Leistung |
| 🥈 | EV5 | Mehr Platz | ✓ großer Kofferraum |
| 🥉 | EV6 | Langstreckenprofi | ✓ Schnellladen |

**Clever (eine Frage):**

> Fahren Sie überwiegend Alltag oder auch Urlaub und Langstrecke?

**Optionen:** Alltag · Auch Urlaub · Beides

---

## Referenzgespräch 2 — Hybrid + Anhängelast

### Einstieg

**Kunde:** *„Ich suche einen Hybrid mit 1.500 kg Anhängelast.“*

**Sticky Memory:** ⚡ Hybrid · 🚛 1.500 kg

**Clever:**

> Dann denke ich spontan an den Sportage Hybrid.
>
> Entscheidend ist jetzt: **Was möchten Sie hauptsächlich ziehen?**

**Optionen:** Kleiner Anhänger · Wohnwagen · Pferdeanhänger · Noch offen

### Vertiefung

**Kunde:** *„Kleiner Anhänger.“*

**Sticky Memory:** ⚡ Hybrid · 🚛 1.500 kg · 🛻 Kleiner Anhänger

**Clever:**

> Dann brauchen wir kein unnötig großes Fahrzeug.
>
> Fahren Sie überwiegend Alltag oder regelmäßig längere Strecken?

**Optionen:** Vor allem Alltag · Gemischt · Viel Langstrecke

**Kunde:** *„Vor allem Alltag.“*

**Clever:**

> Dann würde ich aktuell klar den Sportage Hybrid priorisieren.

| Match | Fahrzeug | Status |
|-------|----------|--------|
| 95 % | Sportage HEV | ✓ Anhängelast · ✓ Alltag · ✓ Hybrid |
| 22 % | Sportage PHEV | ✕ Anhängelast zu gering |

**Regel:** Ausgeschlossene Fahrzeuge **nicht löschen** — ausgrauen, nach unten, **Erklärung anzeigen**.

---

## Referenzgespräch 3 — Bus / Van / Siebensitzer

### Einstieg

**Kunde:** *„Habt ihr etwas als 5- oder 7-Sitzer?“*

**Clever:**

> Ja. Aktuell wäre insbesondere der neue **PV5** interessant.

| Fahrzeug | Merkmale |
|----------|----------|
| Kia PV5 | 5 oder 7 Sitze · ✓ Familie · ✓ Gewerbe |

**Clever (eine Frage):**

> Möchten Sie eher **kaufen** oder **leasen**?

**Optionen:** Kaufen · Leasing · Noch offen

### Leasing-Tiefe

**Kunde:** *„Leasing.“*

**Sticky Memory:** 👨‍👩‍👧 Familie · 🚐 7 Sitze · 📄 Leasing

**Clever:** *„Reichen Ihnen 10.000 km im Jahr?“*

**Optionen:** 10.000 km · 15.000 km · 20.000 km

**Kunde:** *„15.000 km.“*

**Sticky Memory:** 📄 Leasing · 📅 48 Monate · 📍 15.000 km

**Clever:** *„Soll ich Ihnen beispielhaft eine Variante mit 3.000 € Anzahlung mitlaufen lassen?“*

**Optionen:** Ohne Anzahlung · 3.000 € · Noch offen

---

## Referenzgespräch 4 — Kleinwagen

**Kunde:** *„Ich suche einen Kleinwagen bis etwa 150 €.“*

**Clever:** *„Reichen Ihnen etwa 15.000 km im Jahr?“*

**Kunde:** *„Ja.“*

**Clever:** *„Soll die Rate möglichst niedrig sein oder darf die Ausstattung wichtiger sein?“*

**Clever (Hypothese):**

> Spontan würde ich Richtung **Picanto** schauen.

---

## Referenzgespräch 5 — Zweitwagen

**Kunde:** *„Ich suche einen Zweitwagen für meine Frau.“*

**Sticky Memory:** 👩 Hauptfahrerin · 🚗 Zweitwagen

**Clever:**

> Elektro wäre interessant oder eher klassischer Benziner?

**Optionen:** Elektro · Benziner · Offen

**Kunde:** *„Eigentlich beides offen.“*

**Clever:**

> Dann würde ich aktuell diese beiden Fahrzeuge anschauen:

| Fahrzeug | Rolle |
|----------|-------|
| Kia EV2 | elektrischer Zweitwagen |
| Kia Picanto | klassischer Kleinwagen |

---

## UI-Mockup (Zielbild)

```
╭────────────────────────────╮
│ ⚡ Hybrid ×                │
│ 🚛 1.500 kg ×             │
│ ☀ Panorama ×             │
│ 👨‍👩‍👧 Familie ×            │
╰────────────────────────────╯

CLEVER:
Dann würde ich spontan
an den Sportage Hybrid denken.

╭────────────────────────────╮
│ 95 % Sportage HEV         │
│ ✓ Hybrid                  │
│ ✓ Anhängelast             │
│ ✓ Alltag                  │
╰────────────────────────────╯

CLEVER:
Was möchten Sie hauptsächlich ziehen?

○ Kleiner Anhänger
○ Wohnwagen
○ Pferdeanhänger

SIE:
Kleiner Anhänger.

CLEVER:
Dann bleibt der Sportage Hybrid
die stärkste Lösung.

╭────────────────────────────╮
│ Was ist Ihnen noch wichtig? │
│ ________________________  │
│ 🎤                     ➜  │
╰────────────────────────────╯
```

---

## Mapping auf die Engine

| Golden Conversation | Engine / Planner |
|---------------------|------------------|
| Memory Bar wächst | `mergeTextIntoNeedProfile` → `notepadLabels` |
| Fahrzeuge sichtbar | `recommendVehicles()` / `sellerReasoningEngine.js` |
| Eine Frage | `scoreQuestionImpact()` → `conversationPlanner.js` |
| Verkäufer-Copy | `buildSellerQuestionPrompt()` · `buildVehicleReactionMessage()` |
| Fahrzeug stirbt | Exclusion + `fadedItems` + `exclusionReason` |
| Abbruch | `shouldShowWishHandoffCta` / Handoff |

**Architektur-Regel:** Keine neuen Schreibpfade. Keine parallelen Wahrheiten. Golden Conversations sind **Referenz für Copy, Fragenreihenfolge und Beobachtung** — nicht für neue Datenmodelle.

---

## Definition of Done (Golden Conversations)

Ein Gespräch ist **golden**, wenn:

- [ ] Nach der ersten Aussage sind **Fahrzeuge sichtbar** (nicht erst nach Frage 3)
- [ ] Jede Antwort löst **sichtbare** Kartenbewegung aus
- [ ] Clever stellt **maximal eine** strukturierte Frage pro Turn
- [ ] Fragen verbessern die **Fahrzeugwahl** — nicht das Formular
- [ ] Memory Bar wächst und schrumpft **live**
- [ ] Ausgeschlossene Fahrzeuge bleiben mit **Erklärung** sichtbar
- [ ] Freie Eingabe ist **immer** offen
- [ ] *„Das reicht mir“* führt sauber zur Verkäuferübergabe

---

## Verboten vs. erlaubt

| ❌ Verboten | ✅ Erlaubt |
|------------|-----------|
| „Wie viele km fahren Sie?“ als Erstfrage bei „Was habt ihr an Elektro?“ | Nutzungskontext nach sichtbarer Fahrzeughypothese |
| EV2–EV9 aufzählen | Richtungsfrage: Familie / Ich / Zweitwagen |
| Mehrere Fragen gleichzeitig | Genau eine Impact-Frage |
| Formular-Schritte | ChatGPT-Metapher: Gespräch lebt |
| Fahrzeug ohne Erklärung entfernen | Faded + Begründung |
