/**
 * Tool 1 – Fahrzeuge anhand harter Kriterien aus verifizierten Stammdaten.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../../../data/kia/kiaModelAttributes.js';
import { getCleverRecordForModelKey } from '../../../admin/vehicleStammdatenOverrideService.js';
import { resolveElectricSpecs } from '../../../../data/kia/pricelistBatteryLookup.js';
import { resolveVerifiedTowingCapacity } from './resolveVerifiedTowingCapacity.js';

const PRIMARY_MODEL_KEYS = Object.keys(KIA_MODEL_ATTRIBUTES).filter(
  (key) => !key.endsWith('-gt') && !key.includes('-hybrid') && !key.includes('-phev'),
);

function normalizeFuel(value = '') {
  const v = String(value).toLowerCase();
  if (v === 'electric' || v === 'elektro') return 'electric';
  if (v === 'hybrid' || v === 'hev') return 'hybrid';
  if (v === 'phev' || v === 'plugin_hybrid' || v === 'plugin-hybrid') return 'plugin_hybrid';
  if (v === 'combustion' || v === 'verbrenner' || v === 'benzin') return 'combustion';
  return v;
}

function bodyMatches(attrs, bodyType) {
  if (!bodyType) return true;
  const wanted = String(bodyType).toLowerCase();
  if (wanted === 'suv') {
    return ['suv', 'compact_suv', 'family_suv', 'large_suv'].includes(attrs.bodyClass)
      || attrs.bodyType === 'suv';
  }
  if (wanted === 'kleinwagen') {
    return attrs.bodyClass === 'kleinwagen' || attrs.bodyType === 'kleinwagen';
  }
  return attrs.bodyType === wanted || attrs.bodyClass === wanted;
}

function fuelMatches(attrs, fuelType, hybridPowertrain) {
  if (!fuelType) return true;
  const wanted = normalizeFuel(fuelType);
  const modelFuel = normalizeFuel(attrs.fuel);

  if (wanted === 'electric') {
    return modelFuel === 'electric' || attrs.availableAsElectric;
  }
  if (wanted === 'hybrid') {
    if (hybridPowertrain === 'phev') return modelFuel === 'plugin_hybrid';
    if (hybridPowertrain === 'hev') return modelFuel === 'hybrid';
    return modelFuel === 'hybrid' || modelFuel === 'plugin_hybrid' || attrs.powertrains?.includes('hybrid');
  }
  if (wanted === 'plugin_hybrid') return modelFuel === 'plugin_hybrid';
  return modelFuel === wanted || attrs.powertrains?.includes(String(fuelType));
}

function buildFactId(modelKey, variantKey, factKey) {
  return `fact:${modelKey}:${variantKey || 'default'}:${factKey}`;
}

function readTowingKg(attrs, record, modelKey) {
  const resolved = resolveVerifiedTowingCapacity(modelKey, record, attrs);
  if (!resolved) return null;
  if (typeof resolved.value === 'number') return resolved.value;
  if (resolved.maxKg != null) return resolved.maxKg;
  return null;
}

function readSeats(attrs, record) {
  return record?.family?.seats ?? attrs.seats ?? null;
}

function readWltpRange(record) {
  const specs = resolveElectricSpecs(record ?? {});
  return specs.wltpRangeKm ?? record?.electric?.wltpRangeKm ?? null;
}

function readListPrice(record) {
  const price = record?.pricing?.listPriceGross
    ?? record?.pricing?.listPriceNet
    ?? record?.price?.listGross
    ?? null;
  return price != null ? Number(price) : null;
}

/**
 * @param {object} criteria
 */
export function findMatchingVehicles(criteria = {}) {
  const matches = [];
  const exclusions = [];
  const excludedKeys = new Set((criteria.excludedModelKeys ?? []).map(String));
  const interestedKeys = new Set((criteria.interestedModelKeys ?? []).map(String));

  const candidateKeys = interestedKeys.size
    ? [...interestedKeys]
    : PRIMARY_MODEL_KEYS;

  for (const modelKey of candidateKeys) {
    if (excludedKeys.has(modelKey)) continue;

    const attrs = KIA_MODEL_ATTRIBUTES[modelKey];
    if (!attrs) {
      exclusions.push({
        modelKey,
        reason: 'Unbekanntes Modell in der Registry.',
        verifiedFactIds: [],
      });
      continue;
    }

    const record = getCleverRecordForModelKey(modelKey);
    const variantKey = record?.trimId ?? null;
    const seats = readSeats(attrs, record);
    const towingKg = readTowingKg(attrs, record, modelKey);
    const wltpRange = readWltpRange(record);
    const listPrice = readListPrice(record);

    const reasons = [];
    const factIds = [];

    if (criteria.minimumSeats != null && (seats ?? 0) < criteria.minimumSeats) {
      exclusions.push({
        modelKey,
        reason: `Nur ${seats ?? '?'} Sitze – mindestens ${criteria.minimumSeats} erforderlich.`,
        verifiedFactIds: seats != null ? [buildFactId(modelKey, variantKey, 'seats')] : [],
      });
      continue;
    }

    if (!bodyMatches(attrs, criteria.bodyType)) {
      exclusions.push({
        modelKey,
        reason: `Karosserie passt nicht zu ${criteria.bodyType}.`,
        verifiedFactIds: [buildFactId(modelKey, variantKey, 'bodyType')],
      });
      continue;
    }

    if (!fuelMatches(attrs, criteria.fuelType, criteria.hybridPowertrain)) {
      exclusions.push({
        modelKey,
        reason: `Antrieb passt nicht zu ${criteria.fuelType}.`,
        verifiedFactIds: [buildFactId(modelKey, variantKey, 'fuel')],
      });
      continue;
    }

    if (criteria.minimumTowingCapacityKg != null) {
      if ((towingKg ?? 0) < criteria.minimumTowingCapacityKg) {
        exclusions.push({
          modelKey,
          reason: `Anhängelast ${towingKg ?? '?'} kg unter ${criteria.minimumTowingCapacityKg} kg.`,
          verifiedFactIds: towingKg != null ? [buildFactId(modelKey, variantKey, 'towingCapacity')] : [],
        });
        continue;
      }
      reasons.push(`Anhängelast ${towingKg} kg`);
      factIds.push(buildFactId(modelKey, variantKey, 'towingCapacity'));
    }

    if (criteria.minimumWltpRangeKm != null) {
      if ((wltpRange ?? 0) < criteria.minimumWltpRangeKm) {
        exclusions.push({
          modelKey,
          reason: `WLTP ${wltpRange ?? '?'} km unter ${criteria.minimumWltpRangeKm} km.`,
          verifiedFactIds: wltpRange != null ? [buildFactId(modelKey, variantKey, 'wltpRange')] : [],
        });
        continue;
      }
      reasons.push(`WLTP ${wltpRange} km`);
      factIds.push(buildFactId(modelKey, variantKey, 'wltpRange'));
    }

    if (criteria.maximumListPrice != null && listPrice != null && listPrice > criteria.maximumListPrice) {
      exclusions.push({
        modelKey,
        reason: `Listenpreis über Budget (${listPrice} €).`,
        verifiedFactIds: [buildFactId(modelKey, variantKey, 'listPrice')],
      });
      continue;
    }

    if (seats != null) {
      reasons.push(`${seats} Sitze`);
      factIds.push(buildFactId(modelKey, variantKey, 'seats'));
    }

    matches.push({
      modelKey,
      variantKey,
      displayName: attrs.label,
      verifiedReasons: reasons,
      verifiedFactIds: [...new Set(factIds)],
    });
  }

  return { matches, exclusions };
}

export { buildFactId, PRIMARY_MODEL_KEYS };
