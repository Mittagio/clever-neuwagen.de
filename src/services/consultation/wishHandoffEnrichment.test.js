/**
 * Wunschübergabe-Anreicherung – optionale Angaben vor Kontakt.
 * node src/services/consultation/wishHandoffEnrichment.test.js
 */
import assert from 'node:assert/strict';
import {
  applyWishHandoffEnrichmentToNeedProfile,
  buildWishHandoffEnrichmentLines,
  buildWishHandoffNotepadLabels,
  mergeWishHandoffNotepadLabels,
  prefillWishHandoffEnrichment,
} from './wishHandoffEnrichment.js';
import { createHappyPathSession } from './consultationHappyPath.js';
import {
  beginOfferHandoff,
  createLeadFromConsultationHappyPath,
  submitPersonalHandoff,
} from './consultationOfferHandoff.js';

{
  const prefilled = prefillWishHandoffEnrichment(
    { budget: { paymentType: 'leasing' }, leaseDurationMonths: 36, annualKm: 15000 },
    ['Leasing'],
  );
  assert.equal(prefilled.acquisitionType, 'leasing');
  assert.equal(prefilled.leasing.termId, 'term_36');
  assert.equal(prefilled.leasing.mileageId, 'km_15000');
  console.log('✓ Prefill aus needProfile');
}

{
  const enrichment = {
    vehicleNeedTiming: '1m',
    acquisitionType: 'purchase',
    specialConditionId: 'corporateBenefits',
    leasing: {},
    finance: {},
  };
  const lines = buildWishHandoffEnrichmentLines(enrichment);
  assert.ok(lines.some((l) => /Fahrzeugbedarf/i.test(l)));
  assert.ok(lines.some((l) => /Kauf/i.test(l)));
  assert.ok(lines.some((l) => /Corporate Benefits/i.test(l)));

  const profile = applyWishHandoffEnrichmentToNeedProfile({}, enrichment);
  assert.equal(profile.budget.paymentType, 'cash');
  assert.equal(profile.specialConditionId, 'corporateBenefits');
  assert.equal(profile.deliveryPreference, '1m');
  console.log('✓ Kauf + Corporate Benefits → needProfile');
}

{
  const enrichment = {
    vehicleNeedTiming: 'asap',
    acquisitionType: 'leasing',
    specialConditionId: null,
    leasing: { termId: 'term_48', mileageId: 'km_20000', downPayment: 'dp_0' },
    finance: {},
  };
  const profile = applyWishHandoffEnrichmentToNeedProfile({}, enrichment);
  assert.equal(profile.budget.paymentType, 'leasing');
  assert.equal(profile.leaseDurationMonths, 48);
  assert.equal(profile.annualKm, 20000);
  const lines = buildWishHandoffEnrichmentLines(enrichment);
  assert.ok(lines.some((l) => /48 Monate/i.test(l) && /20\.000 km/i.test(l)));
  console.log('✓ Leasing-Parameter → needProfile + Dossier');
}

{
  let session = createHappyPathSession('Autohaus Test');
  session = {
    ...session,
    notepadLabels: ['EV9 interessant', 'Elektro'],
    needProfile: {
      ...(session.needProfile ?? {}),
      selectedModelKey: 'ev9',
      budget: { paymentType: 'leasing' },
    },
  };
  session = beginOfferHandoff(session, {});
  assert.ok(session.turns.some((t) => t.handoffView?.needProfile), 'needProfile im Handoff-View');

  const result = submitPersonalHandoff(session, {
    firstName: 'Anna',
    lastName: 'Beispiel',
    email: 'anna@example.com',
    phone: '',
    contactPreference: 'whatsapp',
    contactTiming: 'this_week',
    enrichment: {
      vehicleNeedTiming: '3m',
      acquisitionType: 'finance',
      finance: { termId: 'term_36', downPayment: 'dp_1000', desiredRate: '399', balloon: 'balloon_no' },
      leasing: {},
    },
  }, { dealerName: 'Autohaus Test' });

  assert.equal(result.lead.crm.needProfile.budget.paymentType, 'finance');
  assert.equal(result.lead.crm.needProfile.budget.maxMonthlyRate, 399);
  assert.ok(
    (result.lead.sonderwuensche?.consultation?.consultationHandoff?.lines ?? [])
      .some((row) => /Finanzierung|Wunschrate|399/i.test(`${row.label} ${row.value}`))
    || JSON.stringify(result.lead).includes('399'),
    'Enrichment landet im Lead',
  );
  console.log('✓ Lead enthält Finance-Enrichment');
}

{
  const lead = createLeadFromConsultationHappyPath({
    session: {
      ...createHappyPathSession('T'),
      notepadLabels: ['SUV'],
      needProfile: {},
      selectedModelKey: 'ev9',
    },
    handoffForm: {
      firstName: 'Max',
      lastName: 'Test',
      email: 'max@test.de',
      contactPreference: 'email',
      contactTiming: 'today',
      enrichment: {
        vehicleNeedTiming: 'open',
        acquisitionType: 'open',
        leasing: {},
        finance: {},
      },
    },
  });
  assert.equal(lead.advisorStatus, 'Wunschübergabe');
  console.log('✓ Überspringen / offen bleibt gültig');
}

{
  const enrichment = {
    vehicleNeedTiming: 'asap',
    acquisitionType: 'leasing',
    specialConditionId: null,
    tradeIn: 'yes',
    leasing: { termId: 'term_48', mileageId: 'km_10000', downPayment: null },
    finance: {},
  };
  const chips = buildWishHandoffNotepadLabels(enrichment);
  assert.deepEqual(chips, [
    'Sobald wie möglich',
    'Leasing',
    '48 Monate',
    '10.000 km',
    'Inzahlungnahme',
  ]);

  const baseline = ['EV9 interessant', '36 Monate', '15.000 km', 'Kauf'];
  const merged = mergeWishHandoffNotepadLabels(baseline, enrichment);
  assert.ok(merged.includes('EV9 interessant'));
  assert.ok(merged.includes('48 Monate'));
  assert.ok(merged.includes('10.000 km'));
  assert.ok(merged.includes('Leasing'));
  assert.ok(merged.includes('Inzahlungnahme'));
  assert.ok(!merged.includes('36 Monate'));
  assert.ok(!merged.includes('15.000 km'));
  assert.ok(!merged.includes('Kauf'));

  const skipped = mergeWishHandoffNotepadLabels(baseline, {
    vehicleNeedTiming: null,
    acquisitionType: null,
    specialConditionId: null,
    tradeIn: null,
    leasing: {},
    finance: {},
  });
  assert.deepEqual(skipped, baseline);
  console.log('✓ Notizzettel: Enrichment ersetzt Laufzeit/Km, Überspringen stellt Baseline wieder her');
}

console.log('\nwishHandoffEnrichment.test.js: ok');
