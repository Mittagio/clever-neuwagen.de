# Clever Offer · Vehicle Identity Freeze

**Status:** Verbindlicher Produkt-Freeze  
**Stand:** September 2026  
**Scope:** Gehirn + Manager (+ gezieltes „Angebot prüfen“ Identity-Wiring). Kein Carwow-Konfigurator.

## Produktsatz

> Clever = sagen/klicken → Clever konfiguriert → Angebot.  
> Kein stilles Default-Modell. Jedes Angebot hat eine eindeutige Fahrzeugspur.

## Verbindliche Regeln

### 1. Kein stilles Default-Modell

„EV Angebot“ oder Chip **Angebot** bedeutet **nicht** still EV3 Earth (oder Picanto/GT-Line).

- Ohne klares Ziel-Fahrzeug: nachfragen oder aktiven Track nutzen.
- Magic-/Lexikon-Default-Trim (z. B. Earth) darf die Seller-Absicht nicht ersetzen.

### 2. Jedes Angebot hat `vehicleTrackId`

Jedes vorbereitete/geöffnete Angebot hängt an genau einer Fahrzeugspur (`vehicleTrackId` / `vehicleCardId`). Kein „freischwebendes“ Angebots-Fahrzeug ohne Spur-Bezug, wenn Spuren existieren.

### 3. Fahrzeugidentität ≠ Konditionen

| Ebene | Felder |
|-------|--------|
| **Fahrzeugidentität** | Modell · Linie/Variante · Farbe (+ relevante Optionen) |
| **Konditionen** | Zahlungsart · Laufzeit · km · Anzahlung · Rate |

Beide Ebenen sind getrennt editierbar. Identity-Edits ersetzen keinen Carwow-Stepper.

### 4. Klick und Composer → derselbe State

Composer-Facts und UI-Edits (Angebot prüfen) schreiben denselben Offer-/Track-State. Session-Memory: Folge „schwarz“ bezieht sich auf das aktuelle Angebotsfahrzeug.

### 5. Fahrzeugwechsel vs. Alternative

| Seller-Absicht | Verhalten |
|----------------|-----------|
| „noch einen EV2“ / zusätzliches Angebot | **neue** Spur / neues Angebot |
| „änder EV3 auf Air“ / „Mach Earth zu Air“ / „Doch EV2 Earth“ | **bestehendes** Angebot/Track |

Kein stilles Überschreiben eines alten Angebots, wenn eine zweite Alternative gemeint ist.

### 6. OpenAI interpretiert, Clever validiert

OpenAI/Interpret liefert Intent (Modell, Trim, Farbe, Mutation). Clever validiert gegen Lexikon/Records wo vorhanden; sonst Uncertainty / Review – kein Erfinden.

## Angebots-Cue-Auflösung

Wenn der Verkäufer „Angebot“ / „EV Angebot“ sagt oder den Angebot-Chip nutzt:

1. **Explizites Modell** im Text/Facts → dieses Modell (ggf. neue Spur bei „noch einen …“).
2. **Offenes Angebot / Working Context** → dieses Angebot (`vehicleTrackId`).
3. **Ein klar aktiver Track** (Fokus / ACTIVE / FAVORITE) → dieser Track.
4. **Mehrere Spuren ohne klaren Fokus** → Clarification: „Für welches Fahrzeug?“ mit Track-Choices — **kein stilles Raten**.
5. **Keine Spur, kein Modell** → Clarification: welches Modell?

## Composer am offenen Angebot

Kurzformen wie „schwarz.“, „Air.“, „Mach Earth zu Air.“, „Doch EV2 Earth.“ ändern **dieses** Angebot/Track (Working Context), nicht wild die ganze Akte.

## UI (Angebot prüfen)

Oben: **drei Fact-Chips** (Modell · Linie · Farbe) – **kein Freitext als Default**.

- Klick öffnet Popover mit gültigen Choices (Lexikon/Records; sonst sinnvolle Fallback-Listen).
- Farbe inkl. kleinem Swatch.
- Composer parallel („Air schwarz“) schreibt **denselben** Offer-/Track-State.
- Kein Hilfetext „Klicken zum Bearbeiten…“.
- Bei Identity-Wechsel: Rate als **stale** („Rate prüfen“ / „Fahrzeug wurde geändert“) – **keine** erfundene Neuberechnung; erst PDF/Bank/manuelle Rate setzt belastbare Rate wieder.

Darunter getrennt: Konditionen („Werte bearbeiten“), Rate prominent, Preisdetails, PDF, Versionen, Speichern.  
Kein Full-Redesign der Kundenakte-Hierarchy. Kein Carwow-Stepper. Später optional „+ Ausstattung“ – nicht nötig für Freeze.

## Code

| Bereich | Dateien |
|---------|---------|
| Ziel-Auflösung + Choice-Listen | `src/services/cleverSeller/offerVehicleIdentity.js` |
| NL-Cues | `commercialOfferNl.js`, `interpretSellerInput.js` |
| Planung / Turn | `planSellerActions.js`, `runCleverSellerTurn.js`, `resolveMissingInformation.js` |
| Kontext | `resolveAssistantContext.js`, `sellerOfferAssistFlow.js` |
| Patch + Rate-Stale | `sellerOfferConfirmGate.js` (`applyCommercialConfirmPatch` → `rateNeedsReview`) |
| UI | `DealerAiOfferPreview.jsx` (+ CSS) – Fact-Chips + Popovers |
| Rule | `.cursor/rules/clever-offer-vehicle-identity.mdc` |

## Verwandt

- [CLEVER_NEW_OFFER_FLOW.md](./CLEVER_NEW_OFFER_FLOW.md) – + Neues Angebot in der Akte
- [CLEVER_MAGIC_OFFER.md](./CLEVER_MAGIC_OFFER.md) – Safe Calculation Boundary
- [CLEVER_COMPOSER_BRAIN_DOD.md](./CLEVER_COMPOSER_BRAIN_DOD.md) – Gehirn + Manager
- [CLEVER_ZERO_LOSS_INTAKE.md](./CLEVER_ZERO_LOSS_INTAKE.md) – nichts still verwerfen
