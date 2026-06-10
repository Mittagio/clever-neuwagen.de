import {
  DEALER_VEHICLE_IMAGES,
  AI_RENDER_IMAGES,
  IMAGE_SOURCES,
} from '../../data/vehicleImageRegistry.js';
import { resolveManufacturerImageUrl } from '../media/manufacturerMediaService.js';

function slug(value) {
  return (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9|-]/g, '');
}

export function buildModelKeys(brand, model, trim) {
  const b = slug(brand) || 'kia';
  const m = slug(model) || 'fahrzeug';
  const base = `${b}|${m}`;
  const t = trim ? slug(trim) : '';
  return { base, full: t ? `${base}|${t}` : null };
}

function pickVariant(set, variant = 'default') {
  if (!set) return null;
  const key = ['hero', 'card', 'side'].includes(variant) ? variant : 'default';
  return set[key] ?? set.default ?? set.hero ?? set.card ?? null;
}

function lookupDealerImage(dealerId, base, full, variant) {
  if (!dealerId) return null;
  const dealerSet = DEALER_VEHICLE_IMAGES[dealerId];
  if (!dealerSet) return null;
  if (full && dealerSet[full]) return pickVariant(dealerSet[full], variant);
  return pickVariant(dealerSet[base], variant);
}

function lookupAiRender(base, full, variant, vehicleId) {
  if (vehicleId && AI_RENDER_IMAGES[vehicleId]) {
    return pickVariant(AI_RENDER_IMAGES[vehicleId], variant);
  }
  const set = AI_RENDER_IMAGES[full] ?? AI_RENDER_IMAGES[base];
  return pickVariant(set, variant);
}

function result(url, sourceId) {
  const meta = IMAGE_SOURCES[sourceId === 'ai-render' ? 'aiRender' : sourceId];
  return {
    url,
    source: sourceId,
    sourceLabel: meta?.label ?? sourceId,
    priority: meta?.priority ?? null,
  };
}

/**
 * Fahrzeugbild nach Prioritätskette auflösen.
 * 1 Händler → 2 Hersteller (ManufacturerMediaSystem) → 3 Placeholder → 4 KI-Render
 */
export function resolveVehicleImage(options = {}) {
  const {
    brand = 'Kia',
    model,
    trim,
    dealerId,
    bodyType = 'suv',
    variant = 'hero',
    dealerImageUrl,
    allowAiRender = false,
    vehicleId,
    color,
  } = options;

  const { base, full } = buildModelKeys(brand, model, trim);

  if (dealerImageUrl) return result(dealerImageUrl, 'dealer');
  const dealerImg = lookupDealerImage(dealerId, base, full, variant);
  if (dealerImg) return result(dealerImg, 'dealer');

  const oemImg = resolveManufacturerImageUrl(brand, model, { variant, color });
  if (oemImg) return result(oemImg, 'manufacturer');

  if (allowAiRender) {
    const aiImg = lookupAiRender(base, full, variant, vehicleId);
    if (aiImg) return result(aiImg, 'ai-render');
  }

  return { url: null, source: 'placeholder', sourceLabel: IMAGE_SOURCES.placeholder.label, priority: 3 };
}

export function getVehicleImageUrl(options) {
  return resolveVehicleImage(options).url;
}

export function getInventoryDealerImage(inventory = [], { model, trim } = {}) {
  if (!Array.isArray(inventory) || !inventory.length) return null;

  const modelSlug = slug(model);
  const trimSlug = trim ? slug(trim) : '';

  const withImage = inventory.filter((item) => item.image && item.visibleOnLanding !== false);
  if (!withImage.length) return null;

  if (trimSlug) {
    const trimMatch = withImage.find((item) => {
      const eq = slug(item.equipment ?? item.trimLabel ?? '');
      return slug(item.model) === modelSlug && eq.includes(trimSlug);
    });
    if (trimMatch?.image) return trimMatch.image;
  }

  const modelMatch = withImage.find((item) => slug(item.model) === modelSlug);
  return modelMatch?.image ?? withImage[0]?.image ?? null;
}

export function resolveVehicleImageForDealer(options = {}, dealerConditions = null) {
  const dealerId = options.dealerId ?? dealerConditions?.dealerId;
  const inventoryImage = dealerConditions?.inventory
    ? getInventoryDealerImage(dealerConditions.inventory, options)
    : null;

  return resolveVehicleImage({
    ...options,
    dealerId,
    dealerImageUrl: options.dealerImageUrl ?? inventoryImage,
  });
}

export function vehicleImagePropsFromRecommendation(rec, options = {}) {
  if (!rec) return {};

  const dealerId = options.dealerId ?? rec.dealerId;
  const trim = rec.trimId ?? rec.variant;
  const inventory = rec.inventoryMatch;

  return {
    brand: rec.brand,
    model: rec.model,
    trim,
    color: rec.colorId ?? inventory?.colorId,
    dealerId,
    bodyType: rec.bodyType ?? 'suv',
    variant: options.variant ?? 'card',
    vehicleId: rec.vehicleId ?? rec.sourceVehicle?.id,
    dealerImageUrl: inventory?.image,
    allowAiRender: options.allowAiRender ?? false,
    alt: rec.fullLabel,
    placeholderVariant: rec.bodyType ?? 'suv',
  };
}

export function vehicleImagePropsFromOffer(offer, options = {}) {
  if (!offer) return {};

  const v = offer.vehicle ?? {};

  return {
    brand: v.brand ?? 'Kia',
    model: v.model ?? 'Sportage',
    trim: v.trimId ?? v.trim,
    color: v.colorId,
    dealerId: offer.dealer?.dealerId ?? options.dealerId,
    bodyType: v.bodyType ?? 'suv',
    variant: options.variant ?? 'card',
    vehicleId: v.vehicleId ?? offer.id,
    allowAiRender: options.allowAiRender ?? false,
    alt: v.label,
    placeholderVariant: v.bodyType ?? 'suv',
  };
}

export function vehicleImagePropsFromLead(lead, options = {}) {
  if (!lead) return {};

  const v = lead.vehicle ?? {};

  return {
    brand: v.brand ?? 'Kia',
    model: v.model ?? 'Sportage',
    trim: v.trimId ?? v.trim,
    dealerId: lead.dealerId ?? options.dealerId,
    bodyType: v.bodyType ?? 'suv',
    variant: options.variant ?? 'card',
    allowAiRender: false,
    alt: v.label,
    placeholderVariant: v.bodyType ?? 'suv',
  };
}
