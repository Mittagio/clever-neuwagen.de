/**
 * Sprint 34 Phase C – Wunsch-Chip-Testmatrix für Kia-Registry-Modelle
 * Regel 7: Chip → Paket → CleverQuote ohne stille Fehler
 */
import assert from 'node:assert/strict';
import { KIA_REGISTRY_MODEL_KEYS } from '../../data/kia/kiaPartnerHub.js';
import { MANUFACTURER_MODELS } from '../../data/manufacturer/manufacturerRegistry.js';
import { getSalesChipById } from '../../data/salesAdvisorChips.js';
import { getManufacturerFeatureIds } from '../../data/manufacturer/featureBridge.js';
import { resolveWishConfiguration } from '../configurator/wishPackageResolver.js';
import { analyzeSingleWish } from '../configurator/wishMagicService.js';
import { computeCleverQuote } from '../cleverQuote/cleverQuoteService.js';
import { buildWishesFromChipIds, findSalesAdvisorMatches } from './salesAdvisorService.js';
import { getKiaSalesVehiclePool } from '../../data/kia/kiaPartnerHub.js';

/** MVP-Chips aus Sprint-34-Szenario + Kern-Ausstattung */
const MVP_CHIP_IDS = [
  'heated_seats',
  'camera_360',
  'heat_pump',
  'rear_camera',
  'parking_rear',
  'towbar',
  'panorama_roof',
  'power_tailgate',
  'fuel_elektro',
  'type_suv',
  'budget_400',
];

const MVP_FEATURE_IDS = [
  'heated_seats',
  'camera_360',
  'heat_pump',
  'rear_camera',
  'parking_rear',
  'towbar',
  'panorama_roof',
  'power_tailgate',
  'range_400',
  'family_suv',
  'elektro',
];

/** Golden Cases – bekannte Registry-Auflösungen */
const GOLDEN_CASES = [
  {
    label: 'EV3 Earth · 360° → Technik Paket',
    brand: 'Kia',
    model: 'EV3',
    trimId: 'earth',
    wishId: 'camera_360',
    analyzeStatus: 'package',
    resolverMatched: true,
  },
  {
    label: 'EV3 Earth · Wärmepumpe serienmäßig',
    brand: 'Kia',
    model: 'EV3',
    trimId: 'earth',
    wishId: 'heat_pump',
    analyzeStatus: 'standard',
    resolverMatched: true,
  },
  {
    label: 'EV3 Earth · Sitzheizung serienmäßig',
    brand: 'Kia',
    model: 'EV3',
    trimId: 'earth',
    wishId: 'heated_seats',
    analyzeStatus: 'standard',
    resolverMatched: true,
  },
  {
    label: 'Sportage Spirit · Sitzheizung',
    brand: 'Kia',
    model: 'Sportage',
    trimId: 'spirit',
    wishId: 'heated_seats',
    analyzeStatus: 'standard',
    resolverMatched: true,
  },
  {
    label: 'Sportage Spirit · AHK Zubehör',
    brand: 'Kia',
    model: 'Sportage',
    trimId: 'spirit',
    wishId: 'towbar',
    analyzeStatus: 'accessory',
    resolverMatched: true,
  },
  {
    label: 'Sportage GT-Line · 360° serienmäßig',
    brand: 'Kia',
    model: 'Sportage',
    trimId: 'gt-line',
    wishId: 'camera_360',
    analyzeStatus: 'standard',
    resolverMatched: true,
  },
  {
    label: 'EV4 Earth · 360° → DriveWise ADAS',
    brand: 'Kia',
    model: 'EV4',
    trimId: 'earth',
    wishId: 'camera_360',
    analyzeStatus: 'package',
    resolverMatched: true,
  },
  {
    label: 'EV4 Earth · Wärmepumpe über Winter-Paket',
    brand: 'Kia',
    model: 'EV4',
    trimId: 'earth',
    wishId: 'heat_pump',
    analyzeStatus: 'package',
    resolverMatched: true,
  },
  {
    label: 'EV4 Earth · Sitzheizung serienmäßig',
    brand: 'Kia',
    model: 'EV4',
    trimId: 'earth',
    wishId: 'heated_seats',
    analyzeStatus: 'standard',
    resolverMatched: true,
  },
  {
    label: 'EV4 GT-Line · Harman serienmäßig',
    brand: 'Kia',
    model: 'EV4',
    trimId: 'gt-line',
    wishId: 'harman_kardon',
    analyzeStatus: 'standard',
    resolverMatched: true,
  },
  {
    label: 'Picanto Vision · Sitzheizung serienmäßig',
    brand: 'Kia',
    model: 'Picanto',
    trimId: 'vision',
    wishId: 'heated_seats',
    analyzeStatus: 'standard',
    resolverMatched: true,
  },
  {
    label: 'Picanto Spirit · Totwinkel über DriveWise',
    brand: 'Kia',
    model: 'Picanto',
    trimId: 'spirit',
    wishId: 'blind_spot',
    analyzeStatus: 'package',
    resolverMatched: true,
  },
];

function equipmentIdsForModel(modelKey) {
  const data = MANUFACTURER_MODELS[modelKey]?.data;
  return new Set((data?.equipment ?? []).map((e) => e.id));
}

function featureIsMappedInRegistry(modelKey, featureId) {
  const eqIds = equipmentIdsForModel(modelKey);
  const mfgIds = getManufacturerFeatureIds(featureId);
  return mfgIds.some((id) => eqIds.has(id));
}

function testMvpChipsExist() {
  for (const chipId of MVP_CHIP_IDS) {
    assert.ok(getSalesChipById(chipId), `Chip ${chipId} im Katalog`);
  }
}

function testGoldenCases() {
  for (const c of GOLDEN_CASES) {
    const analysis = analyzeSingleWish({
      brand: c.brand,
      model: c.model,
      trimId: c.trimId,
      wishId: c.wishId,
    });
    assert.ok(analysis?.status, `${c.label}: analyzeSingleWish liefert Status`);
    if (c.analyzeStatus) {
      assert.equal(analysis.status, c.analyzeStatus, `${c.label}: analyzeSingleWish`);
    }

    const resolution = resolveWishConfiguration({
      brand: c.brand,
      model: c.model,
      trimId: c.trimId,
      wishFeatureIds: [c.wishId],
    });
    assert.ok(resolution, `${c.label}: resolveWishConfiguration`);
    assert.equal(resolution.uncertain, undefined, `${c.label}: kein Gesamt-Unklar-Flag`);
    if (c.resolverMatched) {
      assert.ok(
        resolution.matchedFeatures.includes(c.wishId),
        `${c.label}: Wunsch in matchedFeatures`,
      );
    }
  }
}

function testRegistryFeatureMatrix() {
  for (const modelKey of KIA_REGISTRY_MODEL_KEYS) {
    const mfg = MANUFACTURER_MODELS[modelKey];
    assert.ok(mfg, `Registry-Modell ${modelKey}`);

    for (const featureId of MVP_FEATURE_IDS) {
      const resolution = resolveWishConfiguration({
        brand: mfg.brand,
        model: mfg.model,
        trimId: mfg.defaultTrimId,
        wishFeatureIds: [featureId],
        engineId: mfg.defaultEngineId,
      });
      assert.ok(resolution, `${modelKey}/${featureId}: Resolver`);
      assert.notEqual(resolution.trimId, null, `${modelKey}/${featureId}: trimId`);

      const mapped = featureIsMappedInRegistry(modelKey, featureId);
      const isUncertain = resolution.uncertainFeatures?.includes(featureId);

      if (mapped) {
        assert.ok(
          !isUncertain,
          `${modelKey}/${featureId}: Registry-Mapping → nicht uncertain`,
        );
        const resolved = resolution.matchedFeatures.includes(featureId)
          || resolution.missingFeatures.includes(featureId);
        assert.ok(resolved, `${modelKey}/${featureId}: matched oder missing`);
      } else if (featureId === 'heat_pump' && modelKey === 'sportage') {
        assert.ok(isUncertain, `${modelKey}/heat_pump: ohne Mapping → uncertain`);
      }
    }
  }
}

function testCleverQuoteEndToEnd() {
  const chipIds = ['fuel_elektro', 'heated_seats', 'camera_360', 'budget_400', 'type_suv'];
  const wishes = buildWishesFromChipIds(chipIds);
  const pool = getKiaSalesVehiclePool().slice(0, 8);

  for (const vehicle of pool) {
    const quote = computeCleverQuote({ vehicle, wishes });
    if (!quote) continue;
    assert.ok(Array.isArray(quote.items), `CleverQuote items für ${vehicle.model}`);
    assert.ok(
      quote.percent == null || (quote.percent >= 0 && quote.percent <= 100),
      `CleverQuote percent gültig für ${vehicle.model}`,
    );
    for (const item of quote.items) {
      assert.ok(
        ['fulfilled', 'package', 'missing', 'uncertain'].includes(item.status),
        `${vehicle.model}/${item.id}: gültiger Item-Status`,
      );
    }
  }
}

function testSalesFlowWithMvpChips() {
  const matches = findSalesAdvisorMatches(
    ['fuel_elektro', 'heated_seats', 'camera_360', 'budget_400', 'type_suv'],
    { limit: 12 },
  );
  assert.ok(matches.length > 0, 'MVP-Chips liefern Matches');
  assert.ok(matches.every((m) => m.vehicle?.brand === 'Kia'), 'nur Kia');
  assert.ok(
    matches.every((m) => m.cleverQuote && m.cleverQuote.items?.length > 0),
    'jedes Match hat CleverQuote mit Items',
  );

  if (matches.length >= 2) {
    const p0 = matches[0].cleverQuote.percent ?? 0;
    const p1 = matches[1].cleverQuote.percent ?? 0;
    assert.ok(p0 >= p1, 'CleverQuote-Sortierung im Verkaufsflow');
  }
}

testMvpChipsExist();
testGoldenCases();
testRegistryFeatureMatrix();
testCleverQuoteEndToEnd();
testSalesFlowWithMvpChips();

console.log('Sprint 34 Wunsch-Chip-Matrix OK');
