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
    const hasVehicle = has(SELLER_FACT_CLASS.VEHICLE_INTEREST)
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
    // Bekannte Konditionen nicht erneut fragen
    const hasTerm = profile?.termMonths || lead?.wish?.termMonths || lead?.wish?.months;
    const hasKm = profile?.annualMileage || lead?.wish?.annualMileage || lead?.wish?.km;
    // nur wenn Offer und gar kein Kontext – absichtlich keine Fragen für term/km wenn bekannt
    if (!hasTerm && !lead?.wish?.paymentType) {
      // still don't ask term by default if leasing already implied elsewhere
    }
    void hasKm;
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
