/**
 * Verifizierte Knowledge-Lookups für Magic – keine zweite Fahrzeugdatenbank.
 */
import { DEALER_TRIM_PACKAGES, getPackagesForTrim } from '../../../data/dealer/dealerTrimPackages.js';
import { resolveConfigureModel } from '../../configuration/configureModelBridge.js';
import { TRIM_FEATURE_MAP } from '../../../data/features/trimFeatureMapping.js';
import { getVerifiedVehicleFacts } from '../../clever/openai/tools/getVerifiedVehicleFacts.js';

const FEATURE_LABELS = {
  heated_seats: 'Sitzheizung',
  steering_heat: 'Lenkradheizung',
  rear_camera: 'Rückfahrkamera',
  parking_rear: 'Parksensoren hinten',
  blind_spot: 'Totwinkelassistent',
  camera_360: '360° Kamera',
  heat_pump: 'Wärmepumpe',
  towbar: 'Anhängerkupplung',
  head_up_display: 'Head-Up Display',
  harman_kardon: 'Harman Kardon',
};

/**
 * @param {{ model?: string, trim?: string, modelYear?: string|number, engine?: string, modelKey?: string }} params
 */
export function lookupVehicleVariant(params = {}) {
  const modelKey = String(params.modelKey || params.model || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^kia-/, '');
  const trimId = String(params.trim || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/gt.?line/, 'gt-line');

  if (!modelKey) {
    return { ok: false, error: 'model_required', variant: null };
  }

  const modelData = resolveConfigureModel(modelKey);
  const trim = modelData?.trims?.find((t) => t.id === trimId) ?? null;
  const mapping = TRIM_FEATURE_MAP[modelKey] ?? null;

  return {
    ok: true,
    variant: {
      modelKey,
      modelLabel: mapping?.modelLabel || modelData?.name || modelKey,
      trimId: trim?.id || trimId || null,
      trimLabel: trim?.name || (trimId ? trimId.toUpperCase() : null),
      modelYear: params.modelYear ?? null,
      engine: params.engine ?? null,
      evidenceId: `variant:${modelKey}:${trim?.id || trimId || 'unknown'}`,
    },
  };
}

/**
 * @param {{ vehicleKey?: string, modelKey?: string, trim?: string, packageName?: string }} params
 */
export function lookupPackageContents(params = {}) {
  const modelKey = String(params.vehicleKey || params.modelKey || '').toLowerCase();
  const trimId = String(params.trim || '').toLowerCase();
  const packageName = String(params.packageName || '').trim();
  if (!modelKey || !packageName) {
    return { ok: false, error: 'package_query_required', package: null, missing: true };
  }

  const needle = packageName.toLowerCase();
  let dealerPkgs = trimId ? getPackagesForTrim(modelKey, trimId) : [];
  if (!dealerPkgs.length) {
    dealerPkgs = DEALER_TRIM_PACKAGES[modelKey] ?? [];
  }

  const dealerHit = dealerPkgs.find((p) => {
    const hay = `${p.id} ${p.label}`.toLowerCase();
    if (hay.includes(needle) || needle.includes(hay.split(' ')[0])) return true;
    if (needle.includes('technologie') || needle.includes('technik')) {
      return /technologie|technik|tech-paket|tech paket|\btech\b/.test(hay) && !/drivewise/.test(hay);
    }
    if (needle.includes('drivewise')) return /drivewise/.test(hay);
    return false;
  });

  if (dealerHit) {
    const items = (dealerHit.highlights?.length
      ? dealerHit.highlights
      : (dealerHit.features || []).map((f) => FEATURE_LABELS[f] || f)
    ).filter(Boolean);
    return {
      ok: true,
      missing: items.length === 0,
      package: {
        id: dealerHit.id,
        label: dealerHit.label,
        items,
        evidenceId: `package:${modelKey}:${dealerHit.id}`,
        source: 'dealer_trim_packages',
      },
    };
  }

  const modelData = resolveConfigureModel(modelKey);
  const mfgHit = (modelData?.packages ?? []).find((p) => {
    const hay = `${p.id} ${p.name || ''} ${p.description || ''}`.toLowerCase();
    if (hay.includes(needle)) return true;
    if (needle.includes('technologie') || needle.includes('technik')) {
      return /technologie|technik/.test(hay) && !/drivewise/.test(hay);
    }
    if (needle.includes('drivewise')) return /drivewise/.test(hay);
    return false;
  });

  if (mfgHit) {
    const equipment = modelData.equipment ?? [];
    const fromFeatures = (mfgHit.features || [])
      .map((id) => equipment.find((e) => e.id === id)?.name)
      .filter(Boolean);
    const items = (mfgHit.highlights?.length
      ? [...mfgHit.highlights]
      : fromFeatures.length
        ? fromFeatures
        : String(mfgHit.description || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean));
    return {
      ok: true,
      missing: items.length === 0,
      package: {
        id: mfgHit.id,
        label: mfgHit.name || packageName,
        items,
        evidenceId: `package:${modelKey}:${mfgHit.id}`,
        source: 'manufacturer_packages',
      },
    };
  }

  return {
    ok: false,
    missing: true,
    error: 'package_not_verified',
    package: null,
    missingKnowledgeKey: needle.includes('technologie') || needle.includes('technik')
      ? 'exact_technology_package_contents'
      : `package_contents:${packageName}`,
  };
}

/**
 * @param {{ vehicleKey?: string, modelKey?: string, trim?: string, focus?: string }} params
 */
export function lookupRelevantEquipment(params = {}) {
  const modelKey = String(params.vehicleKey || params.modelKey || '').toLowerCase();
  const trimId = String(params.trim || '').toLowerCase();
  if (!modelKey || !trimId) {
    return { ok: false, error: 'equipment_query_required', items: [] };
  }

  const mapping = TRIM_FEATURE_MAP[modelKey];
  const trimMap = mapping?.trims?.find((t) => t.id === trimId);
  if (trimMap?.standardFeatures?.length) {
    const items = trimMap.standardFeatures.map((id) => FEATURE_LABELS[id] || id);
    return {
      ok: true,
      items,
      evidenceId: `equipment:${modelKey}:${trimId}`,
      source: 'trim_feature_mapping',
    };
  }

  const modelData = resolveConfigureModel(modelKey);
  const trim = modelData?.trims?.find((t) => t.id === trimId);
  const equipment = modelData?.equipment ?? [];
  const items = (trim?.baseEquipment ?? [])
    .map((id) => equipment.find((e) => e.id === id)?.name || id)
    .filter(Boolean);

  if (!items.length) {
    return { ok: false, missing: true, items: [], error: 'equipment_not_verified' };
  }

  return {
    ok: true,
    items,
    evidenceId: `equipment:${modelKey}:${trimId}`,
    source: 'manufacturer_equipment',
  };
}

/**
 * @param {{ vehicleKey?: string, modelKey?: string, factType?: string, variantKey?: string }} params
 */
export function lookupVehicleTechnicalFact(params = {}) {
  const modelKey = String(params.vehicleKey || params.modelKey || '').toLowerCase();
  const factType = String(params.factType || '').trim();
  if (!modelKey || !factType) {
    return { ok: false, error: 'fact_query_required', facts: [] };
  }
  return getVerifiedVehicleFacts({
    modelKey,
    variantKey: params.variantKey ?? null,
    requestedFacts: [factType],
  });
}

/**
 * @param {{ offerId?: string, offerContext?: object }} params
 */
export function lookupCurrentOffer(params = {}) {
  const offer = params.offerContext;
  if (!offer && !params.offerId) {
    return { ok: false, error: 'offer_required', offer: null };
  }
  if (!offer) {
    return { ok: false, error: 'offer_not_in_context', offer: null };
  }
  return {
    ok: true,
    offer: {
      offerId: offer.offerId || params.offerId,
      title: offer.title || null,
      monthlyRate: offer.monthlyRate ?? null,
      termMonths: offer.termMonths ?? null,
      mileagePerYear: offer.mileagePerYear ?? null,
      paymentType: offer.paymentType ?? null,
      summary: offer.summary || null,
      evidenceId: `offer:${offer.offerId || params.offerId}`,
      source: 'working_context_offer',
    },
  };
}

/**
 * @param {{ sellerFacts?: object[] }} params
 */
export function lookupSellerVehicleFact(params = {}) {
  const facts = Array.isArray(params.sellerFacts) ? params.sellerFacts : [];
  return {
    ok: true,
    facts: facts.map((f, i) => ({
      type: f.type || f.key || 'seller_fact',
      value: String(f.value ?? f.label ?? ''),
      source: 'seller_input',
      evidenceId: f.evidenceId || `seller:${i}:${f.type || 'fact'}`,
    })),
  };
}
