# Clever Dual Input / Single State

**Status:** FREEZE – projektweite UX-Regel für alle Seller-Entscheidungen  
**Stand:** September 2026  

**Kein Feature-Auftrag.** Dauerhafte Produkt-/UX-Regel.

**Cursor-Rule:** `.cursor/rules/clever-dual-input-single-state.mdc`  
**Übergeordnet:** [CLEVER_UX_MANIFEST_V1.md](CLEVER_UX_MANIFEST_V1.md)

---

## Produktsatz

> Klicken wenn schnell. Sprechen wenn schneller.  
> Immer: eine Wahrheit · ein State · ein Flow.

## Prinzip

Wenn ein Verkäufer dieselbe Entscheidung sowohl

**A)** per Klick / Choice / Popover  
**B)** per Composer / Sprache / Freitext  

treffen kann, dürfen daraus **niemals zwei parallele Zustände** entstehen.

```
2 Inputs  →  1 gemeinsamer State  →  1 Wahrheit
```

Kein paralleles Datenmodell. Kein zweiter Fact. Kein zweiter Draft. Keine parallele Wahrheit.

---

## UI-Hierarchie

Für eindeutige, bekannte, katalogbasierte Auswahlwerte:

**Primary Interaction:** direkte Choice-UI  
**Secondary:** Composer (immer erlaubt)

### Choice-UI bevorzugt

- kompakte Chips  
- Popover / Sheet  
- kleine Karten  
- Swatches  
- Quick Choices  

### Nicht bevorzugt

- klassische Dropdowns / `<select>` als Default  
- große Formulare  
- Tabellen  
- technische Catalog-IDs sichtbar  

### Typische Felder

Farbe · Laufzeit · Kilometer · Anzahlung · Ausstattung · Zahlungsart · Modell / Trim · Paket · Terminoptionen

---

## Composer = zweiter Eingang

Der Verkäufer darf jederzeit schreiben oder diktieren, z. B.:

- „schwarz“ / „magma rot“  
- „48 Monate“ / „15.000 km“  
- „ohne Anzahlung“  
- „Earth“ / „AHK raus“  

Composer interpretiert und aktualisiert **denselben State** wie die Choice-UI.

| Aktion | Erwartung |
|--------|-----------|
| Klick oben | Composer braucht **keine** Extra-Bestätigung; kein zweiter offener Zustand unten |
| Composer-Eingabe | Choice-UI oben aktualisiert sich **sofort** |

Persistente Hinweise wie „bitte im Composer ergänzen“ sind **verboten**, wenn eine direkte Choice möglich ist.

---

## Authority

Wenn Katalogdaten existieren:

1. Direct Choices kommen aus dem Katalog (Modell / Trim / ggf. Jahr).  
2. Composer darf freie Sprache verstehen.  
3. Finaler strukturierter Wert wird gegen Katalog / bestehende Authority geprüft.

Beispiel: `magma rot` → Kandidat → Magma-Rot Metallic → Catalog Validation → **derselbe** Color-State.

---

## Unsicherheit

Nicht eindeutig → **nur lokal** offen:

- Farbe prüfen  
- Paket prüfen  
- Variante prüfen  

Nicht: globales Review · ganzen Draft blockieren · Fact-Wall.

Partial Success bleibt: sichere Werte durch; nur der unsichere Slot lokal.

---

## Visuelle Regel

Eine offene Einzelentscheidung darf **nicht größer wirken** als der Verkaufsprozess.

| Gut | Schlecht |
|-----|----------|
| `Farbe · noch offen` + kompakter Chip / Popover | große beige Review-Box + Extra-Hinweis + Composer-Hinweis + zweiter Button |

Haupt-CTA (`determineNextBestSellerAction`) bleibt dominant. Choice-Controls konkurrieren nicht visuell mit der Primary.

---

## Geltungsbereich

Alle relevanten Seller-Flows, u. a.:

- Kundenakte · Offer Preparation / Review · Multi-Offer · Vehicle Identity  
- Inzahlungnahme · Kundenwissen · Change Requests · Calculator Handoff  
- Dokumente · Termin- / Follow-up-Flows · Global Composer / Intake  

Cross: Working-Draft-Core, Offer Vehicle Identity, Capture-then-Offer, Zero-Loss, Intake Presenter V1 – **keine** zweite State-Maschine „für Dual Input“.

---

## Cursor-Entscheidungsregel

Vor jeder Seller-UX-Entscheidung:

1. Wert endlich / katalogbasiert / schnell klickbar? → direkte Choice anbieten  
2. Kann der Verkäufer denselben Wert frei sagen/schreiben? → Composer muss denselben State aktualisieren  
3. Zwei Wahrheiten danach? → falsch, vereinheitlichen  
4. Unsicherheit lokal? → lokal lösen  
5. Kleine Entscheidung größer als Hauptprozess? → UI komprimieren  

---

## Anti-Patterns

- Choice-State **plus** separaten Composer-State  
- Formular oben + AI unten mit unterschiedlichen Wahrheiten  
- doppelte Speicherung / doppelte Bestätigung  
- „bitte im Composer ergänzen“ trotz vorhandener Choice  
- große Review-Boxen für kleine lokale Entscheidungen  
- neue parallele Datenmodelle  

---

## Code-Bezug (Beispiele, keine zweite Engine)

- Vehicle Identity / Farbe: `offerVehicleIdentity.js`, `applyOfferIdentityChoice.js`, `DealerAiOfferPreview.jsx`, `SellerUniversalReviewCard.jsx`  
- Offer Draft Continuity: `cleverWorkingDraft.js`, `vehicleIdentityDraft.js`  

---

*Geschrieben als dauerhafte Dual-Input-Regel – Spezialfälle (z. B. Farbe) unterliegen derselben Wahrheit.*
