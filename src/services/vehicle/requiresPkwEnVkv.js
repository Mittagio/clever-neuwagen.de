/**
 * Pflichtlogik für Pkw-EnVKV-Angaben (Neuwagen / Online-Angebote).
 */

export const VEHICLE_STATE = {
  NEW: 'new',
  USED: 'used',
  STOCK: 'stock',
  DEMO: 'demo',
};

export const ENVKV_CHANNEL = {
  LANDING: 'landing',
  ONLINE: 'online',
  PORTAL: 'portal',
  OFFER: 'offer',
  ADVERTISING: 'advertising',
  INTERNAL: 'internal',
};

const ONLINE_CHANNELS = new Set([
  ENVKV_CHANNEL.LANDING,
  ENVKV_CHANNEL.ONLINE,
  ENVKV_CHANNEL.PORTAL,
  ENVKV_CHANNEL.OFFER,
  ENVKV_CHANNEL.ADVERTISING,
]);

const OFFER_PAYMENT_TYPES = new Set([
  'leasing',
  'finance',
  'financing',
  'cash',
  'kauf',
  'langzeitmiete',
  'long_term_rental',
]);

function normalizeMileage(vehicle) {
  if (vehicle.mileageKm != null) return Number(vehicle.mileageKm);
  if (vehicle.mileage != null) return Number(vehicle.mileage);
  return null;
}

function isLegallyNewPassengerCar(vehicle) {
  if (vehicle.isNewPassengerCar === true) return true;
  if (vehicle.isNewPassengerCar === false) return false;

  const state = vehicle.vehicleState;
  if (state === VEHICLE_STATE.USED) return false;

  const mileage = normalizeMileage(vehicle);
  if (mileage != null && mileage > 1000) return false;

  if (state === VEHICLE_STATE.STOCK || state === VEHICLE_STATE.DEMO) {
    if (mileage != null && mileage <= 1000) return true;
    return vehicle.isNewPassengerCar !== false;
  }

  if (state === VEHICLE_STATE.NEW || state == null) return true;
  return false;
}

/**
 * @param {object} vehicle
 * @param {{ channel?: string, paymentType?: string }} [context]
 */
export function requiresPkwEnVkv(vehicle = {}, context = {}) {
  const channel = context.channel ?? ENVKV_CHANNEL.ONLINE;
  if (!ONLINE_CHANNELS.has(channel)) return false;

  const paymentType = String(
    context.paymentType ?? vehicle.paymentType ?? vehicle.offerType ?? 'leasing',
  ).toLowerCase();
  if (!OFFER_PAYMENT_TYPES.has(paymentType)) return false;

  if (vehicle.envkvExempt === true || vehicle.skipEnVkv === true) return false;

  return isLegallyNewPassengerCar(vehicle);
}

export function buildDefaultNewPassengerCarRef(vehicleRef = {}) {
  return {
    ...vehicleRef,
    isNewPassengerCar: vehicleRef.isNewPassengerCar ?? true,
    vehicleState: vehicleRef.vehicleState ?? VEHICLE_STATE.NEW,
    market: vehicleRef.market ?? 'DE',
  };
}
