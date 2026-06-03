import { MANUFACTURER_MEDIA } from '../../data/media/manufacturerImages.js';

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

/**
 * Hersteller-Medien-Eintrag für brand + model
 */
export function getManufacturerMediaEntry(brand, model) {
  const brandKey = slug(brand) || 'kia';
  const modelKey = slug(model);
  if (!modelKey) return null;
  const brandSet = MANUFACTURER_MEDIA[brandKey];
  if (!brandSet) return null;
  if (brandSet[modelKey]) return brandSet[modelKey];
  // z. B. „Sportage“ aus imageModel bei Modell „Tucson“ – erstes Wort des Modells
  const first = modelKey.split('-')[0];
  return brandSet[first] ?? null;
}

/**
 * Bild-URL aus ManufacturerMediaSystem (Priorität 2 in VehicleImage)
 */
export function resolveManufacturerImageUrl(brand, model, options = {}) {
  const entry = getManufacturerMediaEntry(brand, model);
  if (!entry) return null;

  const view = options.view ?? options.variant ?? 'default';
  const normalized = ['hero', 'card', 'side', 'interior'].includes(view) ? view : 'default';

  return entry[normalized] ?? entry.default ?? entry.hero ?? entry.card ?? null;
}

export function listManufacturerModels(brand = 'kia') {
  const brandKey = slug(brand);
  return Object.keys(MANUFACTURER_MEDIA[brandKey] ?? {});
}
