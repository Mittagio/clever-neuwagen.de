# Clever v1.0 — UX Freeze & Beobachtungsphase

**Status:** Verbindlich ab Post-UX-Freeze  
**Stand:** Juli 2026  
**Bezug:** [Produktprinzipien](CLEVER_PRODUCT_PRINCIPLES.md) · [Conversation Design](clever-conversation-design.md) · [Clever Lead](CLEVER_LEAD.md)

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
