import {
  buildDefaultNewPassengerCarRef,
  ENVKV_CHANNEL,
  requiresPkwEnVkv,
} from './requiresPkwEnVkv.js';
import {
  resolveVehicleEnvironmentalData,
  serializeVehicleEnvironmentalData,
} from './vehicleEnvironmentalData.js';

export function buildVehicleRefFromOfferContext(context = {}) {
  return buildDefaultNewPassengerCarRef({
    id: context.id ?? context.vehicleCardId ?? context.variantId ?? null,
    modelKey: context.modelKey ?? null,
    trimId: context.trimId ?? null,
    engineId: context.engineId ?? context.motorId ?? null,
    brand: context.brand ?? null,
    model: context.model ?? null,
    variant: context.variant ?? context.trimLabel ?? null,
    label: context.modelLabel ?? context.title ?? null,
    paymentType: context.paymentType ?? null,
    vehicleState: context.vehicleState ?? null,
    mileageKm: context.mileageKm ?? null,
    isNewPassengerCar: context.isNewPassengerCar,
    envkvExempt: context.envkvExempt,
  });
}

export function attachVehicleEnvironmentalData(context = {}, channel = ENVKV_CHANNEL.PORTAL) {
  const vehicleRef = buildVehicleRefFromOfferContext(context);
  const envData = resolveVehicleEnvironmentalData(vehicleRef);
  const required = requiresPkwEnVkv(vehicleRef, { channel, paymentType: context.paymentType });
  return {
    vehicleRef,
    vehicleEnvironmentalData: serializeVehicleEnvironmentalData(envData),
    envkvRequired: required,
    envkvPublishable: !required || envData.publishable,
    envData,
  };
}

/**
 * Prüft Portfolio-Items vor Kundenversand.
 * @param {object[]} items
 * @param {{ channel?: string }} [options]
 */
export function validatePortfolioEnVkvForSend(items = [], options = {}) {
  const channel = options.channel ?? ENVKV_CHANNEL.PORTAL;
  const blockers = [];

  for (const item of items) {
    const attached = item.vehicleEnvironmentalData
      ? {
          envData: {
            ...item.vehicleEnvironmentalData,
            publishable: item.vehicleEnvironmentalData.publishable,
            vehicleLabel: item.title ?? item.modelLabel,
          },
          envkvRequired: item.envkvRequired,
        }
      : attachVehicleEnvironmentalData(item, channel);

    if (!attached.envkvRequired) continue;
    if (!attached.envData?.publishable) {
      blockers.push({
        id: item.id,
        label: item.title ?? item.modelLabel ?? 'Angebot',
        confidence: attached.envData?.confidence ?? 'missing',
      });
    }
  }

  return {
    ok: blockers.length === 0,
    blockers,
    error: blockers.length ? 'envkv_missing' : null,
    message: blockers.length
      ? 'CO₂-/Verbrauchsangaben fehlen – vor Versand ergänzen.'
      : null,
    warningTitle: 'CO₂-/Verbrauchsangaben fehlen',
    warningBody: 'Dieses Angebot sollte nicht veröffentlicht oder versendet werden, bis die Pflichtangaben ergänzt sind.',
  };
}

export function getCalculatorEnVkvStatus(draft = {}) {
  const attached = attachVehicleEnvironmentalData(draft, ENVKV_CHANNEL.OFFER);
  if (!attached.envkvRequired) {
    return { required: false, publishable: true, envData: attached.envData };
  }
  return {
    required: true,
    publishable: Boolean(attached.envData?.publishable),
    envData: attached.envData,
    message: attached.envData?.publishable
      ? 'CO₂-/Verbrauchsangaben vorhanden'
      : 'CO₂-/Verbrauchsangaben fehlen – vor Versand ergänzen.',
  };
}
