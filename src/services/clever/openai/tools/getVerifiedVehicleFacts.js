/**
 * Tool 2 – Verifizierte Fahrzeugfakten für Modell/Variante.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../../../data/kia/kiaModelAttributes.js';
import { getCleverRecordForModelKey } from '../../../admin/vehicleStammdatenOverrideService.js';
import { resolveElectricSpecs } from '../../../../data/kia/pricelistBatteryLookup.js';
import { buildFactId } from './findMatchingVehicles.js';

const ALLOWED_FACTS = new Set([
  'wltpRange',
  'batteryCapacity',
  'seats',
  'towingCapacity',
  'headUpDisplay',
  'charging',
  'dimensions',
  'listPrice',
  'deliveryTime',
]);

function factEntry({ key, value, unit, status, sourceId, modelKey, variantKey }) {
  if (value == null || value === '') return null;
  if (status !== 'verified') return null;
  return {
    key,
    value,
    unit: unit ?? null,
    status,
    sourceId: sourceId ?? null,
    modelKey,
    variantKey,
    factId: buildFactId(modelKey, variantKey, key),
  };
}

/**
 * @param {{ modelKey: string, variantKey?: string|null, requestedFacts?: string[] }} params
 */
export function getVerifiedVehicleFacts(params = {}) {
  const modelKey = String(params.modelKey ?? '').toLowerCase();
  const variantKey = params.variantKey ?? null;
  const requested = (params.requestedFacts ?? []).filter((f) => ALLOWED_FACTS.has(f));

  if (!modelKey || !KIA_MODEL_ATTRIBUTES[modelKey]) {
    return { facts: [], error: 'unknown_model' };
  }

  const record = getCleverRecordForModelKey(modelKey);
  if (!record) {
    return { facts: [], error: 'no_verified_record' };
  }

  const attrs = KIA_MODEL_ATTRIBUTES[modelKey];
  const electric = resolveElectricSpecs(record);
  const resolvedVariant = variantKey ?? record.trimId ?? null;
  const sourceId = record.sourceId ?? record.id ?? `kia:${modelKey}`;
  const facts = [];

  for (const factKey of requested) {
    switch (factKey) {
      case 'wltpRange': {
        const entry = factEntry({
          key: 'wltpRange',
          value: electric.wltpRangeKm ?? record.electric?.wltpRangeKm ?? attrs.typicalRangeKm ?? null,
          unit: 'km',
          status: (electric.wltpRangeKm ?? record.electric?.wltpRangeKm ?? attrs.typicalRangeKm) != null
            ? 'verified'
            : 'missing',
          sourceId,
          modelKey,
          variantKey: resolvedVariant,
        });
        if (entry) facts.push(entry);
        break;
      }
      case 'batteryCapacity': {
        const kwh = electric.batteryNetKwh ?? electric.batteryGrossKwh ?? record.electric?.batteryNetKwh;
        const entry = factEntry({
          key: 'batteryCapacity',
          value: kwh,
          unit: 'kWh',
          status: kwh != null ? 'verified' : 'missing',
          sourceId,
          modelKey,
          variantKey: resolvedVariant,
        });
        if (entry) facts.push(entry);
        break;
      }
      case 'seats': {
        const seats = record.family?.seats ?? attrs.seats ?? null;
        const entry = factEntry({
          key: 'seats',
          value: seats,
          unit: 'Sitze',
          status: seats != null ? 'verified' : 'missing',
          sourceId,
          modelKey,
          variantKey: resolvedVariant,
        });
        if (entry) facts.push(entry);
        break;
      }
      case 'towingCapacity': {
        const kg = record.towing?.brakedKg ?? attrs.towCapacityKg ?? null;
        const entry = factEntry({
          key: 'towingCapacity',
          value: kg,
          unit: 'kg',
          status: kg != null ? 'verified' : 'missing',
          sourceId,
          modelKey,
          variantKey: resolvedVariant,
        });
        if (entry) facts.push(entry);
        break;
      }
      case 'headUpDisplay': {
        const hud = record.comfort?.headUpDisplay ?? record.features?.headUpDisplay;
        const status = hud === 'standard' || hud === 'package' ? 'verified' : 'missing';
        if (status === 'verified') {
          facts.push({
            key: 'headUpDisplay',
            value: hud,
            unit: null,
            status: 'verified',
            sourceId,
            modelKey,
            variantKey: resolvedVariant,
            factId: buildFactId(modelKey, resolvedVariant, 'headUpDisplay'),
          });
        }
        break;
      }
      case 'charging': {
        const dc = electric.dcCharge10_80Min ?? record.electric?.dcCharge10_80Min;
        const ac = electric.acCharge0_100Min ?? record.electric?.acCharge0_100Min;
        if (dc != null || ac != null) {
          facts.push({
            key: 'charging',
            value: { dcCharge10_80Min: dc ?? null, acCharge0_100Min: ac ?? null },
            unit: 'min',
            status: 'verified',
            sourceId,
            modelKey,
            variantKey: resolvedVariant,
            factId: buildFactId(modelKey, resolvedVariant, 'charging'),
          });
        }
        break;
      }
      case 'dimensions': {
        const dims = record.dimensions;
        if (dims?.lengthMm) {
          facts.push({
            key: 'dimensions',
            value: dims,
            unit: 'mm',
            status: 'verified',
            sourceId,
            modelKey,
            variantKey: resolvedVariant,
            factId: buildFactId(modelKey, resolvedVariant, 'dimensions'),
          });
        }
        break;
      }
      case 'listPrice': {
        const price = record.pricing?.listPriceGross ?? record.price?.listGross ?? null;
        const entry = factEntry({
          key: 'listPrice',
          value: price,
          unit: 'EUR',
          status: price != null ? 'verified' : 'missing',
          sourceId,
          modelKey,
          variantKey: resolvedVariant,
        });
        if (entry) facts.push(entry);
        break;
      }
      case 'deliveryTime': {
        const weeks = record.logistics?.deliveryWeeks ?? record.delivery?.weeks ?? null;
        const entry = factEntry({
          key: 'deliveryTime',
          value: weeks,
          unit: 'weeks',
          status: weeks != null ? 'verified' : 'missing',
          sourceId,
          modelKey,
          variantKey: resolvedVariant,
        });
        if (entry) facts.push(entry);
        break;
      }
      default:
        break;
    }
  }

  return { facts };
}

export function collectFactIdsFromToolResults(toolResults = []) {
  const ids = new Set();
  for (const result of toolResults) {
    if (result.name === 'get_verified_vehicle_facts') {
      for (const fact of result.output?.facts ?? []) {
        if (fact.factId) ids.add(fact.factId);
      }
    }
    if (result.name === 'find_matching_vehicles') {
      for (const match of result.output?.matches ?? []) {
        for (const id of match.verifiedFactIds ?? []) ids.add(id);
      }
      for (const ex of result.output?.exclusions ?? []) {
        for (const id of ex.verifiedFactIds ?? []) ids.add(id);
      }
    }
  }
  return ids;
}
