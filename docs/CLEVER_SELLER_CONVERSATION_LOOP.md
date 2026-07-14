# Clever Seller Conversation Loop v1.0

**Status:** Verbindlich für Copy, Fragenlogik und UI-Dramaturgie  
**Stand:** Juli 2026  
**Leitsatz:** *Nicht fragen wie ein Formular. Denken wie ein Verkäufer.*

**Bezug:** [Need Discovery Engine](CLEVER_NEED_DISCOVERY_ENGINE.md) · [Golden Conversations](CLEVER_GOLDEN_CONVERSATIONS.md) · [Beobachtungsphase](CLEVER_V1_OBSERVATION_PHASE.md)

**Implementierung (read-only Engine, bestehende Schreibpfade):**  
`sellerReasoningEngine.js` · `conversationPlanner.js` · `consultationHappyPath.js`

---

## Der Loop

Nach jeder Kundeneingabe:

```
1. Verstehen          → needProfile / Memory Bar
2. Laut denken        → Hypothese-Turn + Fahrzeugkarten (Kontext)
3. Größte Unsicherheit → scoreQuestionImpact()
4. Genau eine Frage   → pendingQuestion (ohne Hypothese im selben Turn)
5. Wieder verstehen   → Antwort → Reaktion → zurück zu 2
```

**Nicht:** Frage → Antwort → Frage → Antwort (Formular)

**Sondern:** Verstehen → Denken → Eine Unsicherheit auflösen → Weiterdenken

---

## Trennung: Denken vs. Fragen

| Turn | Inhalt | Beispiel |
|------|--------|----------|
| **Reaktion** (`reactionOnly`) | Lautes Denken | „Verstanden. Mit 1.500 kg Anhängelast würde ich aktuell eher Richtung Sportage Hybrid schauen.“ |
| **Frage** (Chips) | Nur Unsicherheit | „Was möchten Sie hauptsächlich ziehen?“ |
| **Panel** | Fahrzeuge als Kontext | Match-%, faded mit Begründung |

Hypothese und Frage **nie** in einem Clever-Block vermischen.

---

## Zeitbedarf / Lieferzeit

**Nicht:** „Wann endet Ihr Leasingvertrag?“

**Sondern:** „Wann benötigen Sie Ihr neues Fahrzeug ungefähr?“

Follow-up bei „läuft später aus“: „Wann geben Sie Ihr aktuelles Fahrzeug ungefähr zurück?“ (MM/YYYY-Chips)

Speicherung ohne neues Datenmodell:

- `consultationProfile.answers.vehicleNeedTiming`
- `consultationProfile.answers.vehicleReturnDate`
- `needProfile.timelineLabel` (z. B. „Fahrzeugwechsel Oktober 2026“)

---

## Verbotene vs. erlaubte Sprache

| ❌ Verboten | ✅ Erlaubt |
|------------|-----------|
| Das perfekte Fahrzeug | Diese Fahrzeuge würden aktuell zu Ihren Angaben passen |
| Sie sollten kaufen | Diese Richtung würde ich momentan anschauen |
| Beste Wahl | Der Sportage Hybrid bleibt aktuell die stärkere Lösung |
| Passt zu 100 % | Diese Modelle werden gerade wahrscheinlicher |

Filter: `sanitizeNeedDiscoveryCopy()` in `sellerReasoningEngine.js`

---

## Erfolg

**Kunde:** „Die haben verstanden, was ich suche.“  
**Verkäufer:** „Ich kenne den Kunden bereits, bevor ich anrufe.“
