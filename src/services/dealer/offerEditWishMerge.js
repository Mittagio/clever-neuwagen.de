/**
 * Kundenwunsch-Konditionen in Angebots-Bearbeiten-Screen übernehmen.
 */
import { buildWishConditionsFromLeadAndFields } from '../sales/wishConditionsSync.js';
import {
  BOARD_OFFER_STATUS,
  hasCalculatedOfferPayment,
  resolveBoardOfferStatus,
} from './boardOfferModel.js';

export function resolveEffectivePaymentType(...candidates) {
  for (const value of candidates) {
    if (value && value !== 'unknown') return value;
  }
  return candidates.find((value) => value != null) ?? 'unknown';
}

export function buildWishFieldsFromLead(lead = null) {
  if (!lead) {
    return {
      paymentType: null,
      termMonths: null,
      mileagePerYear: null,
      downPayment: null,
      desiredRate: null,
      desiredPrice: null,
    };
  }
  return buildWishConditionsFromLeadAndFields(lead, {
    paymentType: lead.paymentType ?? lead.wish?.paymentType ?? null,
  });
}

function resolveCardConfiguration(lead, card) {
  const configs = lead?.crm?.vehicleConfigurations ?? [];
  if (!configs.length) return null;
  if (card?.configurationId) {
    return configs.find((entry) => entry.id === card.configurationId) ?? null;
  }
  if (card?.id) {
    return configs.find((entry) => entry.id === card.id) ?? null;
  }
  return configs.find((entry) => (entry.modelKey ?? '') === (card?.modelKey ?? '')) ?? null;
}

/**
 * Füllt fehlende Konditionen auf der Karte aus Lead / vehicleConfiguration.
 * @param {object} card
 * @param {object} lead
 */
export function enrichOfferEditCardFromLead(card = {}, lead = null) {
  if (!card) return {};
  if (!lead) return { ...card };

  const wish = buildWishConditionsFromLeadAndFields(lead, {});
  const configuration = resolveCardConfiguration(lead, card);
  const leasing = configuration?.leasingData ?? {};
  const financing = configuration?.financingData ?? {};
  const cash = configuration?.cashPurchaseData ?? {};

  const paymentType = resolveEffectivePaymentType(
    card.paymentType,
    configuration?.paymentType,
    wish.paymentType,
  );
  const isCash = paymentType === 'cash';
  const boardOffer = configuration?.boardOffer ?? card.boardOffer ?? null;
  const calculatedRate = leasing.calculatedRate
    ?? financing.calculatedRate
    ?? boardOffer?.payment?.monthlyRate
    ?? null;
  const calculatedPrice = cash.calculatedPrice
    ?? boardOffer?.payment?.cashPrice
    ?? null;
  const wishBudgetRate = wish.desiredRate ?? null;
  const wishBudgetPrice = wish.desiredPrice ?? null;

  return {
    ...card,
    paymentType,
    termMonths: card.termMonths
      ?? leasing.termMonths
      ?? financing.termMonths
      ?? boardOffer?.payment?.termMonths
      ?? (isCash ? null : wish.termMonths),
    mileagePerYear: card.mileagePerYear
      ?? leasing.mileagePerYear
      ?? boardOffer?.payment?.mileagePerYear
      ?? (isCash ? null : wish.mileagePerYear),
    calculatedRate,
    calculatedPrice,
    wishBudgetRate,
    wishBudgetPrice,
    desiredRate: calculatedRate
      ?? card.desiredRate
      ?? leasing.desiredRate
      ?? financing.desiredRate
      ?? null,
    desiredPrice: calculatedPrice
      ?? card.desiredPrice
      ?? cash.desiredPrice
      ?? null,
    downPayment: card.downPayment
      ?? leasing.downPayment
      ?? financing.downPayment
      ?? boardOffer?.payment?.downPayment
      ?? wish.downPayment
      ?? 0,
    preparationFee: card.preparationFee
      ?? boardOffer?.payment?.transferCost
      ?? null,
    configurationId: configuration?.id ?? card.configurationId ?? card.id,
  };
}

function readStoredPaymentSnapshot(configuration = null) {
  if (!configuration) return null;
  const boardOffer = configuration.boardOffer ?? null;
  if (boardOffer?.payment) {
    return {
      ...boardOffer.payment,
      type: boardOffer.payment.type ?? configuration.paymentType,
    };
  }
  const paymentType = configuration.paymentType ?? 'leasing';
  if (paymentType === 'cash') {
    const cash = configuration.cashPurchaseData ?? {};
    return {
      type: 'cash',
      cashPrice: cash.calculatedPrice ?? null,
      listPrice: cash.listPrice ?? null,
      discountPercent: cash.discountPercent ?? null,
    };
  }
  if (paymentType === 'financing') {
    const fin = configuration.financingData ?? {};
    return {
      type: 'financing',
      termMonths: fin.termMonths ?? null,
      downPayment: fin.downPayment ?? 0,
      monthlyRate: fin.calculatedRate ?? null,
      finalRate: fin.finalRate ?? fin.balloonPayment ?? null,
    };
  }
  const leasing = configuration.leasingData ?? {};
  return {
    type: 'leasing',
    termMonths: leasing.termMonths ?? null,
    mileagePerYear: leasing.mileagePerYear ?? null,
    downPayment: leasing.downPayment ?? 0,
    monthlyRate: leasing.calculatedRate ?? null,
    listPrice: leasing.listPrice ?? null,
  };
}

/** Echtes berechnetes Angebot auf der Karte – nicht Kundenwunsch-Budget. */
export function hasCalculatedOfferOnCard(card = {}, lead = null) {
  if (card.calculatedRate != null || card.calculatedPrice != null) {
    const paymentType = card.paymentType ?? 'leasing';
    if (paymentType === 'cash') {
      return card.calculatedPrice != null && Number.isFinite(Number(card.calculatedPrice));
    }
    return card.calculatedRate != null && Number.isFinite(Number(card.calculatedRate));
  }
  const configuration = resolveCardConfiguration(lead, card);
  const payment = readStoredPaymentSnapshot(configuration);
  if (payment && hasCalculatedOfferPayment(payment)) return true;
  if (configuration?.boardOffer?.status === BOARD_OFFER_STATUS.OFFER_CREATED) {
    return hasCalculatedOfferPayment(configuration.boardOffer.payment ?? {});
  }
  return false;
}

/** Draft / offer_created → immer Angebotsrechner, nie Angebotsvorschlag. */
export function shouldNavigateToOfferCalculator(card = {}, lead = null) {
  const status = resolveBoardOfferStatus(card, lead);
  return status === BOARD_OFFER_STATUS.DRAFT
    || status === BOARD_OFFER_STATUS.OFFER_CREATED;
}

/**
 * Configure-Draft aus gespeicherter vehicleConfiguration + Kundenwunsch.
 */
export function buildConfigureDraftFromStoredConfiguration(configuration = {}, wishFields = {}) {
  if (!configuration?.modelKey) return null;
  const paymentType = configuration.paymentType ?? wishFields.paymentType ?? 'leasing';
  const leasing = configuration.leasingData ?? {};
  const financing = configuration.financingData ?? {};
  const cash = configuration.cashPurchaseData ?? {};
  const boardPayment = configuration.boardOffer?.payment ?? {};
  const packageIds = (configuration.selectedPackages ?? [])
    .map((entry) => (typeof entry === 'string' ? entry : entry?.id))
    .filter(Boolean);

  return {
    brand: configuration.brand ?? 'Kia',
    model: configuration.model ?? '',
    modelKey: configuration.modelKey,
    trimId: configuration.trimId ?? null,
    trimLabel: configuration.trimLabel ?? null,
    engineId: configuration.engineId ?? null,
    batteryLabel: configuration.batteryLabel ?? null,
    colorId: configuration.colorId ?? null,
    colorLabel: configuration.colorLabel ?? null,
    packageIds,
    paymentType,
    termMonths: leasing.termMonths
      ?? financing.termMonths
      ?? boardPayment.termMonths
      ?? wishFields.termMonths
      ?? 48,
    mileagePerYear: leasing.mileagePerYear
      ?? boardPayment.mileagePerYear
      ?? wishFields.mileagePerYear
      ?? 15000,
    downPayment: leasing.downPayment
      ?? financing.downPayment
      ?? boardPayment.downPayment
      ?? wishFields.downPayment
      ?? 0,
    desiredRate: wishFields.desiredRate ?? leasing.desiredRate ?? financing.desiredRate ?? null,
    desiredPrice: wishFields.desiredPrice ?? cash.desiredPrice ?? null,
    preparationFee: boardPayment.transferCost ?? null,
    customerGroup: boardPayment.discountPercent != null ? 'custom' : 'standard',
    customDiscountPercent: boardPayment.discountPercent ?? null,
  };
}

/**
 * @param {object} card – nach enrichOfferEditCardFromLead
 */
export function buildOfferEditPendingFields(card = {}, { deliveryNote = '' } = {}) {
  const pending = [];
  const add = (id, label) => pending.push({ id, label, hint: 'bitte klären' });

  const paymentType = card.paymentType ?? 'unknown';
  const termMonths = card.termMonths;
  const mileagePerYear = card.mileagePerYear;
  const desiredRate = card.desiredRate;
  const desiredPrice = card.desiredPrice;
  const downPayment = card.downPayment;

  if (!paymentType || paymentType === 'unknown') add('paymentType', 'Zahlungsart');
  if (!mileagePerYear && paymentType !== 'cash' && paymentType !== 'unknown') {
    add('mileagePerYear', 'Kilometer / Jahr');
  }
  if (!termMonths && paymentType !== 'cash' && paymentType !== 'unknown') {
    add('termMonths', 'Laufzeit');
  }
  if (paymentType === 'cash') {
    if (card.calculatedPrice == null && desiredPrice == null) add('desiredPrice', 'Kaufpreis');
  } else if (paymentType !== 'unknown' && card.calculatedRate == null && desiredRate == null) {
    add('desiredRate', 'Monatsrate / Budget');
  }
  if (downPayment == null && paymentType !== 'cash' && paymentType !== 'unknown') {
    add('downPayment', 'Anzahlung');
  }
  if (!deliveryNote) add('delivery', 'Lieferzeit');
  if (!card.specialConditionLabels?.length) add('specialConditions', 'Zielgruppe / Aktionen');

  return pending;
}

/**
 * Braucht der Vorschlag noch Configure/Konditionen (keine berechnete Rate)?
 * Kundenwunsch-Budget zählt nicht als fertiges Angebot.
 */
export function cardNeedsConditionsConfigure(card = {}, lead = null) {
  if (shouldNavigateToOfferCalculator(card, lead)) return true;
  if (hasCalculatedOfferOnCard(card, lead)) return false;
  const paymentType = card.paymentType ?? 'unknown';
  if (paymentType === 'unknown') return true;
  if (paymentType === 'cash') return card.calculatedPrice == null;
  return card.calculatedRate == null;
}
