/**
 * Clever-Beratung → Angebot Prefill
 */
import assert from 'node:assert/strict';
import {
  buildCleverConsultationOfferPrefill,
  buildLeadPatchFromCleverPrefill,
} from './cleverConsultationOfferPrefill.js';

const lead = {
  id: 'lead-1',
  paymentType: 'leasing',
  desiredRate: 400,
  inquiryBrief: {
    searchQuery: 'Elektroauto bis 400 € mit Wärmepumpe',
    recommended: { title: 'Kia EV3 Earth', modelKey: 'ev3' },
    configuration: { trim: 'Earth' },
  },
  sonderwuensche: {
    consultation: {
      entryMode: 'clever',
      consultationProfile: {
        initialWish: 'Elektroauto bis 400 € mit Wärmepumpe',
        answers: {
          paymentType: 'leasing',
          monthlyBudget: '400',
          heatPump: 'yes',
        },
      },
      cleverRecommendation: {
        vehicleTitle: 'Kia EV3 Earth',
        modelKey: 'ev3',
        trimId: 'earth',
        trimLabel: 'Earth',
        whyLines: ['passt ins Budget'],
      },
    },
  },
};

const prefill = buildCleverConsultationOfferPrefill(lead);
assert.ok(prefill, 'Prefill erstellt');
assert.equal(prefill.card.modelKey, 'ev3');
assert.equal(prefill.card.trimLabel, 'Earth');
assert.equal(prefill.card.desiredRate, 400);
assert.ok(prefill.cleverTransfer.customerWish.includes('Wärmepumpe'));
assert.ok(prefill.pendingFields.some((f) => f.id === 'mileagePerYear'));
assert.ok(prefill.pendingFields.some((f) => f.id === 'delivery'));

const patch = buildLeadPatchFromCleverPrefill(prefill, lead);
assert.equal(patch.crm.vehicleConfigurations.length, 1);
assert.ok(patch.crm.cleverOfferTransfer);

console.log('cleverConsultationOfferPrefill.test.js: ok');
