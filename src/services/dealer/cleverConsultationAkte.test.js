/**
 * Clever-Beratung – Kundenakte-Aufbereitung
 */
import assert from 'node:assert/strict';
import {
  buildCleverBeratungAkteView,
  extractConsultationFromLead,
  hasCleverBeratungData,
} from './cleverConsultationAkte.js';

const sampleLead = {
  id: 'lead-test',
  source: 'dealerJourney',
  dealerId: 'autohaus-trinkle',
  paymentType: 'leasing',
  desiredRate: 400,
  cleverQuotePercent: 82,
  inquiryBrief: {
    searchQuery: 'Elektroauto bis 400 € mit Wärmepumpe',
    recommended: { title: 'Kia EV3 Earth', modelKey: 'ev3' },
    configuration: { trim: 'Earth', powertrain: 'Elektro' },
    variant: { priceLabel: 'ab 299 € / Monat' },
    budget: { maxMonthly: 400, label: 'bis 400 €' },
  },
  sonderwuensche: {
    consultation: {
      entryMode: 'clever',
      consultationProfile: {
        initialWish: 'Elektroauto bis 400 € mit Wärmepumpe',
        answers: {
          annualKm: '15000',
          paymentType: 'leasing',
          monthlyBudget: '400',
          heatPump: 'yes',
          hud: 'yes',
          rangeImportance: 'high',
        },
      },
      cleverRecommendation: {
        vehicleTitle: 'Kia EV3 Earth',
        modelKey: 'ev3',
        trimLabel: 'Earth',
        whyLines: [
          'erfüllt Reichweitenwunsch',
          'Wärmepumpe verfügbar',
          'passt ins Budget',
        ],
      },
      consultationHandoff: {
        lines: [],
        openQuestions: ['Lieferzeit offen'],
        recognizedWishes: ['Wärmepumpe'],
      },
    },
  },
};

assert.ok(hasCleverBeratungData(sampleLead), 'Clever-Daten erkannt');

const view = buildCleverBeratungAkteView(sampleLead);
assert.ok(view, 'View erstellt');
assert.equal(view.customerWish, 'Elektroauto bis 400 € mit Wärmepumpe');
assert.ok(view.requirementChips.some((c) => c.label === 'Elektro'));
assert.ok(view.requirementChips.some((c) => c.label === 'Leasing'));
assert.ok(view.requirementChips.some((c) => c.label === 'Wärmepumpe'));
assert.ok(view.recommendation.headline?.includes('EV3') || view.recommendation.summarySentence?.includes('EV3'));
assert.equal(view.cleverWorld, 'need_consultation');
assert.equal(view.recommendation.trimLabel, null);
assert.equal(view.recommendation.priceLine, null);
assert.ok(view.openQuestions.length >= 1);
assert.equal(view.status.id, 'partial');
assert.ok(view.configuratorUrl?.includes('ev3'));

const minimal = buildCleverBeratungAkteView({
  source: 'dealerJourney',
  inquiryBrief: { searchQuery: 'Familien-SUV' },
});
assert.ok(minimal?.customerWish);
assert.equal(minimal.status.id, 'incomplete');

assert.equal(extractConsultationFromLead({}), null);

console.log('cleverConsultationAkte.test.js: ok');
