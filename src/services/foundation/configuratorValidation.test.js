/**
 * Tests: Foundation Validierung
 */
import assert from 'node:assert/strict';
import { kiaSportageFoundationSeed } from '../../data/foundation/seeds/kiaSportageFoundationSeed.js';
import { createRule } from '../../data/foundation/configuratorFoundationSchema.js';
import { RULE_TYPE, RULE_STATUS } from '../../data/foundation/ruleTypes.js';
import { validateModelYearData } from './configuratorValidation.js';

const result = validateModelYearData(kiaSportageFoundationSeed, 'sportage-2027');
assert.ok(result.summary.errors === 0, `Keine Validierungsfehler, got: ${JSON.stringify(result.issues.filter(i => i.severity === 'error'))}`);

const broken = structuredClone(kiaSportageFoundationSeed);
broken.rules.push(createRule({
  manufacturerId: 'kia',
  modelId: 'sportage',
  modelYearId: 'sportage-2027',
  packageId: 'p4-panorama',
  ruleType: RULE_TYPE.PACKAGE_DEPENDENCY,
  value: { requiredPackageIds: ['p4-panorama'] },
  status: RULE_STATUS.LIVE,
}));

const circular = validateModelYearData(broken, 'sportage-2027');
assert.ok(
  circular.issues.some((i) => i.code === 'self_dependency' || i.code === 'circular_dependency'),
  'Zirkuläre Abhängigkeit erkannt',
);

console.log('configuratorValidation tests OK');
