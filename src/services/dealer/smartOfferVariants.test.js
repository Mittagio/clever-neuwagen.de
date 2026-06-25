/**
 * Tests: Smart Offer Variants
 */
import assert from 'node:assert/strict';
import { parseDealerAiInput } from '../dealerAiParser.js';
import { buildConfigureDraft } from '../dealerAiVehicleConfigureFlow.js';
import { getDealerSeed } from '../../data/dealers/index.js';
import {
  applyDealerDefaultsToDraft,
  buildSmartOfferVariants,
  recalculateSmartVariant,
  resolveDealerPaymentDefaults,
  SMART_VARIANT_TIERS,
} from './smartOfferVariants.js';

const conditions = getDealerSeed('autohaus-trinkle');

const ev4Text = 'Kia EV4, Leasing, Budget bis 399 €';
const parsed = parseDealerAiInput(ev4Text);
assert.ok(parsed.ok);

const draft = buildConfigureDraft(parsed, conditions);
assert.ok(draft.preparationFee != null, 'Überführung aus Händlerkonditionen');
assert.equal(draft.termMonths, 48);
assert.equal(draft.mileagePerYear, 15000);

const leasingDefaults = resolveDealerPaymentDefaults(conditions, 'ev4', 'leasing', 'vision');
assert.equal(leasingDefaults.paymentType, 'leasing');
assert.ok(leasingDefaults.termMonths);
assert.ok(leasingDefaults.mileagePerYear);

const variants = buildSmartOfferVariants(draft, conditions, parsed.fields);
assert.equal(variants.length, 3, 'Drei Varianten');
assert.equal(variants[0].tierLabel, SMART_VARIANT_TIERS[0].label);
assert.equal(variants[1].tierLabel, SMART_VARIANT_TIERS[1].label);
assert.equal(variants[2].tierLabel, SMART_VARIANT_TIERS[2].label);
assert.ok(variants[0].trimLabel, 'Trim-Label gesetzt');
assert.ok(variants[0].snapshot?.displayAmount != null || variants[0].snapshot?.monthlyRate != null, 'Rate berechnet');

const rates = variants.map((v) => v.snapshot?.displayAmount ?? 0);
assert.ok(rates[0] <= rates[1] || rates[1] == null, 'Basis günstiger oder gleich Empfehlung');

const patched = recalculateSmartVariant({
  ...variants[0],
  draft: { ...variants[0].draft, downPayment: 3000 },
}, conditions);
assert.ok(patched.snapshot, 'Neuberechnung nach Patch');

const withDefaults = applyDealerDefaultsToDraft({ modelKey: 'ev4', paymentType: 'leasing' }, conditions);
assert.ok(withDefaults.termMonths);
assert.ok(withDefaults.preparationFee);

console.log('smartOfferVariants.test.js: alle Tests bestanden');
