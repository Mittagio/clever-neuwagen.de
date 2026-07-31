/**
 * Missing-Information Resolver – nur was für die aktuelle Aufgabe fehlt.
 */
import { SELLER_FACT_CLASS, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';

/**
 * @param {object} params
 */
export function resolveMissingInformation({
  intents = [],
  facts = [],
  lead = {},
  currentOfferContext = null,
} = {}) {
  const missing = [];
  const profile = getNeedProfileFromLead(lead) || {};
  const has = (factClass, field = null) => facts.some((f) => (
    f.factClass === factClass && (!field || f.field === field)
  ));

  const wantsTradeIn = intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_TRADE_IN)
    || has(SELLER_FACT_CLASS.TRADE_IN_FACT);
  if (wantsTradeIn) {
    if (!has(SELLER_FACT_CLASS.EXISTING_VEHICLE) && !lead?.crm?.tradeIn?.vehicle) {
      missing.push({
        id: 'trade_in_vehicle',
        forIntent: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
        label: 'Welches Fahrzeug soll in Zahlung genommen werden?',
        field: 'existingVehicle',
      });
    }
    const hasMileage = has(SELLER_FACT_CLASS.EXISTING_VEHICLE) === false
      ? false
      : facts.some((f) => f.field === 'mileage' || f.field === 'odometer');
    if (!hasMileage && !lead?.crm?.tradeIn?.mileage) {
      missing.push({
        id: 'trade_in_mileage',
        forIntent: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
        label: 'Kilometerstand des Inzahlungnahme-Fahrzeugs',
        field: 'mileage',
      });
    }
    if (!/\bfahrzeugschein\b/i.test(JSON.stringify(facts)) && !lead?.crm?.tradeIn?.registrationDocument) {
      missing.push({
        id: 'trade_in_registration',
        forIntent: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
        label: 'Fahrzeugschein',
        field: 'vehicle_registration',
      });
    }
  }

  const wantsOffer = intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  if (wantsOffer) {
    const hasAttachedOffer = Boolean(
      currentOfferContext?.offerId
      || currentOfferContext?.title
      || currentOfferContext?.summary,
    );
    const hasVehicle = hasAttachedOffer
      || has(SELLER_FACT_CLASS.VEHICLE_INTEREST)
      || profile?.preferredModelKey
      || lead?.wish?.modelKey;
    if (!hasVehicle) {
      missing.push({
        id: 'offer_vehicle',
        forIntent: SELLER_TURN_INTENTS.PREPARE_OFFER,
        label: 'Welches Modell soll angeboten werden?',
        field: 'vehicleInterest',
      });
    }

    // Leasing-Kontext + Kaufpreis-Zahl → echte Ambiguity einmal nachfragen
    const purchasePrice = facts.find((f) => f.field === 'purchasePrice');
    const leadLeasing = String(lead?.paymentType || lead?.wish?.paymentType || profile?.paymentType || '')
      .toLowerCase()
      .includes('leasing');
    if (purchasePrice && leadLeasing) {
      missing.push({
        id: 'clarify_purchase_vs_leasing',
        forIntent: SELLER_TURN_INTENTS.PREPARE_OFFER,
        label: `Soll ich ein Kaufangebot über ${Number(purchasePrice.value).toLocaleString('de-DE')} € erstellen oder dienen die ${Number(purchasePrice.value).toLocaleString('de-DE')} € als Fahrzeugpreis für eine Leasingberechnung?`,
        field: 'paymentType',
      });
    }

    const hasRate = facts.some((f) => (
      f.field === 'desiredRate'
      || f.field === 'monthlyBudget'
      || f.field === 'monthlyLeasingRate'
    )) || currentOfferContext?.monthlyRate != null;
    const explicitCash = facts.some((f) => (
      f.field === 'paymentType' && /purchase|cash|kauf/i.test(String(f.value || ''))
    ));
    if (leadLeasing && !hasRate && !purchasePrice && !explicitCash) {
      missing.push({
        id: 'monthly_leasing_rate',
        forIntent: SELLER_TURN_INTENTS.PREPARE_OFFER,
        label: 'Leasingrate oder Bank-PDF',
        field: 'monthlyLeasingRate',
      });
    }
  }

  const ambiguousMoney = facts.find((f) => (
    f.field === 'monthlyBudget' && f.needsConfirmation
  ));
  if (ambiguousMoney) {
    missing.push({
      id: 'clarify_money',
      forIntent: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
      label: `Sind die ${ambiguousMoney.value} € die gewünschte Monatsrate?`,
      field: 'monthlyBudget',
    });
  }

  return missing;
}
