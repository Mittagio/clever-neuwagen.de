# Clever · Capture then Offer

**Status:** Verbindliches Produktgesetz · **P0 messbar** (Sept 2026)  
**Stand:** September 2026  
**Vorbild:** Cursor Composer — reinlegen → verarbeiten; kein Formular-Labyrinth.

## P0 messbar

| Check | Ergebnis |
|-------|----------|
| Dump ohne Offer-Cue | `remember` / compact — **kein** PREPARE_OFFER, **keine** Web-/Wish-Rate als Offer-Monatsrate |
| Nach Capture Next-Step | `captureNextStep.cta === 'Angebot'` (bestehende CTA-Richtung) |
| „Angebot“ / „mach die 3 Angebote“ | Track-Target / Batch-Shells; `monthlyRate` bleibt null ohne autoritative Rate |
| Session | History + Working Memory am Seller-Turn; Follow-up Identity über Memory |

**Tests:** `captureThenOffer.golden.test.js`, `composerBrain.p0.golden.test.js`, `phoneMultiCapture.golden.test.js`

## Produktgesetze (hart)

1. **Alles zuerst aufnehmen** — Composer-Dump → Akte / Kundenwissen / Spuren.
2. **Dann** erst Angebotstool.
3. **Keine Web-Raten** — nie „ca. 339–369 €“ aus fremden Quellen als Wahrheit.
4. **UVP / Serie / WLTP** nur aus verifizierten Clever-Daten (Briefing ok).
5. **Belastbare Monatsrate** erst über Angebotstool + PDF / Bank / Händlerkalkulation.  
   Bei Identity-Wechsel: „Rate prüfen“ — keine Fake-Neuberechnung.

## Capture vs Offer

| Phase | Was | Response |
|-------|-----|----------|
| **Capture** | Modelle, Soft-Facts, Wunsch-Konditionen (Budget/max Rate **ohne** Bankrate) | `remember` / `compact_confirmation` / `save_with_undo` |
| **Offer** | Explizites „Angebot“ / Offer-Cue / Chip | Prepared Offer am **aktiven Track** (oder Clarification bei Multi) — **ohne** Magic-/Web-Rate |

Wunschrate / „max 350 €“ = **Kundenwunsch** (`desiredRate` / Budget).  
Das ist **keine** Angebots-Monatsrate.

## Rate-Autorität

| Quelle | Autorität | Darf Offer-`monthlyRate` setzen? |
|--------|-----------|----------------------------------|
| Verkäufer nennt Rate im Offer-Kontext / PDF / Bank | authoritative | ja |
| Wunsch-Budget („max“, „bis“, „Budget“) | wish_only | nein (nur Akte/Wish) |
| Katalog / `baseLeasingRate` / Web-Spanne / Advisory-Hint | non_authoritative | **nie** |
| Identity-Wechsel ohne neue Bankrate | stale | „Rate prüfen“ |

## Composer (Cursor-Vorbild)

- Multi-Fact-Dump wächst die Akte sofort (Partial Success).
- Unsicherheit blockiert nicht den ganzen Turn.
- Kein Stuck-Review nur wegen `paymentType`-Guess.
- Nach Capture: klarer Next Step Richtung Angebotstool (bestehende CTA / prepared action) — **kein** Design-Umbau der Kundenakte-Hierarchy.

## Code

| Bereich | Datei |
|---------|--------|
| Kern | `src/services/cleverSeller/captureThenOffer.js` |
| Session / Brain P0 | `cleverAgentWorkingMemory.js`, `runCleverSellerTurn.js`, `composerBrain.p0.golden.test.js` |
| Planung | `planSellerActions.js`, `runCleverSellerTurn.js` |
| Agent-Offer | `cleverAgent/tools/createOffer.js` |
| Rule | `.cursor/rules/clever-capture-then-offer.mdc` |

## Verwandt

- [CLEVER_COMPOSER_BRAIN_DOD.md](./CLEVER_COMPOSER_BRAIN_DOD.md)
- [CLEVER_OFFER_VEHICLE_IDENTITY_FREEZE.md](./CLEVER_OFFER_VEHICLE_IDENTITY_FREEZE.md)
- [CLEVER_ZERO_LOSS_INTAKE.md](./CLEVER_ZERO_LOSS_INTAKE.md)
- [CLEVER_MAGIC_OFFER.md](./CLEVER_MAGIC_OFFER.md) — Safe Calculation Boundary
