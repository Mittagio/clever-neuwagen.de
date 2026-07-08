/**
 * Kontext für Clever-Textvorschläge aus Journey, Reminder, Kunde und Angebot.
 */
import { buildCleverAntwortenContext, resolveLegacyKundenhelferNotes } from '../cleverAntworten.js';
import { getCustomerPortalAccess } from '../crm/customerPortalAccessService.js';
import {
  formatVehicleCardConditions,
  formatVehicleCardPrice,
  formatVehicleCardTitle,
} from '../customerAkte.js';
import { CANONICAL_OFFER_STATE } from '../journey/journeyTypes.js';

export function buildCleverMessageContext({
  lead = null,
  journey = null,
  reminder = null,
  vehicleCards = [],
  customerName = '',
  phone = '',
  email = '',
  kundenhelferNotes = '',
  sellerName = 'Ihr Verkaufsteam',
  dealerName = '',
  wishPaymentType = 'unknown',
} = {}) {
  const base = buildCleverAntwortenContext({
    lead,
    customerName: customerName || lead?.contact?.name || '',
    phone: phone || lead?.contact?.phone || '',
    email: email || lead?.contact?.email || '',
    vehicleCards,
    kundenhelferNotes: resolveLegacyKundenhelferNotes(lead, kundenhelferNotes),
    sellerName,
    dealerName,
    wishPaymentType,
  });

  const signals = journey?.signals ?? null;
  const primaryCard = base.primaryCard
    ?? signals?.primaryCard
    ?? vehicleCards[0]
    ?? null;

  const vehicleTitle = base.vehicleTitle
    || (primaryCard ? formatVehicleCardTitle(primaryCard) : '')
    || (lead?.vehicle?.model ? `Kia ${String(lead.vehicle.model).replace(/^Kia\s+/i, '')}` : '');

  const canonicalState = journey?.canonicalOfferState?.state
    ?? signals?.canonicalOffer?.state
    ?? null;

  const portalAccess = getCustomerPortalAccess(lead);
  const portalUrl = portalAccess?.portfolioUrl ?? null;
  const portalCodeHint = portalAccess?.accessCode
    ? `Zugangscode: ${portalAccess.accessCode}`
    : null;

  return {
    ...base,
    lead,
    vehicleTitle,
    primaryCard,
    priceLine: primaryCard ? formatVehicleCardPrice(primaryCard) : base.priceLine,
    conditionsLine: primaryCard ? formatVehicleCardConditions(primaryCard) : null,
    journeyPhase: journey?.phase ?? null,
    journeyPhaseLabel: journey?.phaseLabel ?? '',
    reminderRuleId: reminder?.ruleId ?? lead?.crm?.journeyReminderRuleId ?? null,
    reminderReason: reminder?.reason ?? lead?.crm?.journeyReminderReason ?? '',
    reminderLabel: reminder?.nextStepLabel ?? lead?.crm?.nextStepLabel ?? '',
    recommendationActionId: journey?.recommendation?.actionId ?? null,
    recommendationTitle: journey?.recommendation?.title ?? journey?.view?.headline ?? '',
    canonicalOfferState: canonicalState,
    offerOpened: canonicalState === CANONICAL_OFFER_STATE.OPENED || base.offerOpened,
    offerSent: canonicalState === CANONICAL_OFFER_STATE.SENT || base.offerSent,
    portalUrl,
    portalCodeHint,
    offerUrl: portalUrl ?? base.offerUrl ?? null,
    leasingEndDate: lead?.wish?.leasingEndDate ?? lead?.leasingEndDate ?? lead?.crm?.leasingEndDate ?? null,
    vehicleFulfillmentStatus: signals?.vehicleFulfillmentStatus ?? lead?.crm?.vehicleFulfillment?.status ?? null,
    deliveryConfirmed: Boolean(signals?.deliveryConfirmed ?? lead?.deliveryConfirmation?.confirmedAt),
  };
}
