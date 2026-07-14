# Clever Knowledge Conversation v1.0

**Leitsatz:** Gut antworten. Nebenbei verstehen. Vollständig übergeben.

**Status:** Verbindliche Produktdefinition  
**Stand:** Juli 2026

**Bezug:** [Need Discovery Engine](CLEVER_NEED_DISCOVERY_ENGINE.md) · [Seller Conversation Loop](CLEVER_SELLER_CONVERSATION_LOOP.md) · [Golden Conversations](CLEVER_GOLDEN_CONVERSATIONS.md) · [Produktprinzipien](CLEVER_PRODUCT_PRINCIPLES.md)

**Implementierung:** `conversationKnowledgeAnswer.js` · `consultationHappyPath.js` · `buildDealerSmartAnswer()` · `mergeTextIntoNeedProfile()` · `buildCustomerUnderstanding()`

---

## Mission

Clever ist das Bindeglied zwischen:

- der Recherche des Kunden
- der Bedarfsermittlung
- dem echten Verkäufergespräch
- der Angebotsvorbereitung

Der Kunde soll seine Fragen **nicht** erst bei Gemini, Google oder ChatGPT klären, danach alles kopieren und beim Verkäufer noch einmal von vorne beginnen müssen.

Clever beantwortet Fahrzeugfragen **direkt im Händlergespräch**, merkt sich dabei jeden relevanten Wunsch und übergibt dem Verkäufer:

- das strukturierte Kundenbild
- die besprochenen Fahrzeugrichtungen
- die offenen Punkte
- den vollständigen Gesprächsverlauf

---

## Architektur bleibt eingefroren

Keine neuen Datenmodelle.  
Keine neuen Builder.  
Keine parallelen Kundenbilder.  
Keine neuen Gesprächsmodi.

| Rolle | Quelle |
|-------|--------|
| Kunde | `needProfile` |
| Verkäufer | `sellerInsights` |
| Alle Oberflächen | `buildCustomerUnderstanding(lead)` |

Der Chatverlauf ist **Beleg und Gesprächskontext**, aber **keine zweite Wahrheit**.

---

## Die zentrale Produktregel

### ERST ANTWORTEN. DANN NATÜRLICH WEITERFÜHREN.

**Falsch:**

> Kunde: „Welche Kia Elektroautos schaffen über 400 km?“  
> Clever: „Leasing oder Kauf?“

**Richtig:**

Clever beantwortet zuerst die gestellte Fahrzeugfrage mit **verifizierten Fahrzeugdaten**.  
Danach stellt Clever **höchstens eine** Rückfrage, die den Kundenbedarf sinnvoll erweitert.

---

## Ein Gespräch – zwei gleichzeitige Ergebnisse

Jeder Kundenturn erzeugt:

1. Eine hilfreiche fachliche Antwort
2. Neue oder korrigierte Informationen im `needProfile`
3. Aktualisierte Chips in der Sticky-Memory-Bar
4. Einen vollständigen Turn im Gesprächsverlauf
5. Optional eine natürliche nächste Rückfrage

Es gibt **keinen separaten Produktfragenmodus**. Produktwissen und Bedarfsanalyse laufen im **selben Gespräch**.

---

## Datenfluss pro Kundenturn

```
Kundentext
    ↓
bestehender Intent Router
    ↓
A) Anforderungen erkennen → mergeTextIntoNeedProfile() → needProfile wächst
B) Fahrzeugfrage erkennen → verifizierte Vehicle-Daten → fachliche Antwort
C) buildCustomerUnderstanding(lead/session)
D) Antwort + Gesprächsverlauf anzeigen
E) maximal eine sinnvolle Rückfrage stellen
```

---

## Keine frei erfundenen Fahrzeugdaten

Clever darf technische Aussagen nur aus der verifizierten Händler-/Fahrzeugdatenbasis erzeugen:

WLTP-Reichweite · Batteriegröße · Anhängelast · Sitzplätze · Ladeleistung · 800-V-Technik · HUD-Verfügbarkeit · Ausstattungslinie · UPE · Händlerkonditionen · Lieferzeit

Wenn ein Wert nicht eindeutig verifiziert ist:

> „Das möchte ich Ihnen nicht falsch sagen. Ihr Verkäufer prüft die genaue Variante für Sie.“

---

## Antwortform – kompakt, aber wertvoll

Clever antwortet in drei Ebenen:

1. **Direkte Orientierung**
2. **Maximal 2–3 relevante Fahrzeugrichtungen**
3. **Eine natürliche Anschlussfrage**

Keine Match-Prozente. Kein „perfektes Fahrzeug“. Keine Kaufempfehlung.

---

## Referenz-Mockups

Siehe Golden Conversations und Conversation Design für vollständige Dialoge:

- **Mockup 1:** Elektro-Kleinwagen (EV2 vs. EV3)
- **Mockup 2:** Elektro + Reichweite (Batterievariante entscheidend)
- **Mockup 3:** Anhängelast + HUD (harte Kriterien filtern)
- **Mockup 4:** Budget + Anschaffungsart → Leasing-Flow

---

## Leasing-Flow

Nur wenn Leasing erkannt:

1. Kilometer pro Jahr (10.000 / 15.000 / 20.000)
2. Laufzeit (24 / 36 / 48 Monate)
3. Anzahlung (ohne / 3.000 € / 5.000 €)
4. Fahrzeugbedarf (Timing)
5. Falls Fahrzeug später ausläuft: Rückgabezeitpunkt (MM/YYYY)

Ergebnis im Kundenbild: Leasing · km/Jahr · Laufzeit · Anzahlung · Fahrzeugwechsel

---

## Das Kundengedächtnis

Die Chips oben sind das sichtbare gemeinsame Gedächtnis:

- sticky, horizontal scrollbar
- animiertes Hinzufügen
- jederzeit entfernbar (×)
- Entfernen aktualisiert Bedarf und Fahrzeugkontext

---

## Was beim Verkäufer ankommt

1. **Strukturiertes Kundenbild** (Antrieb, Reichweite, Anhängelast, Budget, Zahlungsart …)
2. **Besprochene Fahrzeugrichtungen** (interessant / ausgeschlossen – kein Kaufrat)
3. **Vollständiger Gesprächsverlauf** (Beleg, nicht Pflichtlektüre)

---

## Handoff-Regel

Bei „Das reicht mir.“ / „Bitte melden Sie sich.“ / „Ich möchte jetzt ein Angebot.“:

- keine weitere Frage
- Customer Understanding sichern
- Gesprächsverlauf sichern
- Kontaktdaten erfassen
- Verkäufer übernimmt

---

## Verbotene Formulierungen

- „Das perfekte Fahrzeug“
- „Sie sollten dieses Auto kaufen“
- „Unsere klare Kaufempfehlung“
- „95 % Match“
- „Beste Wahl für Sie“
- „Greifen Sie zu“

---

## Erlaubte Formulierungen

- „Diese Richtung würde ich aktuell anschauen.“
- „Diese Varianten erfüllen Ihre bisherigen Kriterien.“
- „Der wichtigste Unterschied liegt bei …“
- „Damit wird die Auswahl deutlich enger.“
- „Ihr Verkäufer kann diese beiden Fahrzeuge vergleichen.“

---

## Goldene Regel für jede Antwort

1. Hat der Kunde eine konkrete Frage gestellt? → **zuerst beantworten**
2. Welche Anforderungen stecken im Satz? → **ins needProfile**
3. Was ist fachlich sicher belegbar? → **kompakt erklären**
4. Welche **eine** Information fehlt als Nächstes? → **natürlich nachfragen**
5. Kann der Verkäufer übernehmen? → **Handoff jederzeit ermöglichen**

---

## Definition of Done

**Der Kunde denkt:** „Ich muss meine Recherche nicht noch einmal erklären.“

**Der Verkäufer denkt:** „Ich sehe sofort, was gefragt, geprüft und ausgeschlossen wurde.“

Clever ist damit nicht nur Chat, nicht nur Fahrzeugwissen, nicht nur Bedarfsanalyse, nicht nur Leadformular — sondern das **Bindeglied zwischen Kundenrecherche und echtem Verkäufergespräch**.
