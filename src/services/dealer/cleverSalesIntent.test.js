/**
 * Clever Sales Intent Tests
 */
import assert from 'node:assert/strict';
import {
  analyzeCleverSalesIntent,
  CLEVER_SALES_MODES,
  resolveCleverSalesMode,
  prefillConsultationFromSalesIntent,
  attachSalesIntentToProfile,
} from './cleverSalesIntent.js';
import { createConsultationProfile } from './cleverSalesAdvisor.js';

const ev3Size = analyzeCleverSalesIntent({ query: 'Wie groß ist der EV3?' });
assert.equal(ev3Size.mode, CLEVER_SALES_MODES.KNOWLEDGE, 'EV3 Größe → Wissensmodus');
assert.ok(ev3Size.score < 40);

const v2l = analyzeCleverSalesIntent({ query: 'Hat der EV4 V2L?' });
assert.equal(v2l.mode, CLEVER_SALES_MODES.KNOWLEDGE, 'V2L Sachfrage → Wissensmodus');

const tow = analyzeCleverSalesIntent({ query: 'Wie hoch ist die Anhängelast beim Sportage?' });
assert.equal(tow.mode, CLEVER_SALES_MODES.KNOWLEDGE, 'Anhängelast → Wissensmodus');

const compare = analyzeCleverSalesIntent({ query: 'EV3 oder EV4?' });
assert.equal(compare.mode, CLEVER_SALES_MODES.CONSULTATION, 'Vergleich → Beratungsmodus');
assert.ok(compare.score >= 40);
assert.ok(compare.followUpQuestion);

const trunk = analyzeCleverSalesIntent({ query: 'Welcher Kia hat den größeren Kofferraum?' });
assert.equal(trunk.mode, CLEVER_SALES_MODES.CONSULTATION, 'Kofferraum-Vergleich → Beratung');

const family = analyzeCleverSalesIntent({ query: 'Welches Auto passt für Familie mit 3 Kindern?' });
assert.equal(family.mode, CLEVER_SALES_MODES.CONSULTATION, 'Familie → Beratung');

const leasingRate = analyzeCleverSalesIntent({ query: 'Leasingrate EV4' });
assert.equal(leasingRate.mode, CLEVER_SALES_MODES.SALES, 'Leasingrate → Verkaufsmodus');
assert.ok(leasingRate.shouldPrepareLead);
assert.equal(leasingRate.prefillAnswers.paymentType, 'leasing');

const offer = analyzeCleverSalesIntent({ query: 'Angebot Kia EV3 Earth' });
assert.equal(offer.mode, CLEVER_SALES_MODES.SALES, 'Angebot → Verkaufsmodus');
assert.ok(offer.leadHints?.offerRequested);

const finance = analyzeCleverSalesIntent({ query: 'Finanzierung EV4 bis 400 Euro' });
assert.equal(finance.mode, CLEVER_SALES_MODES.SALES, 'Finanzierung mit Budget → Verkauf');
assert.equal(finance.prefillAnswers.paymentType, 'finance');

assert.equal(resolveCleverSalesMode(25), CLEVER_SALES_MODES.KNOWLEDGE);
assert.equal(resolveCleverSalesMode(55), CLEVER_SALES_MODES.CONSULTATION);
assert.equal(resolveCleverSalesMode(85), CLEVER_SALES_MODES.SALES);

let profile = createConsultationProfile('Leasingrate EV4');
profile = attachSalesIntentToProfile(profile, leasingRate);
profile = prefillConsultationFromSalesIntent(profile, leasingRate);
assert.equal(profile.answers.paymentType, 'leasing');
assert.equal(profile.salesIntent.mode, CLEVER_SALES_MODES.SALES);

console.log('cleverSalesIntent.test.js: ok');
