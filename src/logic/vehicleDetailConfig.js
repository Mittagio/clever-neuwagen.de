import { kiaSportage } from '../data/models/kia/sportage.js';
import { getManufacturerModel } from '../data/manufacturer/manufacturerRegistry.js';

export const LEASING_TERMS = [36, 48, 60];
export const LEASING_MILEAGES = [10000, 15000, 20000, 25000];
export const LEASING_DOWN_PAYMENTS = [0, 3000, 6000, 9000];
export const FINANCE_TERMS = [36, 48, 60];
export const FINANCE_DOWN_PAYMENTS = [0, 5000, 10000, 15000];
export const FINANCE_BALLOONS = [0, 5000, 10000];

/** EV3 – vereinfachte Farbauswahl (Demo) */
export const EV3_COLORS = [
  { id: 'ev3-white', name: 'Schneeweiß', hex: '#f8fafc', mapSportageId: 'carraraweiss' },
  { id: 'ev3-gray', name: 'Grau', hex: '#94a3b8', mapSportageId: 'wolfgrau' },
  { id: 'ev3-black', name: 'Schwarz', hex: '#1e293b', mapSportageId: 'zilinaschwarz' },
  { id: 'ev3-blue', name: 'Blau', hex: '#3b82f6', mapSportageId: 'blueflame' },
];

export function getVehicleColors(brand, model, trimId) {
  const mfg = getManufacturerModel(brand, model);
  if (mfg?.engine === 'sportage') {
    const trim = trimId ?? mfg.defaultTrimId;
    return kiaSportage.colors
      .filter((c) => c.availableTrims?.includes(trim) && ['solid', 'metallic'].includes(c.type))
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        name: c.name.replace(/ Metallic$/, ''),
        hex: c.hexPreview ?? '#cbd5e1',
      }));
  }
  if (mfg?.engine === 'ev3') return EV3_COLORS;
  return EV3_COLORS;
}

export function resolveColorIdForPricing(brand, model, colorId) {
  const mfg = getManufacturerModel(brand, model);
  if (mfg?.engine === 'ev3') {
    const found = EV3_COLORS.find((c) => c.id === colorId);
    return found?.mapSportageId ?? null;
  }
  return colorId;
}

export function getConfigurablePackages(brand, model, trimId) {
  const mfg = getManufacturerModel(brand, model);
  if (!mfg?.data) return { packages: [], accessories: [] };
  const trim = trimId ?? mfg.defaultTrimId;
  const packages = (mfg.data.packages ?? []).filter(
    (p) => !p.availableTrims || p.availableTrims.includes(trim),
  );
  const accessories = (mfg.data.accessories ?? []).filter(
    (a) => !a.availableTrims || a.availableTrims.includes(trim),
  );
  return { packages, accessories };
}

/** Sonderzahlung senkt Rate (vereinfacht, live ohne Backend) */
export function adjustRateForDownPayment(baseRate, downPayment, termMonths) {
  if (!baseRate || !downPayment) return baseRate;
  const reduction = Math.round((downPayment / termMonths) * 0.35);
  return Math.max(49, baseRate - reduction);
}

export function adjustFinanceRate(baseRate, downPayment, balloon) {
  if (!baseRate) return baseRate;
  const down = Math.round(downPayment / 48);
  const balloonAdj = Math.round(balloon / 60);
  return Math.max(49, baseRate - down + balloonAdj);
}
