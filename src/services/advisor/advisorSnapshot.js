/**
 * Einheitliche Snapshots für API, Share-Links und Kundenansicht.
 */

import { getModelLineKey } from '../sales/advisorRanking.js';
import {
  getMatchDisplayTitle,
  getMatchVariantLabel,
} from '../../logic/discoveryDisplay.js';

export function snapshotVehicle(vehicle = {}) {
  return {
    id: vehicle.id,
    slug: vehicle.slug,
    brand: vehicle.brand,
    model: vehicle.model,
    modelKey: vehicle.modelKey,
    imageModel: vehicle.imageModel,
    trim: vehicle.trim,
    trimId: vehicle.trimId,
    bodyType: vehicle.bodyType,
    powertrain: vehicle.powertrain,
    monthlyRate: vehicle.monthlyRate,
    financeRate: vehicle.financeRate,
    cashPrice: vehicle.cashPrice,
    deliveryTime: vehicle.deliveryTime,
    availability: vehicle.availability,
    discountPercent: vehicle.discountPercent,
    rangeKm: vehicle.rangeKm ?? vehicle.wltpRange,
    trunkLiters: vehicle.trunkLiters,
    towCapacityKg: vehicle.towCapacityKg,
    dealerSlug: vehicle.dealerSlug,
    dealerName: vehicle.dealerName,
  };
}

export function snapshotMatch(match) {
  if (!match) return null;
  const v = match.vehicle ?? {};
  return {
    slug: match.slug ?? v.slug,
    model: match.model ?? `${v.brand ?? ''} ${v.model ?? ''}`.trim(),
    title: getMatchDisplayTitle(match),
    trimLabel: getMatchVariantLabel(match),
    modelLineKey: getModelLineKey(v),
    cleverQuote: match.cleverQuote ?? null,
    monthlyRate: match.bestOffer?.monthlyRate ?? v.monthlyRate,
    financeRate: v.financeRate ?? null,
    cashPrice: v.cashPrice ?? null,
    deliveryTime: match.bestOffer?.deliveryTime ?? v.deliveryTime ?? null,
    availability: v.availability ?? null,
    discountPercent: v.discountPercent ?? 0,
    rangeKm: v.rangeKm ?? v.wltpRange ?? null,
    trunkLiters: v.trunkLiters ?? null,
    towCapacityKg: v.towCapacityKg ?? null,
    matchedFeatures: match.matchedFeatures ?? [],
    missingFeatures: match.missingFeatures ?? [],
    vehicle: snapshotVehicle(v),
    bestOffer: match.bestOffer
      ? {
        monthlyRate: match.bestOffer.monthlyRate,
        deliveryTime: match.bestOffer.deliveryTime,
        dealer: match.bestOffer.dealer,
        availability: match.bestOffer.availability,
      }
      : null,
  };
}

export function snapshotModelLineGroup(group) {
  if (!group) return null;
  return {
    modelLineKey: group.modelLineKey,
    label: group.label,
    rank: group.rank,
    variantCount: group.variantCount,
    hasMultipleVariants: group.hasMultipleVariants,
    primaryMatch: snapshotMatch(group.primaryMatch),
    variants: (group.variants ?? []).map(snapshotMatch),
    trimVariants: (group.trimVariants ?? []).map((entry) => ({
      trimKey: entry.trimKey,
      trimLabel: entry.trimLabel,
      isPrimary: entry.isPrimary,
      match: snapshotMatch(entry.match),
    })),
  };
}

export function snapshotDiscoveryResult(result) {
  return {
    matches: (result.matches ?? []).map(snapshotMatch),
    modelLineGroups: (result.modelLineGroups ?? []).map(snapshotModelLineGroup),
    exclusionHint: result.exclusionHint ?? null,
    noExactMatchMessage: result.noExactMatchMessage ?? null,
    eligibleCount: result.eligibleCount ?? 0,
  };
}

export function snapshotSalesResult(result) {
  return {
    matches: (result.matches ?? []).map(snapshotMatch),
    modelLineGroups: (result.modelLineGroups ?? []).map(snapshotModelLineGroup),
    wishes: result.wishes ?? null,
  };
}

export function buildShareCompareRows(matches = []) {
  return matches.map((m) => {
    const snap = snapshotMatch(m);
    return {
      slug: snap.slug,
      title: snap.title,
      trimLabel: snap.trimLabel,
      modelLineKey: snap.modelLineKey,
      cleverQuote: snap.cleverQuote,
      monthlyRate: snap.monthlyRate,
      financeRate: snap.financeRate,
      cashPrice: snap.cashPrice,
      rangeKm: snap.rangeKm ?? '—',
      trunkLiters: snap.trunkLiters ?? '—',
      towCapacityKg: snap.towCapacityKg ?? '—',
      deliveryTime: snap.deliveryTime ?? '—',
      availability: snap.availability,
      discountPercent: snap.discountPercent ?? 0,
      matchedFeatures: snap.matchedFeatures,
      missingFeatures: snap.missingFeatures,
    };
  });
}
