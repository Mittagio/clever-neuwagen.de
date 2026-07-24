/**
 * Einheitliche Fahrzeugkachel-Darstellung (Display-only).
 * UVP / PS / Reichweite / Anhängelast nur aus verifizierten Quellen – nichts erfinden.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { getKiaModelMediaEntry } from '../../data/kia/kiaModelImages.js';
import {
  formatKiaPriceFrom,
  getKiaOfficialModel,
  getKiaOfficialModelsByRegistryKey,
} from '../../data/kia/kiaOfficialPriceList.js';
import { getVerifiedTechnicalProfile } from '../../data/technical/verifiedTechnicalDataRegistry.js';
import { getVerifiedVehicleFacts } from '../clever/openai/tools/getVerifiedVehicleFacts.js';
import { resolveVerifiedTowingCapacity } from '../clever/openai/tools/resolveVerifiedTowingCapacity.js';
import pricelistCatalog from '../../data/kia/pricelist-imports/catalog.js';

export const MAX_VEHICLE_MODEL_CARDS = 4;

function normalizeModelKey(modelKey = '') {
  return String(modelKey ?? '').toLowerCase().replace(/^kia-/, '').trim();
}

function baseRegistryKey(modelKey = '') {
  const key = normalizeModelKey(modelKey);
  if (key.startsWith('sportage')) return 'sportage';
  if (key.startsWith('sorento')) return 'sorento';
  if (key.startsWith('ev9')) return 'ev9';
  if (key.startsWith('ev6')) return 'ev6';
  if (key.startsWith('ev5')) return 'ev5';
  if (key.startsWith('ev4')) return 'ev4';
  if (key.startsWith('ev3')) return 'ev3';
  if (key.startsWith('ev2')) return 'ev2';
  return key.replace(/-gt$/, '').split('-')[0] || key;
}

function parsePsFromText(text = '') {
  const m = String(text).match(/\((\d{2,4})\s*PS\)/i)
    || String(text).match(/\b(\d{2,4})\s*PS\b/i);
  return m ? Number(m[1]) : null;
}

function resolvePsFromPricelist(modelKey) {
  const key = normalizeModelKey(modelKey);
  const family = baseRegistryKey(key);
  const values = [];
  for (const [catalogKey, entry] of Object.entries(pricelistCatalog ?? {})) {
    if (catalogKey !== key && !catalogKey.startsWith(family)) continue;
    for (const variant of entry?.variants ?? []) {
      const ps = parsePsFromText(variant.power) || parsePsFromText(variant.engine);
      if (ps != null && Number.isFinite(ps)) values.push(ps);
    }
  }
  return values;
}

export function isElectricModel(modelKeyOrAttrs = {}) {
  if (typeof modelKeyOrAttrs === 'string') {
    const attrs = KIA_MODEL_ATTRIBUTES[normalizeModelKey(modelKeyOrAttrs)] ?? {};
    return attrs.fuel === 'electric' || attrs.availableAsElectric === true
      || (attrs.powertrains ?? []).includes('elektro');
  }
  const attrs = modelKeyOrAttrs ?? {};
  return attrs.fuel === 'electric' || attrs.availableAsElectric === true
    || (attrs.powertrains ?? []).includes('elektro');
}

/**
 * Kundenwunsch auf ≥7 Sitze?
 */
export function needsSevenSeats(needProfile = {}, notepadLabels = []) {
  if (Number(needProfile.seatsNeeded) >= 7) return true;
  if (Number(needProfile.persons) >= 7) return true;
  const blob = [
    ...(notepadLabels ?? []),
    ...(needProfile.understoodLabels ?? []),
    ...(needProfile.extraLabels ?? []),
  ].join(' ');
  return /mindestens\s*7|7\s*sitze|sieben\s*sitze/i.test(blob);
}

/**
 * @param {string} modelKey
 * @returns {number|null}
 */
export function resolveVerifiedUvpFrom(modelKey) {
  const key = normalizeModelKey(modelKey);
  const direct = getKiaOfficialModel(key) ?? getKiaOfficialModel(modelKey);
  if (direct?.priceFromGross != null) return direct.priceFromGross;

  const byRegistry = getKiaOfficialModelsByRegistryKey(baseRegistryKey(key))
    .filter((m) => m.priceFromGross != null)
    .sort((a, b) => a.priceFromGross - b.priceFromGross);
  if (byRegistry.length) return byRegistry[0].priceFromGross;

  const familyId = baseRegistryKey(key);
  const familyDirect = getKiaOfficialModel(familyId);
  if (familyDirect?.priceFromGross != null) return familyDirect.priceFromGross;

  // Preislisten-Import als Fallback
  const catalog = pricelistCatalog?.[key] ?? pricelistCatalog?.[familyId];
  if (catalog?.priceFromGross != null) return Number(catalog.priceFromGross);

  const facts = getVerifiedVehicleFacts({
    modelKey: key,
    requestedFacts: ['listPrice'],
  });
  const price = facts.facts?.find((f) => f.key === 'listPrice' && f.status === 'verified')?.value;
  return price != null && Number.isFinite(Number(price)) ? Number(price) : null;
}

/**
 * @param {string} modelKey
 * @returns {{ min: number, max: number }|null}
 */
export function resolveVerifiedPowerPsRange(modelKey) {
  const key = normalizeModelKey(modelKey);
  const family = baseRegistryKey(key);
  const values = [];

  for (const profileKey of [key, `${family}-hybrid`, `${family}-phev`, `${family}-gt`, family]) {
    const profile = getVerifiedTechnicalProfile(profileKey);
    for (const variant of profile?.variants ?? []) {
      if (variant.powerPs != null && Number.isFinite(Number(variant.powerPs))) {
        values.push(Number(variant.powerPs));
      }
    }
  }

  values.push(...resolvePsFromPricelist(key));

  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * WLTP-Reichweite für Elektro – von–bis über Varianten/Familie, sonst Einzelwert.
 * @param {string} modelKey
 * @returns {{ min: number, max: number }|null}
 */
export function resolveVerifiedRangeKmRange(modelKey) {
  const key = normalizeModelKey(modelKey);
  if (!isElectricModel(key)) return null;

  const values = [];
  const family = baseRegistryKey(key);

  for (const [attrKey, attrs] of Object.entries(KIA_MODEL_ATTRIBUTES)) {
    if (!attrKey.startsWith(family)) continue;
    if (!isElectricModel(attrs)) continue;
    if (attrs.typicalRangeKm != null && Number.isFinite(Number(attrs.typicalRangeKm))) {
      values.push(Number(attrs.typicalRangeKm));
    }
  }

  const facts = getVerifiedVehicleFacts({
    modelKey: key,
    requestedFacts: ['wltpRange'],
  });
  const factValue = facts.facts?.find((f) => f.key === 'wltpRange' && f.status === 'verified')?.value;
  if (factValue != null && Number.isFinite(Number(factValue))) {
    values.push(Number(factValue));
  }

  const profile = getVerifiedTechnicalProfile(key);
  for (const variant of profile?.variants ?? []) {
    if (variant.wltpRangeKm != null && Number.isFinite(Number(variant.wltpRangeKm))) {
      values.push(Number(variant.wltpRangeKm));
    }
  }

  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * @param {string} modelKey
 * @returns {number|string|null}
 */
export function resolveVerifiedTowingKg(modelKey) {
  const key = normalizeModelKey(modelKey);
  const attrs = KIA_MODEL_ATTRIBUTES[key] ?? null;
  const resolved = resolveVerifiedTowingCapacity(key, null, attrs);
  return resolved?.value ?? null;
}

export function shouldEmphasizeTowing(needProfile = {}, customerText = '') {
  if (needProfile?.towCapacityKg || needProfile?.towing) return true;
  if (needProfile?.usage?.some?.((u) => /anhäng|anhaeng|zug/i.test(String(u)))) return true;
  return /anhäng|anhaeng|zuglast|tow/i.test(String(customerText ?? ''));
}

function formatTowingValue(value) {
  if (value == null) return null;
  if (typeof value === 'string' && /[–\-]/.test(value)) {
    return `${value.replace(/\s/g, '')} kg`;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n.toLocaleString('de-DE')} kg`;
}

function formatPowerLabel(range) {
  if (!range) return null;
  if (range.min === range.max) return `${range.min} PS`;
  return `${range.min}–${range.max} PS`;
}

function formatRangeLabel(range) {
  if (!range) return null;
  const min = Number(range.min).toLocaleString('de-DE');
  const max = Number(range.max).toLocaleString('de-DE');
  if (range.min === range.max) return `${min} km WLTP`;
  return `${min}–${max} km WLTP`;
}

/**
 * Match-Chips auf der Kachel (nur was Kunde will UND Modell erfüllt).
 * @param {string} modelKey
 * @param {{ needProfile?: object, notepadLabels?: string[], customerText?: string }} [options]
 */
export function buildModelMatchChips(modelKey, options = {}) {
  const key = normalizeModelKey(modelKey);
  const attrs = KIA_MODEL_ATTRIBUTES[key] ?? {};
  const needProfile = options.needProfile ?? {};
  const notepadLabels = options.notepadLabels ?? needProfile.understoodLabels ?? [];
  const blob = [
    ...(notepadLabels ?? []),
    ...(needProfile.extraLabels ?? []),
    options.customerText,
  ].filter(Boolean).join(' ');

  const chips = [];
  if (needsSevenSeats(needProfile, notepadLabels) && (attrs.seats ?? 0) >= 7) {
    chips.push('7 Sitze');
  } else if (/\b7\s*sitze\b/i.test(blob) && (attrs.seats ?? 0) >= 7) {
    chips.push('7 Sitze');
  }

  if ((needProfile.bodyType === 'suv' || /\bsuv\b/i.test(blob)) && attrs.bodyType === 'suv') {
    chips.push('SUV');
  }

  if (shouldEmphasizeTowing(needProfile, options.customerText)) {
    const tow = resolveVerifiedTowingKg(key);
    if (tow != null) chips.push(formatTowingValue(tow));
  }

  if ((needProfile.fuel === 'electric' || needProfile.fuel === 'elektro' || /\belektro\b/i.test(blob))
    && isElectricModel(attrs)) {
    chips.push('Elektro');
  }

  return [...new Set(chips)].slice(0, 3);
}

/**
 * @param {string} modelKey
 * @param {{
 *   needProfile?: object,
 *   notepadLabels?: string[],
 *   customerText?: string,
 *   reason?: string|null,
 *   subtitle?: string|null,
 *   fitHints?: string[],
 *   highlighted?: boolean,
 *   emphasizeTowing?: boolean,
 * }} [options]
 */
export function buildVehicleModelCard(modelKey, options = {}) {
  if (!modelKey) return null;
  const key = normalizeModelKey(modelKey);
  const attrs = KIA_MODEL_ATTRIBUTES[key] ?? KIA_MODEL_ATTRIBUTES[modelKey] ?? {};
  const name = attrs.label ?? String(modelKey).replace(/^kia-/i, '');
  const electric = isElectricModel(attrs);
  const emphasizeTowing = options.emphasizeTowing
    ?? shouldEmphasizeTowing(options.needProfile, options.customerText);

  const towingKg = emphasizeTowing ? resolveVerifiedTowingKg(key) : null;
  const uvpFrom = resolveVerifiedUvpFrom(key);
  const powerRange = resolveVerifiedPowerPsRange(key);
  const rangeKm = electric ? resolveVerifiedRangeKmRange(key) : null;
  const image = getKiaModelMediaEntry(key, 'card').card
    || getKiaModelMediaEntry(key, 'hero').hero
    || getKiaModelMediaEntry(modelKey, 'card').card
    || null;

  const matchChips = buildModelMatchChips(key, options);
  // Sitze nicht doppelt in meta, wenn schon Match-Chip
  const metaParts = [];
  if (attrs.seats && !matchChips.includes('7 Sitze') && !matchChips.some((c) => /\d+\s*Sitze/.test(c))) {
    metaParts.push(`${attrs.seats} Sitze`);
  }

  return {
    modelKey: key || modelKey,
    name,
    image,
    isElectric: electric,
    subtitle: options.subtitle
      ?? (emphasizeTowing && towingKg
        ? null
        : (!matchChips.includes('SUV') && attrs.bodyType === 'suv' ? 'SUV' : null)),
    contextAnswer: towingKg
      ? {
        label: 'Anhängelast',
        value: formatTowingValue(towingKg),
      }
      : null,
    uvpLabel: uvpFrom != null ? `UVP ab ${formatKiaPriceFrom(uvpFrom)}` : null,
    uvpFrom,
    powerLabel: powerRange ? formatPowerLabel(powerRange) : null,
    powerRange,
    rangeLabel: rangeKm ? formatRangeLabel(rangeKm) : null,
    rangeKm,
    matchChips,
    metaLine: metaParts.slice(0, 2).join(' · ') || null,
    reason: options.reason ?? null,
    fitHints: (options.fitHints ?? []).slice(0, 2),
    highlighted: Boolean(options.highlighted),
  };
}

/**
 * @param {Array<{ modelKey: string, status?: string, reason?: string }>} vehicleDirections
 * @param {{ needProfile?: object, customerText?: string, max?: number }} [options]
 */
export function buildVehicleModelCardsFromAiDirections(vehicleDirections = [], options = {}) {
  const max = Math.min(MAX_VEHICLE_MODEL_CARDS, options.max ?? MAX_VEHICLE_MODEL_CARDS);
  return vehicleDirections
    .filter((d) => d?.modelKey && (d.status === 'candidate' || d.status === 'interesting' || !d.status))
    .slice(0, max)
    .map((d) => buildVehicleModelCard(d.modelKey, {
      needProfile: options.needProfile,
      notepadLabels: options.notepadLabels,
      customerText: options.customerText,
      reason: d.reason ?? null,
      emphasizeTowing: options.emphasizeTowing,
    }))
    .filter(Boolean);
}

/**
 * @param {Array<object>} directions
 * @param {{ needProfile?: object, customerText?: string, notepadLabels?: string[] }} [options]
 */
export function enrichDirectionsWithCardData(directions = [], options = {}) {
  return (directions ?? []).map((direction) => {
    const card = buildVehicleModelCard(direction.modelKey, {
      needProfile: options.needProfile,
      notepadLabels: options.notepadLabels,
      customerText: options.customerText,
      subtitle: direction.subtitle,
      fitHints: direction.fitHints,
      highlighted: direction.highlighted,
      reason: direction.fitHints?.[0] ?? null,
    });
    return { ...direction, card };
  });
}
