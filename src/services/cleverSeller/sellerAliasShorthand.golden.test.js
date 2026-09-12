/**
 * Pattern-Freeze: Seller Shorthand / Fuzzy Input V1 · Status: pilotfähig
 *
 * Neues Muster? ja (kontrollierte Alias-/Normalisierung vor Katalog-Validierung)
 * Keine Sonderregel pro Tippfehler · keine neuen künstlichen Shorthand-Teststrings.
 *
 * Nächster Prozess: echte Anfrage → neues Muster ja/nein → nur systemisch fixen → Golden.
 *
 * Kern: sellerAliasRegistry.js · normalizeSellerUnits.js · FINANCING_ALIAS_RE · Name-Stopwörter
 * Golden: dieses File (Regressionsschutz, kein Teststring-Labor)
 * Doc: docs/CLEVER_ZERO_LOSS_INTAKE.md § Verkäufer-Kurzschrift
 *
 * node --test src/services/cleverSeller/sellerAliasShorthand.golden.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import { getOfferDraftById } from './cleverWorkingDraft.js';
import {
  findSellerAliasesInText,
  parseSellerCommercialAliasShorthand,
  resolveSellerAliasToken,
} from './sellerAliasRegistry.js';
import {
  validateOfferPackageAgainstCatalog,
  validateOfferPowerAgainstCatalog,
} from './offerVehicleIdentity.js';

const ENV = {
  VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
  CLEVER_SELLER_ORCHESTRATOR: 'true',
};

function factsByField(facts, field) {
  return (facts || []).filter((f) => f.field === field);
}

function emptyLead() {
  return {
    id: 'lead-alias-shorthand',
    name: 'Kunde noch offen',
    contact: { name: 'Kunde noch offen' },
    wish: {},
    crm: { needProfile: createEmptyNeedProfile() },
  };
}

describe('Seller Alias Shorthand', () => {
  it('Registry: WP / AHK / DW / wei', () => {
    assert.equal(resolveSellerAliasToken('WP')?.canonicalId, 'heat_pump');
    assert.equal(resolveSellerAliasToken('AHK')?.field, 'towHitchRequired');
    assert.equal(resolveSellerAliasToken('Drive Wise')?.label, 'Drive Wise');
    assert.equal(resolveSellerAliasToken('wei')?.canonicalId, 'weiß');
    const hits = findSellerAliasesInText('EV6 WP Drive Wise');
    assert.ok(hits.some((h) => h.canonicalId === 'heat_pump'));
    assert.ok(hits.some((h) => /drive\s*wise/i.test(h.label)));
  });

  it('Golden 1: Michael Wittig EV2 Air 48 12.500 km wei WIN', () => {
    const input = 'Michael Wittig EV2 Air 48 12.500 km wei WIN';
    const interpreted = interpretSellerInput(input);
    const fields = new Set(interpreted.facts.map((f) => f.field));

    const name = factsByField(interpreted.facts, 'customerName')[0];
    assert.ok(name, 'customerName');
    assert.match(String(name.value || name.label), /Michael\s+Wittig/i);

    const interest = factsByField(interpreted.facts, 'vehicleInterest')[0];
    assert.ok(interest, 'vehicleInterest');
    assert.equal(String(interest.value?.modelKey || '').toLowerCase(), 'ev2');
    assert.match(String(interest.value?.trim || interest.label || ''), /Air/i);

    assert.ok(fields.has('termMonths'));
    assert.equal(Number(factsByField(interpreted.facts, 'termMonths')[0].value), 48);
    assert.ok(fields.has('annualMileage') || fields.has('mileagePerYear'));
    const km = factsByField(interpreted.facts, 'annualMileage')[0]
      || factsByField(interpreted.facts, 'mileagePerYear')[0];
    assert.equal(Number(km.value), 12500);

    const color = factsByField(interpreted.facts, 'colorPreference')[0];
    assert.ok(color, 'wei → weiß');
    assert.match(JSON.stringify(color.value || color.label), /wei/i);

    const win = factsByField(interpreted.facts, 'equipmentWish')
      .find((f) => /winter|win/i.test(String(f.label || f.value?.label || '')));
    assert.ok(win, 'WIN erkannt');
    // Katalog: Winter mehrdeutig (Winter vs Winter-Connect) → prüfen erlaubt
    if (win.needsConfirmation || win.value?.validationStatus === 'needs_review') {
      assert.match(String(win.label), /prüfen/i);
    }

    assert.ok(!interpreted.facts.some((f) => f.field === 'downPayment'), 'keine AZ erfinden');
    assert.ok(
      !interpreted.facts.some((f) => f.field === 'paymentType'),
      'kein paymentType erfinden',
    );
    assert.ok(
      !interpreted.facts.some((f) => (
        (f.field === 'monthlyBudget' || f.field === 'desiredRate')
        && f.value != null
      )),
      'rate null',
    );

    const turn = runCleverSellerTurn({
      lead: emptyLead(),
      sellerInput: input,
      env: ENV,
    });
    const applied = applyAcceptedSellerTurn(emptyLead(), turn, { postFeedCard: false });
    assert.equal(applied.ok, true);
    const briefing = buildSellerWorkBriefing({ lead: applied.lead, facts: [] });
    assert.equal(briefing.nextBestAction?.handler, 'prepare_offer');
  });

  it('Golden 2: EV6 WP Drive Wise 229 PS', () => {
    const input = 'EV6 WP Drive Wise 229 PS';
    const interpreted = interpretSellerInput(input);

    const interest = factsByField(interpreted.facts, 'vehicleInterest')[0];
    assert.equal(String(interest?.value?.modelKey || '').toLowerCase(), 'ev6');

    const heat = factsByField(interpreted.facts, 'equipmentWish')
      .find((f) => /wärmepumpe|heat_pump|wp/i.test(`${f.label} ${f.value?.id || ''}`));
    assert.ok(heat, 'WP → heat_pump');
    assert.ok(!heat.needsConfirmation || heat.value?.id, 'WP speicherbar');

    const dw = factsByField(interpreted.facts, 'equipmentWish')
      .find((f) => /drive\s*wise/i.test(String(f.label || f.value?.label || '')));
    assert.ok(dw, 'Drive Wise Kandidat');
    // EV6 Configure-Katalog hat kein DriveWise → lokal prüfen
    const pkgCheck = validateOfferPackageAgainstCatalog({
      modelKey: 'ev6',
      packageLabel: 'Drive Wise',
    });
    if (!pkgCheck.ok) {
      assert.equal(dw.needsConfirmation, true);
      assert.match(String(dw.label), /prüfen/i);
    }

    const motor = factsByField(interpreted.facts, 'motorPreference')[0];
    assert.ok(motor, '229 PS');
    const powerOk = validateOfferPowerAgainstCatalog({
      modelKey: 'ev6',
      powerPs: 229,
      raw: '229 PS',
    });
    assert.equal(powerOk.ok, true, '229 PS katalogeindeutig auf EV6');
    assert.ok(!motor.needsConfirmation);
    assert.match(String(motor.label || motor.value?.label || ''), /long\s*range|168|229/i);

    assert.ok(
      !interpreted.facts.some((f) => f.field === 'monthlyBudget' || f.field === 'desiredRate'),
      'rate null',
    );
  });

  it('Golden 3: EV6 WP Drive Wise 229 PS weiß 48/15 3k', () => {
    const input = 'EV6 WP Drive Wise 229 PS weiß 48/15 3k';
    const shorthand = parseSellerCommercialAliasShorthand(input);
    assert.equal(shorthand.termMonths, 48);
    assert.equal(shorthand.annualMileage, 15000);
    assert.equal(shorthand.downPayment, 3000);

    const interpreted = interpretSellerInput(input);
    assert.equal(String(factsByField(interpreted.facts, 'vehicleInterest')[0]?.value?.modelKey || '').toLowerCase(), 'ev6');
    assert.ok(factsByField(interpreted.facts, 'equipmentWish').some((f) => /wärmepumpe|heat_pump/i.test(`${f.label}${f.value?.id || ''}`)));
    assert.ok(factsByField(interpreted.facts, 'motorPreference')[0]);
    assert.match(JSON.stringify(factsByField(interpreted.facts, 'colorPreference')[0]?.value || factsByField(interpreted.facts, 'colorPreference')[0]?.label || ''), /wei/i);
    assert.equal(Number(factsByField(interpreted.facts, 'termMonths')[0]?.value), 48);
    const km = factsByField(interpreted.facts, 'annualMileage')[0]
      || factsByField(interpreted.facts, 'mileagePerYear')[0];
    assert.equal(Number(km?.value), 15000);
    assert.equal(Number(factsByField(interpreted.facts, 'downPayment')[0]?.value), 3000);
    assert.ok(!interpreted.facts.some((f) => f.field === 'desiredRate' || f.field === 'monthlyBudget'));

    const turn = runCleverSellerTurn({
      lead: emptyLead(),
      sellerInput: input,
      env: ENV,
    });
    const applied = applyAcceptedSellerTurn(emptyLead(), turn, { postFeedCard: false });
    const briefing = buildSellerWorkBriefing({ lead: applied.lead, facts: [] });
    assert.equal(briefing.nextBestAction?.handler, 'prepare_offer');
    const draftId = applied.lead.crm?.cleverWorkingState?.currentOfferDraftId;
    if (draftId) {
      const draft = getOfferDraftById(applied.lead, draftId);
      assert.equal(draft?.rate ?? draft?.monthlyRate ?? null, null);
    }
  });

  it('Golden 4: Partial Success – unbekanntes Paket blockiert nicht', () => {
    const input = 'EV3 Earth weiß 48 Monate 15.000 km 2000 € AZ XYZPAKET';
    const interpreted = interpretSellerInput(input);
    assert.ok(factsByField(interpreted.facts, 'vehicleInterest')[0]);
    assert.ok(factsByField(interpreted.facts, 'colorPreference')[0]);
    assert.equal(Number(factsByField(interpreted.facts, 'termMonths')[0]?.value), 48);
    assert.ok(
      factsByField(interpreted.facts, 'annualMileage')[0]
      || factsByField(interpreted.facts, 'mileagePerYear')[0],
    );
    assert.equal(Number(factsByField(interpreted.facts, 'downPayment')[0]?.value), 2000);

    // Unbekanntes Paket: lokal oder unresolved – kein globaler hard block
    assert.notEqual(interpreted.hardReviewRequired, true);
    const turn = runCleverSellerTurn({
      lead: emptyLead(),
      sellerInput: input,
      env: ENV,
    });
    assert.ok(turn);
    const applied = applyAcceptedSellerTurn(emptyLead(), turn, { postFeedCard: false });
    assert.equal(applied.ok, true);
    assert.equal(Number(applied.lead.wish?.termMonths), 48);
  });

  it('Golden 5: EV6 999 PS WP – falsche Leistung nicht erfinden', () => {
    const input = 'EV6 999 PS WP';
    const interpreted = interpretSellerInput(input);
    assert.equal(String(factsByField(interpreted.facts, 'vehicleInterest')[0]?.value?.modelKey || '').toLowerCase(), 'ev6');
    assert.ok(factsByField(interpreted.facts, 'equipmentWish').some((f) => /wärmepumpe|heat_pump/i.test(`${f.label}${f.value?.id || ''}`)));

    const motor = factsByField(interpreted.facts, 'motorPreference')[0];
    assert.ok(motor);
    assert.equal(motor.needsConfirmation, true);
    assert.match(String(motor.label), /999\s*PS.*prüfen|prüfen/i);
    assert.equal(motor.value?.id ?? null, null);
    assert.ok(
      !interpreted.facts.some((f) => f.field === 'desiredRate' || f.field === 'monthlyBudget'),
    );

    const bad = validateOfferPowerAgainstCatalog({ modelKey: 'ev6', powerPs: 999, raw: '999 PS' });
    assert.equal(bad.ok, false);
  });
});
