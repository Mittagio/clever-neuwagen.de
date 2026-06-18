/**
 * Antriebsvarianten pro Modellfamilie (Sportage, Sorento, …).
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';

/** @type {Record<string, { id: string, subline: string }[]>} */
export const MODEL_POWERTRAIN_FAMILIES = {
  sportage: [
    { id: 'sportage', subline: 'Benziner & Diesel' },
    { id: 'sportage-hybrid', subline: 'Hybrid' },
    { id: 'sportage-phev', subline: 'Plug-in Hybrid' },
  ],
  sorento: [
    { id: 'sorento', subline: 'Diesel' },
    { id: 'sorento-hybrid', subline: 'Hybrid' },
    { id: 'sorento-phev', subline: 'Plug-in Hybrid' },
  ],
};

/**
 * @param {string} modelKey
 * @returns {string|null}
 */
export function getModelFamilyBase(modelKey) {
  const key = String(modelKey ?? '').toLowerCase();
  if (key.includes('sportage')) return 'sportage';
  if (key.includes('sorento')) return 'sorento';
  return null;
}

/**
 * @param {string} familyBase
 * @returns {{ modelKey: string, label: string, subline: string }[]}
 */
export function getPowertrainOptionsForFamily(familyBase) {
  const entries = MODEL_POWERTRAIN_FAMILIES[familyBase] ?? [];
  return entries.map(({ id, subline }) => ({
    modelKey: id,
    label: KIA_MODEL_ATTRIBUTES[id]?.label ?? id,
    subline,
  }));
}

/**
 * Antriebsvarianten für Modellfamilien – immer alle Optionen anzeigen.
 * @param {object|null} _searchBundle
 * @param {string} modelKey
 */
export function resolvePowertrainOptionsForModel(_searchBundle, modelKey) {
  const family = getModelFamilyBase(modelKey);
  if (!family) return [];

  const allOptions = getPowertrainOptionsForFamily(family);
  return allOptions.length > 1 ? allOptions : [];
}
