# Clever Composer Brain — Definition of Done

**Status:** Kompass / DoD (kein Design-Track)  
**Stand:** September 2026  
**Scope:** Gehirn + Manager. UI/Design ist eingefroren.

## P0-Status (messbar, Sept 2026)

| DoD | Stand | Nachweis |
|-----|--------|----------|
| **1. Ein Gehirn** | **teilweise** | Akte + Global Composer: Agent-Pfad wenn Flag; Shared `agentWorkingMemory`; Seller-Turn erhält `conversationHistory` / `workingMemory` / Offer-Kontext aus Memory. Kein zweites Interpret-Gehirn. |
| **2. Session-Gedächtnis** | **P0 ok** | History nicht hardcoded leer; deterministische Turns → `updateMemoryFromSellerTurn`; Follow-up „schwarz“ über Memory ohne frische Offer-Card. Golden: `composerBrain.p0.golden.test.js`. |
| **3. Dump First-Class** | **P0 härter** | Multi-Dump: Trim/Farbe/Paket **per Spur** wo erkennbar (Elite, weiß, Upgrade); Zero-Loss bleibt. |
| **4. Auftrag = sichtbares Ergebnis** | **P0 ok** | Capture → Tracks; „mach die 3 Angebote“ mit History; Identity-Follow-up. |
| **5. Confirm nur bei Risiko** | unverändert | Capture-then-Offer: compact + Next-Step „Angebot“; keine Web-Rate. |

**Noch offen (bewusst nicht P0):** alle Side-Pfade (Magic Compose, PDF/OCR, einzelne Action-Shortcuts) Memory-lückenlos; IMAP; Dashboard-UI; Agent-Default immer an.

## Produktgesetz

> **Der Composer ist Clever** — wie Cursor Composer für den Verkäufer: Anweisungen, Aufgaben und Angebote reinlegen → Clever verarbeitet.

> **Design Freeze:** Keine Layout-, Visual- oder Hierarchy-Redesigns in diesem Track. Bestehende Akte / Kundenwissen / Konditionen / CTA-Hierarchie bleibt.

> **Arbeit = Gehirn + Manager.** Ein Agent-Loop (Gehirn) plus Orchestrierung, Memory und Apply (Manager). Nicht mehr UI.

## Messbare DoD (5 Punkte)

### 1. Ein Gehirn

Dashboard und Kundenakte laufen denselben Agent-/Orchestrator-Pfad. Keine parallelen „Gehirne“ ohne gemeinsames Memory.

**Messbar:** Ein Turn von Dashboard und Akte landet im gleichen Orchestrator-/Agent-Einstieg; kein Surface-spezifischer Interpret ohne Shared Memory.

### 2. Session-Gedächtnis

Folgeanweisungen wirken auf denselben Job. History ist nicht hardcoded leer.

Beispiele: „EV4“, „schreib ihm das“, „10k km“ beziehen sich auf den laufenden Auftrag / die letzte Vorbereitung.

**Messbar:** Follow-up-Phrasen ändern den bestehenden Job (Fahrzeug, Nachricht, Kondition), statt einen isolierten Neustart ohne Kontext.

### 3. Dump First-Class

Mail / Zettel / PDF / Paste → Review → echte Kundenfacts in Akte / Kundenwissen.

Keine Prozess-Chips als Ersatz für Fakten. Zero-Loss bleibt verbindlich: nichts Bedeutungstragendes still verwerfen.

**Messbar:** Nach Confirm stehen strukturierte Facts (oder unresolved notes) in der Akte/Kundenwissen — nicht nur UI-Status-Chips.

### 4. Auftrag = sichtbares Ergebnis

Nach Confirm ändert sich Angebot / Track / Nachricht / Name. Kein Kleben (z. B. EV3 bleibt bei EV4-Auftrag). Kein Name-Verlust.

**Messbar:** Diff im Working Context / Track / Angebot ist nach Accept sichtbar und korrekt; Identity-Felder bleiben erhalten.

### 5. Confirm nur bei Risiko

Geschäftliche Aktionen (Angebot senden, Termin, Kundenanlage, Vertragsimport, …) mit Review. Sichere interne Updates kompakt (mit Undo). Clever führt den Job; der Verkäufer bestätigt Risiken.

**Messbar:** Response-Kinds folgen der Clever-2.0-Policy (`prepared_action_review` vs. `compact_confirmation` / `direct_answer`).

## Explizit NICHT

- Kein Design-Polish, keine neuen Boxen, kein Dashboard-Redesign
- Kein zweites Carwow / kein Marktplatz
- Nicht „mehr UI“, sondern zuverlässige Ausführung (Gehirn + Manager)

## Verwandte Docs & Rules

| Ressource | Rolle |
|-----------|--------|
| [CLEVER_GLOBAL_COMPOSER.md](./CLEVER_GLOBAL_COMPOSER.md) | Surfaces, Orchestrator, Composer-Produktgesetz |
| [CLEVER_2_0_ASSISTANT_GAP_AUDIT.md](./CLEVER_2_0_ASSISTANT_GAP_AUDIT.md) | Gap-Audit, parallele Pfade, Memory-Lücken |
| [CLEVER_ZERO_LOSS_INTAKE.md](./CLEVER_ZERO_LOSS_INTAKE.md) | Dump → Buckets, Partial Success |
| [CLEVER_CAPTURE_THEN_OFFER.md](./CLEVER_CAPTURE_THEN_OFFER.md) | Capture first, dann Angebotstool; keine Web-Raten |
| [CLEVER_OFFER_VEHICLE_IDENTITY_FREEZE.md](./CLEVER_OFFER_VEHICLE_IDENTITY_FREEZE.md) | Track-gebundenes Angebot, Rate prüfen |
| `.cursor/rules/clever-2-0-assistant.mdc` | Assistant Experience / Response Policy |
| `.cursor/rules/clever-zero-loss-intake.mdc` | Zero-Loss Freeze |
| `.cursor/rules/clever-capture-then-offer.mdc` | Capture then Offer |
| `.cursor/rules/clever-composer-brain.mdc` | Diese DoD als Agent-Regel |

## DoD-Check (kurz)

Ein Track gilt erst als fertig, wenn alle fünf Punkte oben nachweisbar sind — ohne Design-Änderungen.
