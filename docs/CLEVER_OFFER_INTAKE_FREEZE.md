# PRODUKT-FREEZE: Offer Intake – Manual + PDF am selben Draft

**Status: FREEZE**

## Produktsätze

> Composer erstellt das Konzept.

> PDF und Verkäufer präzisieren denselben Draft.

> Unvollständig ist erlaubt. Geraten ist nicht erlaubt.

> Clever liest nicht nur die Rate – Clever versteht das Angebot.

## Scope

Baut auf Working-Draft-Core auf. Keine neue Offer-Architektur.

1. „EV2 Angebot“ → Concept Draft (nur Modell, Slots open, Rate null)
2. Manuelle Präzisierung (Composer / Offer Tool) → **gleicher** `offerDraftId`
3. PDF-Upload → Merge in **denselben** Draft (Identity + Konditionen + Rate)
4. Konflikte nur slotweise („Variante prüfen“), Rest darf durch

## Code

- Merge: `src/services/cleverSeller/offerDraftIntakeMerge.js`
- Follow-up / Mutation: `cleverWorkingDraft.js`, `offerVehicleIdentity.js`
- Plan: `planSellerActions.js` (`refine_offer_from_pdf`)
- Concept Cue: `isModelOnlyOfferCue` → deterministic + PREPARE_OFFER (kein Capture/Remember-Schluck)
- Route: `routeSellerRequest.js` (Concept + Identity-Follow-up → deterministic)
- Golden: `offerIntakeFreeze.golden.test.js`
- Rule: `.cursor/rules/clever-offer-intake-freeze.mdc`

## P1 später

- Angebote → Öffnen strict `offerDraftId`
- Offer-Tool UI: Identity-Chips + PDF ersetzen
- Browser PDF Upload E2E (Golden C) mit echter Datei
