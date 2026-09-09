# PRODUKT-FREEZE: Intake Presenter V1 UX Baseline

**Status: FREEZE** (Schlayer-Abnahme bestanden)

## Produktsätze

> Clever hat den Kunden verstanden – nicht Felder extrahiert.

> Partial Success → ruhiges Briefing + lokale offene Punkte + eine Primary Action.

> Hard Review nur bei echter Ambiguität oder Duplikat-Gefahr.

## Verbindliche Trennung

### Normaler Partial Success (`hardReviewRequired === false`)

Oben rendern:

- Kundenname (ohne „· neue Kundenakte“)
- kompakte Briefing-Zeilen (`Kunde möchte`, `Kundenbild`, `Aktuelles Fahrzeug`, `Kontakt`, …)
- `Noch offen` nur für relevante Soft Needs (z. B. Telefonnummer) + lokale Aktion
- `Noch zu klären` nur für unsichere Zusatzinfos (z. B. „Bar“) + lokale Aktion
- genau eine Primary CTA (typisch: `Angebot vorbereiten` wenn Modell klar)

Nicht rendern:

- „Von Clever erkannt“
- Fact-Chip-Wolke / Recognition-UI
- „Schnell korrigieren“
- „Kundenakte anlegen & weitermachen“ als Dauer-CTA
- „Korrigieren“ / „Erneut suchen“ / „Verwerfen“
- doppelte Offer-/Telefon-CTAs unter der Karte

### Hard Review (`hardReviewRequired === true`)

Nur wenn:

- `resolutionStatus === 'ambiguous'`
- oder `duplicateHint`

Dann darf die bestehende Review-/Chip-UI erscheinen.

Nicht Hard Review:

- Telefon fehlt
- einzelner unresolved Fact („Bar“)
- Partial Success
- fehlende nichtkritische Daten

## Golden / Abnahme

Fixture: Alexander Schlayer (EV3 Air, E-Mail, ledig, Audi A4, Telefon fehlt, Bar unsicher)

Erwartung: Briefing wie oben; Primary `Angebot vorbereiten`; Telefon nur lokal; Bar nur unter „Noch zu klären“.

Test: `src/services/cleverSeller/quietIntakeReview.test.js` (Schlayer UI-Golden)

## Code

- Presenter: `src/services/cleverSeller/inboundLeadIntake.js`
  (`buildInboundIntakePresentation`, `buildInboundLeadReviewModel`)
- Ensure-Pfad: `ensureQuietIntakeBriefingModel` in `quietIntakeReview.js`
- Card: `SellerUniversalReviewCard.jsx` (Briefing-Defense, keine Chip-Chrome ohne Hard Review)
- Composer: `CleverGlobalComposer.jsx` (ensure beim Setzen des Review-Models)

## Explizit NICHT öffnen

- Keine neue CRM-/Lead-Struktur
- Keine NBA-Umbau
- Kein Parser-/Interpreter-Fix „weil UI“
- Kein paralleles Briefing neben Recognition-Chips
- Kein Akte-Hierarchy-Redesign

## Nach dem Freeze

Nur noch reale Fälle gegen diese Baseline testen.
UI-Änderungen am Intake-Hero nur bei Regression oder explizitem Produkt-Auftrag.
