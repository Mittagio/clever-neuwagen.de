/**
 * Kundenwunsch-Konditionen in Angebots-Bearbeiten-Screen übernehmen.
 */
import { buildWishConditionsFromLeadAndFields } from '../sales/wishConditionsSync.js';

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

  return {
    ...card,
    paymentType,
    termMonths: card.termMonths
      ?? leasing.termMonths
      ?? financing.termMonths
      ?? (isCash ? null : wish.termMonths),
    mileagePerYear: card.mileagePerYear
      ?? leasing.mileagePerYear
      ?? (isCash ? null : wish.mileagePerYear),
    desiredRate: card.desiredRate
      ?? leasing.desiredRate
      ?? financing.desiredRate
      ?? (isCash ? null : wish.desiredRate),
    desiredPrice: card.desiredPrice
      ?? cash.desiredPrice
      ?? wish.desiredPrice,
    downPayment: card.downPayment
      ?? leasing.downPayment
      ?? financing.downPayment
      ?? wish.downPayment
      ?? 0,
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
    if (desiredPrice == null) add('desiredPrice', 'Kaufpreis');
  } else if (paymentType !== 'unknown' && desiredRate == null) {
    add('desiredRate', 'Monatsrate / Budget');
  }
  if (downPayment == null && paymentType !== 'cash' && paymentType !== 'unknown') {
    add('downPayment', 'Anzahlung');
  }
  if (!deliveryNote) add('delivery', 'Lieferzeit');
  if (!card.specialConditionLabels?.length) add('specialConditions', 'Zielgruppe / Aktionen');

  return pending;
}

/** Braucht der Vorschlag noch Configure/Konditionen (keine berechnete Rate)? */
export function cardNeedsConditionsConfigure(card = {}) {
  const paymentType = card.paymentType ?? 'unknown';
  if (paymentType === 'unknown') return true;
  if (paymentType === 'cash') return card.desiredPrice == null;
  return card.desiredRate == null;
}
