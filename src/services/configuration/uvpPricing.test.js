/**
 * Tests: UVP-Preislogik (ohne Händler-Rabatte)
 */
import assert from 'node:assert/strict';
import { buildConfigureDraft } from '../dealerAiVehicleConfigureFlow.js';
import { parseDealerAiInput } from '../dealerAiParser.js';
import { getDealerSeed } from '../../data/dealers/index.js';
import { computeUvpPricing, formatUvpLineAmount } from './uvpPricing.js';
import { buildVehicleConfiguration } from './vehicleConfigurationModel.js';
import { buildOfferConditionsFromDraft } from './offerConditionsModel.js';
import { buildOfferPreviewResult } from './offerPreviewBuilder.js';

const conditions = getDealerSeed('autohaus-trinkle');
const parsed = parseDealerAiInput('Kia Sportage Vision Plug-in Hybrid, Leasing 48 Monate');
const draft = buildConfigureDraft(parsed, conditions);

assert.ok(parsed.ok);
assert.ok(draft.modelKey, 'Modell soll erkannt werden');

const uvp = computeUvpPricing(draft);
assert.ok(uvp, 'UVP-Berechnung soll liefern');
assert.ok(uvp.uvpBasePrice > 0, 'UVP-Basispreis soll positiv sein');
assert.ok(uvp.uvpConfigurationPrice >= uvp.uvpBasePrice, 'Konfigurationspreis >= Basis');
assert.equal(uvp.lineItems[0].type, 'base');
assert.equal(uvp.lineItems[0].label, 'UVP Fahrzeug');

const config = buildVehicleConfiguration(draft);
assert.equal(config.uvpConfigurationPrice, uvp.uvpConfigurationPrice);
assert.ok(Array.isArray(config.uvpLineItems));

const offerConditions = buildOfferConditionsFromDraft(draft, conditions);
const preview = buildOfferPreviewResult(config, offerConditions, conditions);
assert.ok(preview.offerCalculation, 'Angebotsberechnung soll getrennt von UVP laufen');
assert.ok(preview.monthlyRate != null, 'Rate erst in Angebotsvorschau');
assert.equal(preview.uvpConfigurationPrice, config.uvpConfigurationPrice);

assert.equal(formatUvpLineAmount(0), 'Serie');
assert.equal(formatUvpLineAmount(1890), '+1.890 €');

console.log('uvpPricing.test.js: OK');
