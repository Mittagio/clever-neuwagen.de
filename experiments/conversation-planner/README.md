# Conversation Planner – Architektur-Spezifikation

**Status:** Experiment · noch nicht im Produkt  
**Stand:** Juli 2026  
**Bezug:** [Clever Manifest](../../docs/CLEVER_MANIFEST.md) · [Conversation Design](../../docs/clever-conversation-design.md) · [Experiments](../README.md)

---

## 1. Warum brauchen wir den Conversation Planner?

Beim Testen mit echten Menschen ist ein Architekturfehler sichtbar geworden:

**Kunde:**

> „SUV Benzin Automatik bis 40.000 € Allrad“

**Clever erkennt korrekt:** Verbrenner · SUV · Kauf · (optional Allrad)

**Clever fragt trotzdem:** *„Und können Sie zu Hause laden – Garage oder Wallbox?“*

Das ist kein Copy-Problem. Kein UI-Bug. **Ein Logikfehler.**

Ein guter Verkäufer würde einem Benziner-Kunden niemals nach Wallbox, DC-Laden oder Wärmepumpe fragen. Unsere Conversation ist aktuell noch nicht **intent-aware** genug: Fragen werden über feste Reihenfolgen oder unvollständige `skipIf`-Regeln gesteuert — nicht über den Kundenkontext.

**Dieser Testfall darf nie wieder passieren:**

```
„SUV Benzin Automatik bis 40.000 € Allrad“
  → niemals Wallbox / Laden zuhause / Batterie / V2L
```

Das ist der Auslöser für den Conversation Planner.

---

## 2. Ziel

Der **Conversation Planner** entscheidet, **welche Frage jetzt sinnvoll ist**.

| Entscheidet **nicht** | Entscheidet **der Planner** |
|----------------------|----------------------------|
| Die UI | Welche Frage als Nächstes kommt |
| Der Happy Path (hardcoded Sequence) | Ob eine Frage überhaupt erlaubt ist |
| Hart codierte Reihenfolgen | In welcher Priorität Kandidaten stehen |

**Eingabe:** NeedProfile · bereits beantwortete Fragen · aktive Welt (1/2) · optional gewähltes Modell

**Ausgabe:** genau **eine** Frage — oder `null`, wenn genug bekannt ist für den nächsten Schritt (z. B. Empfehlung).

Der Nutzer soll nie das Gefühl haben: *„Warum fragt mich mein Berater das?"*

---

## 3. Abgrenzung

Der Planner ist bewusst **schmal** gehalten.

| Der Planner … | Der Planner … **nicht** |
|---------------|-------------------------|
| Entscheidet, welche Frage jetzt gestellt werden darf | Empfiehlt keine Fahrzeuge |
| Filtert und priorisiert Fragen aus dem Katalog | Erstellt keine Leads |
| Liest NeedProfile und Antworten | Ersetzt nicht den Parser (`searchIntentParser` / `mergeTextIntoNeedProfile`) |
| Gibt eine Begründung für Debug/Tests (`reason`) | Steuert nicht Journey, Portal oder Angebot (Welt 3) |

**Recommendation Engine** und **Journey Engine** bleiben separate Systeme. Der Planner füttert sie indirekt — indem er sicherstellt, dass die richtigen Fragen gestellt wurden, bevor eine Empfehlung sinnvoll ist.

---

## 4. Prinzip: Jede Frage bekommt Bedingungen

Fragen werden **deklarativ** beschrieben — nicht als verstreute `if`-Ketten in Happy Path, Sales Advisor oder UI.

Jede Frage im Katalog trägt:

| Feld | Bedeutung |
|------|-----------|
| `id` | Eindeutige Frage-ID |
| `world` | `need_consultation` (Welt 1) oder `vehicle_consultation` (Welt 2) |
| `visibleWhen` | Frage ist **erlaubt**, wenn Bedingungen erfüllt sind |
| `hiddenWhen` | Frage ist **ausgeschlossen**, auch wenn `visibleWhen` passen würde (harte Sperre) |
| `priority` | `high` · `medium` · `low` — für Reihenfolge unter den Kandidaten |
| `reason` | Menschlich lesbare Begründung (Debug, Tests, später Verkäufer-Akte) |

**Auswertung:**

1. Alle Fragen der aktiven Welt laden
2. `hiddenWhen` prüfen → ausschließen
3. `visibleWhen` prüfen → Kandidaten
4. Bereits bekannte Felder überspringen (Parser oder Antwort)
5. Nach `priority` sortieren
6. **Eine** Frage zurückgeben

Keine Fragenliste. Kein Wizard. Eine Frage pro Turn — wie im Manifest.

---

## 5. Beispiele

### `home_charging`

```yaml
id: home_charging
world: need_consultation
visibleWhen:
  fuel: [electric, phev]
hiddenWhen:
  fuel: [combustion, verbrenner, diesel]
priority: high
reason: "Laden zuhause ist nur bei Elektro und Plug-in-Hybrid relevant."
```

### `heat_pump`

```yaml
id: heat_pump
world: vehicle_consultation
visibleWhen:
  fuel: [electric]
  selectedModel: [ev3, ev4, ev4-fastback, ev5, ev6, ev9]
hiddenWhen:
  fuel: [combustion, verbrenner, diesel]
priority: medium
reason: "Wärmepumpe betrifft Elektro-Fahrzeuge, nicht Verbrenner."
```

### `allrad`

```yaml
id: allrad
world: need_consultation
visibleWhen:
  any:
    - bodyType: [suv]
    - towing: [light, braked, heavy]
    - priorities: [awd, winter]
    - drive: unknown
hiddenWhen:
  drive: [fwd, rwd]  # bereits geklärt: kein Allrad gewünscht
priority: medium
reason: "Allrad-Nachfrage bei SUV, Anhänger, Winter oder noch unklarem Antrieb."
```

### `fuel_type`

```yaml
id: fuel_type
world: need_consultation
visibleWhen:
  fuel: unknown
priority: high
reason: "Ohne Antrieb können wir keine sinnvollen Folgefragen stellen."
prompt: "Haben Sie beim Antrieb schon einen Favoriten – Benzin, Hybrid oder Elektro?"
```

### Weitere Sperren (global, nicht fragenbezogen)

Bei **Verbrenner** niemals fragen:

- Wallbox / Laden zuhause
- DC-Laden / AC-Laden
- V2L
- Batteriekapazität
- Wärmepumpe (Welt 1; in Welt 2 nur bei EV)

Bei **Verbrenner** eher fragen:

- Komfort vs. Sportlichkeit
- Allrad-Nutzung (Anhänger, Schnee)
- Kofferraum
- Langstrecke (ohne „Reichweite km“-Sprache)

---

## 6. Recommendation Readiness

Eine **Fahrzeugempfehlung** darf erst kommen, wenn entscheidende Kaufparameter bekannt sind.

Der Planner arbeitet mit einer **Readiness-Prüfung** (separates Konzept, vom Planner ausgelöst):

| Bedingung | Konsequenz |
|-----------|------------|
| Antrieb unbekannt | **Keine Empfehlung** → stattdessen `fuel_type` fragen |
| Antrieb = Verbrenner, nur EV-Modelle im Bundle | **Keine EV-Empfehlung** → Verbrenner-Richtung oder Modellklärung |
| Budget unbekannt bei Leasing-Wunsch | Budget-Frage vor Empfehlung |
| Genug Kontext für Richtung | Empfehlung freigeben |

**Beispiel — nicht erlaubt:**

```
Kunde: „Sportage Familie 2 Kinder AHK“
→ Antrieb unklar
→ KEINE EV3-Empfehlung
→ stattdessen: „Haben Sie beim Antrieb schon einen Favoriten – Benzin, Hybrid oder Elektro?“
```

**Beispiel — erlaubt:**

```
Kunde: „Elektroauto für zwei Kinder bis 350 €“
→ Antrieb klar · Familie · Budget
→ Langstrecke / Laden sinnvoll
→ danach Empfehlung (z. B. EV3-Richtung)
```

Recommendation Readiness ist **kein eigener Planner** — aber der Planner muss wissen, wann keine Frage mehr nötig ist und der Recommendation-Schritt folgen darf.

---

## 7. Testfälle

Diese Fälle werden **vor** Produktivnahme als Tests definiert (Unit-Tests am Planner-Service, nicht am UI).

| # | Eingabe / Kontext | Erwartung |
|---|-------------------|-----------|
| 1 | Benziner-SUV-Kauf · „SUV Benzin bis 40.000 € Allrad“ | **Keine** Ladefrage · **Keine** Wallbox · **Keine** Wärmepumpe (Welt 1) |
| 2 | „Sportage Familie 2 Kinder AHK“ · Antrieb unbekannt | **Erst** Antrieb klären · **Keine** EV3-Empfehlung |
| 3 | „Elektro Familie Budget 350 €“ | Ladefrage **erlaubt** · Langstrecke **erlaubt** |
| 4 | EV3 gewählt (Welt 2) · Elektro | Wärmepumpe **erlaubt** |
| 5 | Sportage Benzin gewählt / Verbrenner-Kontext | Wärmepumpe **nicht erlaubt** |
| 6 | Nach Langstrecke-Antwort bei Verbrenner | Label **nicht** „Reichweite wichtig“ (Parser/Label-Kontext) |
| 7 | `fuel_type` beantwortet mit „Benzin“ | Folgefragen: Kofferraum / Allrad — **nicht** Laden |

**Negativ-Test (Regression):**

```
planNextQuestion({ fuel: 'verbrenner', bodyType: 'suv', paymentType: 'cash' })
  → result.question.id !== 'home_charging'
  → result.question.id !== 'chargingAtHome'
```

---

## 8. Migrationsplan

**Kein Big Bang.** Schrittweise, tests-first.

| Phase | Was | Status |
|-------|-----|--------|
| **1** | Spec (dieses Dokument) | Erledigt |
| **2** | `conversationPlanner.js` — Condition Engine + `planNextQuestion()` | Ausstehend |
| **3** | Fragenkatalog erweitern (`visibleWhen`, `hiddenWhen`, `priority`, `reason`) | Ausstehend |
| **4** | Happy Path umstellen — `HAPPY_PATH_QUESTION_SEQUENCE` entfernen | Ausstehend |
| **5** | Sales Advisor umstellen — `getNextConsultationQuestion` delegiert an Planner | Ausstehend |
| **6** | Recommendation Readiness anbinden — keine Empfehlung ohne Antrieb | Ausstehend |
| **7** | Parser-Fixes parallel (Allrad, Benziner-Labels, Reichweite nur bei Elektro) | Ausstehend |

**Regel während Migration:**

> Solange Phase 4–5 nicht abgeschlossen sind, gilt für `/beratung`: **nicht erweitern** — nur testen. Der Planner kommt aus dem Experiment-Ordner ins Produkt, wenn Testfälle 1–7 grün sind.

---

## Leitsatz

> Jedes Element, das den Gesprächsfluss unterbricht, muss verschwinden oder in die Sticky-Notiz integriert werden.

Der Conversation Planner sorgt dafür, dass **auch die Fragen** den Gesprächsfluss nicht unterbrechen — weil jede Frage zum Kunden passt.

---

*Experiment — nicht im Produktcode. Erst testen, dann entscheiden.*
