# Sprint 34 – Die letzten 10 % vor dem MVP

## Ziel

Keine neuen großen Funktionen mehr.

Keine neuen Module mehr.

Keine weiteren Hersteller.

Keine weitere Komplexität.

Die nächsten 10 % entscheiden darüber, ob Clever-Neuwagen als Spielerei wahrgenommen wird oder als echtes Verkaufstool.

Ab jetzt geht es um:

- Vertrauen
- Datenqualität
- Logik
- Geschwindigkeit
- Verständlichkeit

**Merksatz:** Die ersten 90 % waren Ideen. Die letzten 10 % sind Vertrauen. Nicht mehr Funktionen bauen – die vorhandenen Funktionen perfekt machen. Wenn der Kunde der CleverQuote vertraut, vertraut er der gesamten Plattform.

---

## Regel Nr. 1 – Clever-Neuwagen darf niemals falsch liegen

Lieber **„Nicht verfügbar“** als **„Falsche Information“**.

Wenn Ausstattung unbekannt, Paket unklar oder Modelljahr fehlt → anzeigen:

> **Derzeit nicht sicher verfügbar**

statt raten.

**Vertrauen geht vor.**

| Repo-Bezug | Datei / Modul |
|------------|----------------|
| Verfügbarkeits-Chip | `src/data/dealerConditionsSchema.js` (`nicht_verfuegbar`) |
| Feature-Auflösung | `src/services/configurator/wishPackageResolver.js` |
| CleverQuote | `src/services/cleverQuote/cleverQuoteService.js` |

**Gap:** Unbekannte Features dürfen nicht in den Score einfließen; UI braucht expliziten „Unklar“-Status.

---

## Regel Nr. 2 – CleverQuote muss erklärbar sein

Jede CleverQuote benötigt einen Block **„Warum?“**

Beispiel:

```
CleverQuote 92 %

Erfüllt:
✓ Sitzheizung
✓ Rückfahrkamera
✓ Wärmepumpe
✓ Reichweite
✓ Budget

Nicht erfüllt:
✗ Panorama
✗ Anhängerkupplung
```

Der Kunde muss verstehen: **Warum 92 %?**

| Repo-Bezug | Datei / Modul |
|------------|----------------|
| Berechnung | `src/services/cleverQuote/cleverQuoteService.js` |
| Badge | `src/components/cleverQuote/CleverQuoteBadge.jsx` |
| Breakdown (teilweise) | Detailseite / Paket-Empfehlung (Sprint 30) |

**Gap:** Verkaufs-Podium zeigt nur erfüllte Labels (max. 5), kein vollständiges ✓/✗-Panel.

---

## Regel Nr. 3 – Nicht mehr Fahrzeuge anzeigen

Weniger ist mehr.

Nicht: **37 Treffer**

Sondern:

### Beste Treffer

🥇 EV3 Earth – 96 %  
🥈 EV4 Earth – 91 %  
🥉 Sportage Vision – 88 %

Mehr Fahrzeuge: Button **[Weitere passende Fahrzeuge]**

| Repo-Bezug | Datei / Modul |
|------------|----------------|
| Verkaufs-Podium | `src/components/sales-advisor/SalesResultsPodium.jsx` |
| Discovery (Referenz) | `src/components/discovery/DiscoveryResultsView.jsx` |

**Gap:** Podium listiert derzeit alle Matches; Top-3 + Ausklapp-Rest fehlt im Verkaufsmodus.

---

## Regel Nr. 4 – Ergebnisse erklären

Jedes Fahrzeug bekommt:

### Warum empfehlen wir dieses Fahrzeug?

Beispiel:

- ✓ Beste Reichweite im Budget
- ✓ Wärmepumpe verfügbar
- ✓ 3 Händler im Umkreis
- ✓ Erfüllt 12 von 13 Wünschen
- ✓ Bestes Preis-Leistungs-Verhältnis

Nicht nur Daten. Sondern **Begründung**.

**Gap:** Strukturierter „Warum“-Block fehlt; nur CleverQuote-Items + Rate.

---

## Regel Nr. 5 – Händler dürfen nie wichtiger sein als Fahrzeuge

Suchergebnis-Reihenfolge:

1. Fahrzeug  
2. CleverQuote  
3. Preis  
4. Händler  

Der Kunde sucht ein Auto. Nicht ein Autohaus.

| Repo-Bezug | Prüfen in |
|------------|-----------|
| Podium / Karten | `SalesResultsPodium.jsx`, `DiscoveryHeroCard.jsx` |
| Detail | `HeroOffer.jsx`, `VehicleDetailHero.jsx` |

---

## Regel Nr. 6 – Zahlungsart überall identisch

Wenn Kauf → Kaufpreis. Wenn Leasing → Leasing. Wenn Finanzierung → Finanzierung.

Nie mischen. Nie umrechnen. Nie mehrere Hauptpreise gleichzeitig.

**Ein Preis. Eine Wahrheit.**

| Repo-Bezug | Sprint / Modul |
|------------|----------------|
| Sprint 28 | Detailseite Pricing-Konsistenz |
| Resolver | `src/services/pricing/pricingResolver.js` |

**Stand:** grundsätzlich umgesetzt – bei jeder UI-Änderung erneut prüfen.

---

## Regel Nr. 7 – Wunschlogik perfektionieren

Vor KI. Vor Sprache. Vor WhatsApp.

Prüfen: Klickt Kunde **360° Kamera** → Paket gefunden → Preis berechnet → CleverQuote aktualisiert. **Fehlerfrei.**

Das ist die Kernfunktion.

| Repo-Bezug | Datei / Modul |
|------------|----------------|
| Wunsch-Chips | `src/data/salesAdvisorChips.js` |
| Auflösung | `wishPackageResolver.js`, `wishMagicService.js` |
| Tests | `npm run test:wish-magic`, `npm run test:clever-quote` |

**Gap:** Harte Testmatrix pro Chip (Sitzheizung, 360°, Wärmepumpe, …) für Kia Registry-Modelle.

---

## Regel Nr. 8 – Geschwindigkeit

Ziel:

- Suchergebnis **unter 2 Sekunden**
- CleverQuote **unter 1 Sekunde**
- Ausstattungsprüfung **sofort**

Wenn das System langsam wirkt, verliert es Vertrauen.

**Gap:** Kein messbares Performance-Budget im Repo; bei Phase C einführen.

---

## Regel Nr. 9 – Verkäufermodus testen

Nicht entwickeln. **Testen.**

Mit Mike, Corrado, 2–3 Kollegen – **10 echte Beratungen**.

Fragen:

- Versteht der Kunde die CleverQuote?
- Versteht der Kunde die Wünsche?
- Versteht der Kunde die Empfehlung?
- Versteht der Kunde den Unterschied zwischen EV3 und EV4?

Wenn nein → UI vereinfachen. **Nicht** neue Features bauen.

| Route | Pfad |
|-------|------|
| Smart Sales | `/sales/smart` |
| Gesprächsmodus | `/gespraech` |
| Klassisch | `/sales` |

---

## Regel Nr. 10 – Die wichtigste Frage der gesamten Plattform

Bei jedem Bildschirm fragen:

> Kann ein Kunde nach 10 Sekunden beantworten: **„Warum wird mir dieses Fahrzeug empfohlen?“**

Wenn nein → Bildschirm überarbeiten.

---

## MVP-Checkliste (vor Go-Live)

| Element | Status (Stand Sprint 33) |
|---------|---------------------------|
| Kia Datenbank | ✓ PDF + Registry (Sportage, EV3) |
| Feature Library | ✓ `featureCatalog.js`, Partner Hub |
| Serienausstattung | ✓ Registry / Sportage |
| Paketlogik | ✓ Sportage, EV3 |
| CleverQuote | ✓ Service + Badge |
| Preislogik | ✓ Pricing Resolver |
| Vergleich | ✓ Sales Compare |
| Händlerangebote | ✓ Marketplace + Dealer |
| Warum empfehlen wir? | ✓ Podium + Detail (Sprint 34) |
| Verkäufermodus | ✓ Smart Sales / Gespräch |
| Go-Live-Tests (10×) | ○ Phase D – Protokoll bereit |

---

## Vorerst NICHT bauen

- 20 Hersteller
- Sprachsteuerung
- CRM / Kalender
- komplexe KI-Agenten
- automatische Nachfassprozesse
- Marketing-Automatisierung
- Social-Media-Funktionen
- Gamification

---

## Das MVP-Ziel (Referenz-Szenario)

Ein Verkäufer sitzt mit einem Kunden.

Der Kunde sagt:

> „Ich suche ein Elektroauto bis 400 € mit Sitzheizung und Kamera.“

Der Verkäufer klickt wenige Chips.

Clever-Neuwagen zeigt:

```
🥇 EV3 Earth
96 %
328 €/Monat

Warum?
✓ erfüllt alle wichtigen Wünsche
✓ beste Reichweite
✓ Wärmepumpe verfügbar
✓ Händler in Ihrer Nähe
```

Der Kunde versteht die Empfehlung **sofort**.

Wenn das funktioniert, ist das MVP erfolgreich.

---

## Umsetzungsplan (nur Verfeinerung)

### Phase A – Vertrauen (Regeln 1, 2, 4)

- Unbekannte Features → „Derzeit nicht sicher verfügbar“, nicht scoren
- CleverQuote-Panel: Erfüllt / Nicht erfüllt / Unklar
- Block „Warum empfehlen wir …?“ (fest definierte Bullet-Typen)

### Phase B – Ergebnisse (Regeln 3, 5, 10)

- Verkaufsmodus: Top 3 + „Weitere passende Fahrzeuge“
- Layout: Fahrzeug → CleverQuote → Preis → Händler
- 10-Sekunden-Check pro Screen

### Phase C – Kernfunktion (Regeln 7, 8)

- Testmatrix Wunsch-Chips (Kia Registry)
- Performance-Budget messen

### Phase D – Go-Live (Regel 9)

- 10 Beratungen mit Verkäufern – nur UI vereinfachen
- **Kein neuer Code** während der Tests – nur dokumentieren und bei klarem Nein UI straffen

#### Vorbereitung (erledigt in Sprint 34)

- Podium: Top 3, max. 3 „Warum?“-Bullets, CleverQuote-Details nur im Modal
- Detail: ein Preis (Leasing), Händler zuletzt
- Ergebnis-Screen: nur Kundenname, kein Partner-Bar-Rauschen

#### Beratungsprotokoll (10× ausfüllen)

| # | Datum | Verkäufer | Kunde (Anonym) | Route | Szenario |
|---|-------|-----------|----------------|-------|----------|
| 1 | | | | `/sales/smart` | Elektro + Budget + Sitzheizung |
| 2 | | | | `/sales/smart` | SUV + 360° + Anhänger |
| 3 | | | | `/gespraech` | Freitext / Sprache |
| 4 | | | | `/sales/smart` | Familie + Panorama |
| 5 | | | | `/sales` | Klassischer Flow |
| 6–10 | | | | beliebig | Realer Kundenfall |

**Nach jeder Beratung – 4 Fragen (Ja/Nein):**

1. Versteht der Kunde die **CleverQuote** (% und Farbe)?
2. Versteht der Kunde seine **Wünsche** (Chips / Zusammenfassung)?
3. Versteht der Kunde die **Empfehlung** („Warum dieses Auto?“)?
4. **10-Sekunden-Test:** Kann der Kunde sagen, warum Platz 1 empfohlen wird?

**Bewertung:**

| Antworten Ja | Aktion |
|--------------|--------|
| 4/4 | ✓ Sitzung grün – nichts ändern |
| 3/4 | Notiz: welches Feld? → UI-Text kürzen |
| ≤2/4 | Screen stoppen – nur vereinfachen, keine Features |

**Referenz-Szenario (Pflicht-Test #1):**

Chips: Elektro · Sitzheizung · 360° Kamera · bis 400 € · SUV  
Erwartung: 🥇 mit CleverQuote, 3 „Warum?“-Punkte, ein Preis, Händler unten.

#### UI-Vereinfachungs-Backlog (nur bei Nein)

| Screen | Typische Reibung | Vereinfachung |
|--------|------------------|---------------|
| Ergebnisse | Zu viele Panels | Nur „Warum?“ + Badge (Modal für Details) |
| Detail | Drei Preise | Ein Preis je Zahlungsart |
| Wünsche | Zu viele Chips | Gruppe einklappen (später) |
| Sidebar | Ablenkung | Kommunikation erst nach Angebot |

**Fokus-Flow:** Verkaufsmodus `/sales/smart` + CleverQuote + Podium – nicht parallel Discover/CRM erweitern.

---

## Tests (Sprint 34)

```bash
npm run test:clever-quote
npm run test:wish-magic
npm run test:smart-sales
npm run test:kia-partner
npm run deploy:check
```

---

## Abhängigkeit

Baut auf **Sprint 33 (Kia Blaupause)** und **Sprint 30 (CleverQuote)** auf. Keine neuen Hersteller bis MVP-Szenario grün ist.
