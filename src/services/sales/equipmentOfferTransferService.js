/**
 * Ausstattungswünsche aus Verkäufer-Suche in Verkaufschancen übernehmen.
 */
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import {
  EQUIPMENT_WISH_CREATED_FROM,
  EQUIPMENT_WISH_TYPE,
} from '../../data/equipment/equipmentWishTypes.js';
import {
  buildSalesStatusHeadline,
  salesCustomerTextIsClean,
} from '../admin/equipmentSalesSearchService.js';
import {
  hasInspectableSource,
  normalizeInspectorSourceRef,
} from '../admin/equipmentInspectorSourcePresenter.js';

function createWishId() {
  return `eqw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function variantKey(wish) {
  return `${wish.trimId ?? ''}|${wish.packageId ?? ''}|${wish.recommendedTrimId ?? ''}`;
}

/**
 * @param {object[]} wishes
 * @param {object} nextWish
 * @returns {'none' | 'exact' | 'variant_conflict'}
 */
export function evaluateEquipmentWishDuplicate(wishes = [], nextWish) {
  const match = wishes.find(
    (wish) => wish.featureId === nextWish.featureId && wish.modelKey === nextWish.modelKey,
  );
  if (!match) return 'none';
  if (variantKey(match) === variantKey(nextWish)) return 'exact';
  return 'variant_conflict';
}

/**
 * @param {object} salesResult – Ergebnis von searchSalesEquipment (match/pending)
 */
export function buildEquipmentWishFromSalesResult(salesResult) {
  const { modelEntry, feature, availability, customerText, modelYear, statusHeadline } = salesResult;
  const primaryEntry = availability?.entries?.[0] ?? null;
  const packageInfo = availability?.availablePackages?.[0] ?? null;
  const trimInfo = availability?.availableTrims?.[0] ?? null;

  const trimId = primaryEntry?.trimId ?? trimInfo?.trimId ?? null;
  const trimLabel = primaryEntry?.trimName ?? trimInfo?.trimName ?? null;
  const packageId = primaryEntry?.packageId ?? packageInfo?.id ?? packageInfo?.packageId ?? null;
  const packageLabel = primaryEntry?.packageName ?? packageInfo?.name ?? null;

  const recommendedTrimId = trimInfo?.trimId ?? trimId ?? null;
  const recommendedTrimLabel = trimInfo?.trimName ?? trimLabel ?? null;

  const status = availability?.modelStatus ?? S.UNKNOWN;
  const internalSourceRef = normalizeInspectorSourceRef(primaryEntry?.sourceRef);

  return {
    id: createWishId(),
    type: EQUIPMENT_WISH_TYPE,
    featureId: feature.id,
    featureLabel: feature.label,
    modelKey: modelEntry.modelKey,
    modelLabel: `${modelEntry.brand} ${modelEntry.model}`.trim(),
    modelYear: modelYear ?? null,
    status,
    statusLabel: statusHeadline ?? buildSalesStatusHeadline(availability),
    trimId,
    trimLabel,
    packageId,
    packageLabel,
    recommendedTrimId: status === S.AVAILABLE || status === S.STANDARD ? recommendedTrimId : null,
    recommendedTrimLabel: status === S.AVAILABLE || status === S.STANDARD ? recommendedTrimLabel : null,
    customerText: customerText,
    internalSourceRef,
    confidence: availability?.confidence ?? primaryEntry?.confidence ?? 'medium',
    createdFrom: EQUIPMENT_WISH_CREATED_FROM.salesSearch,
    createdAt: new Date().toISOString(),
  };
}

/**
 * @param {object} wish
 */
export function buildSourceDetailFromEquipmentWish(wish) {
  const ref = wish.internalSourceRef ?? {};
  const sourceBlock = {
    document: ref.document ?? null,
    section: ref.section ?? null,
    page: ref.page ?? null,
    rawText: ref.rawText ?? null,
    url: ref.url ?? null,
    confidence: wish.confidence ?? 'medium',
    trimName: wish.trimLabel ?? wish.recommendedTrimLabel ?? null,
    packageName: wish.packageLabel ?? null,
  };

  const modelParts = (wish.modelLabel ?? '').trim().split(/\s+/);
  const brand = modelParts[0] ?? '';
  const model = modelParts.slice(1).join(' ') || modelParts[0] || '';

  const detail = {
    featureLabel: wish.featureLabel,
    featureId: wish.featureId,
    brand,
    model,
    modelYear: wish.modelYear ?? null,
    trimName: wish.trimLabel ?? wish.recommendedTrimLabel ?? null,
    trimId: wish.trimId ?? wish.recommendedTrimId ?? null,
    status: wish.status,
    statusDescription: wish.statusLabel,
    packageName: wish.packageLabel ?? null,
    confidence: wish.confidence ?? 'medium',
    hasSource: hasInspectableSource(sourceBlock),
    contradictory: false,
    contradictionNote: null,
    sources: hasInspectableSource(sourceBlock) ? [sourceBlock] : [],
  };

  const sourceHint = sourceBlock.document
    ? `Quelle: ${sourceBlock.document}${sourceBlock.page != null ? `, Seite ${sourceBlock.page}` : ''}.`
    : 'Keine Quelle hinterlegt.';

  return {
    ...detail,
    copyText: `${wish.modelLabel} – ${wish.featureLabel}: ${wish.statusLabel}. ${sourceHint}`,
  };
}

/**
 * @param {object} lead
 * @param {object} salesResult
 * @param {{ forceUpdate?: boolean }} [options]
 */
export function transferEquipmentWishToLead(lead, salesResult, options = {}) {
  if (!lead) {
    return {
      ok: false,
      code: 'no_lead',
      message: 'Keine Verkaufschance ausgewählt.',
    };
  }

  const wish = buildEquipmentWishFromSalesResult(salesResult);
  const wishes = [...(lead.equipmentWishes ?? [])];
  const duplicate = evaluateEquipmentWishDuplicate(wishes, wish);

  if (duplicate === 'exact') {
    return {
      ok: false,
      code: 'duplicate',
      message: 'Diese Ausstattung ist bereits in der Verkaufschance enthalten.',
      wish,
      existingWish: wishes.find(
        (item) => item.featureId === wish.featureId && item.modelKey === wish.modelKey,
      ),
    };
  }

  if (duplicate === 'variant_conflict' && !options.forceUpdate) {
    return {
      ok: false,
      code: 'variant_conflict',
      message: 'Diese Ausstattung ist bereits vorhanden. Möchten Sie die Variante aktualisieren?',
      wish,
      existingWish: wishes.find(
        (item) => item.featureId === wish.featureId && item.modelKey === wish.modelKey,
      ),
    };
  }

  let nextWishes;
  if (duplicate === 'variant_conflict' && options.forceUpdate) {
    nextWishes = wishes.map((item) => (
      item.featureId === wish.featureId && item.modelKey === wish.modelKey
        ? { ...wish, id: item.id, createdAt: item.createdAt, updatedAt: new Date().toISOString() }
        : item
    ));
    return {
      ok: true,
      code: 'updated',
      message: `${wish.featureLabel} wurde aktualisiert.`,
      wish,
      equipmentWishes: nextWishes,
    };
  }

  nextWishes = [...wishes, wish];
  return {
    ok: true,
    code: 'added',
    message: `${wish.featureLabel} wurde zur Verkaufschance hinzugefügt.`,
    wish,
    equipmentWishes: nextWishes,
  };
}

/**
 * Stub: neue Verkaufschance mit Wunsch starten.
 * @param {object} salesResult
 */
export function buildNewSalesChanceStarterPayload(salesResult) {
  const wish = buildEquipmentWishFromSalesResult(salesResult);
  return {
    source: 'equipment_sales_search',
    equipmentWishes: [wish],
    vehicle: {
      brand: salesResult.modelEntry.brand,
      model: salesResult.modelEntry.model,
      modelKey: salesResult.modelEntry.modelKey,
    },
    notes: `Ausstattungswunsch: ${wish.featureLabel} (${wish.modelLabel})`,
  };
}

/**
 * @param {object} wish
 */
export function equipmentWishCustomerTextIsClean(wish) {
  return salesCustomerTextIsClean(wish?.customerText);
}

/**
 * @param {object} wish
 */
export function equipmentWishKeepsInternalSource(wish) {
  const ref = wish?.internalSourceRef;
  if (!ref) return false;
  return Boolean(ref.document || ref.rawText || ref.page != null || ref.section);
}

/**
 * Legacy-Payload aus Verkäufer-Suche (Abwärtskompatibilität für Tests).
 * @param {object} salesResult
 */
export function buildSalesOfferTransferPayload(salesResult) {
  return buildEquipmentWishFromSalesResult(salesResult);
}
