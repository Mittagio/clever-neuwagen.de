/**
 * Pattern-Freeze: Multi-Offer Capture V1 · Status: pilotfähig
 *
 * Neues Muster? ja
 * Zwei Fahrzeugidentitäten (gleiches Modell) + Leasing + zusätzliches Bar-Szenario
 * in einem Verkäufer-Diktat. Keine Fake-Katalog-Mappings für R / VIC.
 *
 * Keine Sonderregeln nur für Michael Ulmer.
 * Keine neuen künstlichen Varianten erfinden.
 *
 * node --test src/services/cleverSeller/ulmerMultiOfferCapture.golden.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { interpretSellerInput } from './interpretSellerInput.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';
import {
  getCleverWorkingState,
} from './cleverWorkingDraft.js';
import { listCommercialScenarios } from '../crm/commercialScenarios.js';
import { NEXT_BEST_ACTION_ID } from './determineNextBestSellerAction.js';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';

const ENV = {
  VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
  CLEVER_SELLER_ORCHESTRATOR: 'true',
};

const DUMP = `Michael Ulmer möchte einen EV3 in der Ausstattungsvariante R
mit Wärmepumpe in Farbe Weiß.

Das zweite Angebot ist ein EV3 VIC Upgrade Business Paket
in der Farbe Schwarz.

Er möchte 48 Monate, 12.500 Kilometer
und 4.000 Euro Anzahlung.

Er braucht das Auto sofort.

Zusätzlich hätte er für beide Fahrzeuge jeweils noch gern
ein Barangebot mit 15 Prozent Rabatt auf den Listenpreis.`;

function emptyLead(id = 'lead-ulmer-multi-offer') {
  return {
    id,
    name: null,
    contact: {},
    wish: {},
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [],
      cleverWorkingState: null,
      vehicleOffers: [],
    },
  };
}

function by(facts, field) {
  return (facts || []).filter((f) => f.field === field);
}

describe('Multi-Offer Capture V1 – Ulmer 2× EV3 Leasing+Bar', () => {
  it('T0 Capture: 2 Tracks, 2 Drafts, Dual Commercial, R/VIC lokal prüfen', () => {
    const interpreted = interpretSellerInput(DUMP);
    const facts = interpreted.facts;

    assert.match(String(by(facts, 'customerName')[0]?.value || ''), /Michael\s+Ulmer/i);

    const multi = by(facts, 'vehicleInterestMulti')[0];
    assert.ok(multi);
    assert.equal(Array.isArray(multi.value) && multi.value.length, 2);
    assert.equal(String(multi.value[0].modelKey).toLowerCase(), 'ev3');
    assert.equal(String(multi.value[1].modelKey).toLowerCase(), 'ev3');
    assert.match(String(multi.value[0].color || ''), /wei/i);
    assert.match(String(multi.value[1].color || ''), /schwarz/i);
    assert.match(String(multi.value[0].package || ''), /wärm|waerm|heat/i);
    assert.ok(!/wärm|waerm|heat/i.test(String(multi.value[1].package || '')), 'WP nicht an Variante 2');
    assert.equal(multi.value[0].trimCandidate?.raw, 'R');
    assert.match(String(multi.value[1].packageCandidates?.[0]?.raw || ''), /VIC|Business/i);

    assert.equal(by(facts, 'paymentType')[0]?.value, 'leasing');
    const scenarios = by(facts, 'commercialScenarios')[0]?.value || [];
    assert.equal(scenarios.length, 2);
    assert.equal(scenarios.find((s) => s.type === 'leasing')?.termMonths, 48);
    assert.equal(scenarios.find((s) => s.type === 'leasing')?.annualMileage, 12500);
    assert.equal(scenarios.find((s) => s.type === 'leasing')?.downPayment, 4000);
    assert.equal(scenarios.find((s) => s.type === 'cash')?.discountPercent, 15);
    assert.equal(scenarios.find((s) => s.type === 'cash')?.discountBase, 'listPrice');
    assert.equal(Number(by(facts, 'discountPercent')[0]?.value), 15);
    assert.equal(by(facts, 'availabilityPreference')[0]?.value, 'immediate');

    const turn = runCleverSellerTurn({ lead: emptyLead(), sellerInput: DUMP, env: ENV });
    const applied = applyAcceptedSellerTurn(emptyLead(), turn, { postFeedCard: false });
    const lead = applied.lead;
    const tracks = listCustomerVehicleTracks(lead);
    assert.equal(tracks.length, 2, 'genau 2 Tracks');
    assert.ok(!tracks.some((t) => String(t.modelKey || '').toLowerCase() !== 'ev3'));

    const colors = tracks.map((t) => String(t.preferredColor || t.colorLabel || '').toLowerCase());
    assert.ok(colors.some((c) => /wei/.test(c)), 'Weiß-Track');
    assert.ok(colors.some((c) => /schwarz/.test(c)), 'Schwarz-Track');

    const white = tracks.find((t) => /wei/.test(String(t.preferredColor || t.colorLabel || '')));
    const black = tracks.find((t) => /schwarz/.test(String(t.preferredColor || t.colorLabel || '')));
    assert.ok(white);
    assert.ok(black);
    assert.ok(
      (white.customerRequirements || []).some((r) => /wärm|waerm|heat/i.test(String(r))),
      'Wärmepumpe nur Weiß',
    );
    assert.ok(
      !(black.customerRequirements || []).some((r) => /wärm|waerm|heat/i.test(String(r))),
      'keine WP am Schwarz-Track',
    );
    assert.ok(
      (white.customerRequirements || []).some((r) => /Variante R prüfen/i.test(String(r)))
      || /R/i.test(String(white.config?.trimLabel || '')),
      'R lokal prüfen',
    );
    assert.ok(
      (black.customerRequirements || []).some((r) => /VIC|Business/i.test(String(r))),
      'VIC lokal prüfen',
    );

    const state = getCleverWorkingState(lead);
    const drafts = Object.values(state.offerDrafts || {});
    assert.equal(drafts.length, 2, 'genau 2 Concept Drafts');
    assert.ok(drafts.every((d) => (d.rate ?? d.monthlyRate ?? null) == null), 'rate null');

    for (const d of drafts) {
      const id = state.vehicleIdentityDrafts?.[d.vehicleIdentityDraftId] || d.vehicleIdentityDraft;
      const color = String(id?.color?.raw || id?.color?.canonical || '').toLowerCase();
      const pkgs = id?.packages || [];
      if (/wei/.test(color)) {
        assert.equal(id?.trim?.raw, 'R');
        assert.equal(id?.trim?.status, 'needs_refinement');
        assert.ok(pkgs.some((p) => /wärm|waerm|heat/i.test(String(p.raw || ''))));
        assert.ok(!pkgs.some((p) => /VIC|Business/i.test(String(p.raw || ''))));
      }
      if (/schwarz/.test(color)) {
        assert.ok(pkgs.some((p) => /VIC|Business|prüfen/i.test(String(p.raw || ''))));
        assert.ok(pkgs.every((p) => !/wärm|waerm|heat/i.test(String(p.raw || ''))));
      }
    }

    const leadScenarios = listCommercialScenarios(lead);
    assert.ok(leadScenarios.some((s) => s.type === 'leasing'));
    assert.ok(leadScenarios.some((s) => s.type === 'cash' && Number(s.discountPercent) === 15));
    assert.equal(lead.wish?.paymentType, 'leasing');

    const briefing = buildSellerWorkBriefing({ lead, facts: [] });
    assert.equal(briefing.nextBestAction?.handler, 'prepare_offer');
    assert.ok(
      briefing.nextBestAction?.id === NEXT_BEST_ACTION_ID.PREPARE_OFFER
      || briefing.nextBestAction?.handler === 'prepare_offer',
    );
  });
});
