/**
 * Realistische Kundenmail-Capture (Wittig EV3) – Hang + Semantics.
 * node --test src/services/cleverSeller/customerMailCapture.golden.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { buildVehicleIdentityDraftFromFacts } from './vehicleIdentityDraft.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { determineNextBestSellerAction } from './determineNextBestSellerAction.js';
import {
  hasTradeInCue,
  hasTradeInNegation,
  extractTradeInCandidates,
} from './detectTradeInFromSellerInput.js';
import { parseCustomerNameFromMail } from '../dealerAiMailExtractor.js';

const ORIGINAL_MAIL = `Absender: michael.wittig@example.de
Betreff: Anfrage Kia EV3 Leasing

Guten Tag,

ich interessiere mich für einen Kia EV3.

Am liebsten hätte ich die Air Ausstattung mit Long Range.

Leasing wäre für mich interessant mit:
48 Monaten
12.500 km pro Jahr
3.000 Euro Sonderzahlung

Farbe am liebsten weiß.

Wichtig wären mir außerdem:
Wärmepumpe
Winterpaket
und wenn möglich eine Anhängerkupplung.

Ich fahre aktuell einen VW Golf, möchte diesen aber nicht in Zahlung geben.

Das Fahrzeug würde ich ungefähr im Dezember benötigen.

Können Sie mir bitte ein Angebot vorbereiten?

Viele Grüße
Michael Wittig`;

function emptyLead() {
  return {
    id: 'lead-mail-capture',
    name: 'Kunde noch offen',
    contact: { name: 'Kunde noch offen', kind: 'private' },
    wish: {},
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [],
      vehicleOffers: {},
      sellerInsights: [],
      offerDrafts: [],
    },
    history: [],
  };
}

describe('P0 Hang – trade-in negation + blank lines', () => {
  it('A–E: interpretSellerInput bleibt schnell', () => {
    const cases = {
      A: 'VW Golf nicht in Zahlung geben',
      B: 'möchte diesen nicht in Zahlung geben',
      C: 'möchte diesen aber nicht in Zahlung geben',
      D: 'Ich fahre aktuell einen VW Golf, möchte diesen aber nicht in Zahlung geben.',
      E: ORIGINAL_MAIL,
    };
    for (const [id, text] of Object.entries(cases)) {
      const t0 = Date.now();
      const r = interpretSellerInput(text);
      const ms = Date.now() - t0;
      assert.ok(ms < 2000, `${id} zu langsam: ${ms}ms`);
      assert.ok(Array.isArray(r.facts), `${id} facts`);
    }
  });

  it('lineFallback hängt nicht bei Leerzeilen + Inzahlungnahme-Cue', () => {
    const text = 'Inzahlungnahme gewünscht.\n\nKunde fährt einen Ford Kuga.';
    const t0 = Date.now();
    const cands = extractTradeInCandidates(text);
    assert.ok(Date.now() - t0 < 500, 'extractTradeInCandidates Timeout');
    assert.ok(Array.isArray(cands), 'candidates array');
    // Hang-Fix: split statt /^(.*)$/gim – Leerzeilen dürfen nicht loopen
    const hangText = `Betreff: Anfrage Kia EV3\n\nich interessiere mich für einen Kia EV3.\nIch fahre einen VW Golf, möchte diesen aber nicht in Zahlung geben.`;
    const t1 = Date.now();
    extractTradeInCandidates(hangText);
    assert.ok(Date.now() - t1 < 500, 'Negation+Leerzeilen Timeout');
  });
});

describe('Golden Mail 1 – Original unverändert', () => {
  it('Facts + Concept Draft + NBA', () => {
    const interpreted = interpretSellerInput(ORIGINAL_MAIL);
    const fields = Object.fromEntries(
      interpreted.facts.map((f) => [f.field, f]),
    );

    assert.equal(fields.customerName?.label, 'Michael Wittig');
    assert.match(String(fields.email?.label || fields.email?.value || ''), /michael\.wittig@example\.de/i);

    assert.match(String(fields.existingVehicle?.label || ''), /VW\s+Golf/i);
    assert.ok(!fields.tradeInRequested, 'kein tradeInRequested');
    assert.ok(!fields.tradeInVehicle, 'kein tradeInVehicle');
    assert.equal(hasTradeInCue(ORIGINAL_MAIL), false);
    assert.equal(hasTradeInNegation(ORIGINAL_MAIL), true);

    assert.ok(fields.vehicleInterest, 'ein vehicleInterest');
    assert.ok(!fields.vehicleInterestMulti, 'kein EV3/EV3-Air Sibling');
    assert.match(String(fields.vehicleInterest.label), /EV3/i);
    assert.match(String(fields.vehicleInterest.label), /Air/i);
    assert.match(String(fields.motorPreference?.label || ''), /Long\s*Range/i);

    assert.equal(Number(fields.termMonths?.value), 48);
    assert.equal(Number(fields.annualMileage?.value), 12500);
    assert.equal(Number(fields.downPayment?.value), 3000);
    assert.match(String(fields.paymentType?.label || fields.paymentType?.value || ''), /leasing/i);

    assert.match(String(fields.colorPreference?.label || ''), /wei(ß|ss)/i);
    assert.equal(fields.colorPreference?.needsConfirmation, false);

    const equip = interpreted.facts.filter((f) => f.field === 'equipmentWish');
    assert.ok(equip.some((f) => /wärmepumpe|heat/i.test(f.label)), 'Wärmepumpe');
    const winters = equip.filter((f) => /winter/i.test(f.label));
    assert.equal(winters.length, 1, 'Winter nicht doppelt');
    assert.ok(
      interpreted.facts.some((f) => f.field === 'towHitchRequired'),
      'AHK',
    );

    assert.match(String(fields.deliveryDeadline?.label || ''), /Dezember/i);

    const identity = buildVehicleIdentityDraftFromFacts({
      facts: interpreted.facts,
      sellerInput: ORIGINAL_MAIL,
    });
    assert.match(String(identity.model?.canonical || identity.model?.raw || ''), /EV3/i);
    assert.match(String(identity.trim?.canonical || identity.trim?.raw || ''), /Air/i);
    assert.match(String(identity.powertrainVariant?.raw || ''), /Long\s*Range/i);
    assert.notEqual(identity.color?.status, 'needs_refinement', 'weiß ohne unnötiges Review');

    const lead = emptyLead();
    const turn = runCleverSellerTurn({
      lead,
      sellerInput: ORIGINAL_MAIL,
      leadsSnapshot: [lead],
      scopeHint: 'customer_akte',
      env: {
        VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
        CLEVER_SELLER_ORCHESTRATOR: 'true',
      },
    });
    assert.equal(turn.ok, true);
    const applied = applyAcceptedSellerTurn(lead, turn, { postFeedCard: false });
    assert.equal(applied.ok, true);
    const nextLead = applied.lead;
    const draftId = nextLead.crm?.cleverWorkingState?.currentOfferDraftId
      || (turn.preparedActions || []).find((a) => a.payload?.offerDraftId)?.payload?.offerDraftId
      || (nextLead.crm?.offerDrafts || [])[0]?.offerDraftId
      || (nextLead.crm?.offerDrafts || [])[0]?.id
      || null;
    assert.ok(draftId, 'offerDraftId stabil');
    const draftIds = new Set(
      (nextLead.crm?.offerDrafts || [])
        .map((d) => d.offerDraftId || d.id)
        .filter(Boolean),
    );
    if (draftIds.size > 0) {
      assert.equal(draftIds.size, 1, 'kein Sibling-Draft EV3/EV3 Air');
    }

    const nba = determineNextBestSellerAction({ lead: nextLead });
    const nbaBlob = JSON.stringify(nba || {});
    assert.match(nbaBlob, /prepare_offer|angebot|Offer/i, 'NBA Angebot vorbereiten');
  });
});

describe('Golden Mail 2–3 – Trade-in Negation', () => {
  it('bleibt bei mir', () => {
    const text = 'Ich fahre einen VW Golf, aber der bleibt bei mir.';
    const r = interpretSellerInput(text);
    assert.match(String(r.facts.find((f) => f.field === 'existingVehicle')?.label || ''), /Golf/i);
    assert.ok(!r.facts.some((f) => f.field === 'tradeInRequested' || f.field === 'tradeInVehicle'));
  });

  it('keine Inzahlungnahme', () => {
    const text = 'VW Golf vorhanden, keine Inzahlungnahme.';
    const r = interpretSellerInput(text);
    assert.match(String(r.facts.find((f) => f.field === 'existingVehicle')?.label || ''), /Golf/i);
    assert.ok(!r.facts.some((f) => f.field === 'tradeInRequested' || f.field === 'tradeInVehicle'));
  });
});

describe('Golden Mail 4 – Signatur', () => {
  it('Mit freundlichen Grüßen → Michael Wittig', () => {
    const text = [
      'Absender: michael.wittig@example.de',
      'Betreff: Anfrage',
      '',
      'Hallo,',
      'bitte Angebot.',
      '',
      'Mit freundlichen Grüßen',
      'Michael Wittig',
    ].join('\n');
    const r = interpretSellerInput(text);
    assert.equal(r.facts.find((f) => f.field === 'customerName')?.label, 'Michael Wittig');
    assert.notEqual(r.facts.find((f) => f.field === 'customerName')?.label, 'Mit freundlichen Grüßen');
    assert.equal(
      parseCustomerNameFromMail('bitte Angebot.', 'Mit freundlichen Grüßen\nMichael Wittig'),
      'Michael Wittig',
    );
  });
});

describe('Golden Mail 5 – Timing', () => {
  it('ungefähr im Dezember', () => {
    const text = 'Ich brauche das Fahrzeug ungefähr im Dezember.';
    const r = interpretSellerInput(text);
    const deadline = r.facts.find((f) => f.field === 'deliveryDeadline');
    assert.ok(deadline, 'deliveryDeadline');
    assert.match(String(deadline.label || ''), /Dezember/i);
  });
});
