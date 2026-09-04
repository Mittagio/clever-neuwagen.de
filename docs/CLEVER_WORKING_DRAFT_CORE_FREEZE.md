# PRODUKT-FREEZE: Composer Working-Draft Core

**Status: FROZEN**

## Produktsatz

Composer nimmt auf. Working Draft hält fest. Folge-Turns verändern. Das Fachtool präzisiert. Externe Aktion bestätigt.

## Freeze-Satz

Clever darf nicht bei jedem neuen Satz neu überlegen, woran der Verkäufer arbeitet. Es arbeitet am bestehenden Working State weiter.

## Was eingefroren ist

- Lose Eingabe → verstandene Facts / Tracks (Zero-Loss)
- Single Draft Continuity über Turns
- Multi Track parallel
- Batch: mehrere Tracks → mehrere Offer Drafts (exakter Gesprächs-Scope)
- Reload / Handoff by `offerDraftId`
- Rate Safety am Draft (`rate: null` ohne passende Kalkulation)
- Composer Follow-up verändert das Arbeitsobjekt statt neu zu raten
- Vehicle Identity: explizites Modell bleibt kanonisch (PV5 ≠ EV5)

## Änderungsregel

Keine grundlegenden Änderungen an Working-Draft-, Multi-Track-, Scope- oder Handoff-Logik, **außer** ein echter P0-Regressionstest fällt um.

Sonst: Clever besser machen — nicht grundsätzlich anders.

## P1 danach

1. Message-Loop im Browser härten  
2. Offer Tool präzisieren (Identität/Pakete am selben Draft)  
3. Angebote → Öffnen strict `offerDraftId`  
4. UX-Systemreste entfernen  
5. Agent-Failure + Two-Tab  

## Verweise

- Rule: `.cursor/rules/clever-working-draft-core-freeze.mdc`
- `docs/CLEVER_COMPOSER_BRAIN_DOD.md`
- `docs/CLEVER_OFFER_VEHICLE_IDENTITY_FREEZE.md`
- `docs/CLEVER_ZERO_LOSS_INTAKE.md`
- `docs/CLEVER_CAPTURE_THEN_OFFER.md`
