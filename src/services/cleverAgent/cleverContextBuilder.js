/**
 * Kompakter, strukturierter Kundenkontext für den Clever Agent.
 * Kein Full-Lead-Dump – nur verkaufsrelevante Felder.
 */
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { listStoredVehicleOffers } from '../vehicleOffer.js';
import { deriveContactIdentity } from '../dealer/customerContactIdentity.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';

function pickOfferSummary(offer = {}) {
  if (!offer || typeof offer !== 'object') return null;
  const id = offer.id || offer.vehicleCardId || null;
  if (!id && offer.monthlyRate == null && !offer.modelName && !offer.model) return null;
  return {
    offerId: id,
    modelName: offer.modelName || offer.model || offer.name || offer.vehicle || null,
    modelKey: offer.modelKey || null,
    trimLabel: offer.trimLabel || offer.trim || null,
    paymentType: offer.paymentType || null,
    termMonths: offer.termMonths ?? null,
    mileagePerYear: offer.mileagePerYear ?? null,
    downPayment: offer.downPayment ?? null,
    monthlyRate: offer.monthlyRate ?? offer.desiredRate ?? null,
    status: offer.status || offer.boardStatus || null,
    summary: offer.summary || offer.shortLabel || null,
  };
}

function collectOffersFromLead(lead = {}) {
  const fromCrm = listStoredVehicleOffers(lead).map(pickOfferSummary).filter(Boolean);
  const legacy = Array.isArray(lead?.crm?.offers)
    ? lead.crm.offers.map(pickOfferSummary).filter(Boolean)
    : [];
  const configs = Array.isArray(lead?.crm?.vehicleConfigurations)
    ? lead.crm.vehicleConfigurations.map((c) => pickOfferSummary({
      id: c.id,
      modelName: c.model,
      modelKey: c.modelKey,
      trimLabel: c.trimLabel,
      paymentType: c.paymentType,
      termMonths: c.leasingData?.termMonths ?? c.termMonths,
      mileagePerYear: c.leasingData?.mileagePerYear ?? c.mileagePerYear,
      downPayment: c.leasingData?.downPayment ?? c.downPayment,
      monthlyRate: c.boardOffer?.payment?.monthlyRate ?? c.desiredRate,
      status: c.boardOffer?.status || 'draft',
    })).filter(Boolean)
    : [];

  const byId = new Map();
  for (const o of [...fromCrm, ...legacy, ...configs]) {
    const key = String(o.offerId || `${o.modelKey}-${o.monthlyRate}-${o.termMonths}`);
    if (!byId.has(key)) byId.set(key, o);
  }
  return [...byId.values()];
}

/**
 * @param {object} lead
 * @param {object} [options]
 * @param {object|null} [options.workingContext]
 * @param {object|null} [options.currentOffer]
 */
export function buildCleverCustomerContext(lead = {}, options = {}) {
  const identity = deriveContactIdentity(lead?.contact || {}, lead?.name || '');
  const wish = lead?.wish || {};
  const need = getNeedProfileFromLead(lead) || lead?.crm?.needProfile || {};
  let understanding = null;
  try {
    understanding = buildCustomerUnderstanding(lead);
  } catch {
    understanding = null;
  }

  const offers = collectOffersFromLead(lead);
  const working = options.workingContext || options.currentOffer || null;
  const currentOffer = working
    ? pickOfferSummary({
      id: working.offerId || working.id,
      modelName: working.title || working.modelLabel || working.modelName,
      modelKey: working.modelKey,
      trimLabel: working.trimLabel,
      paymentType: working.paymentType,
      termMonths: working.termMonths,
      mileagePerYear: working.mileagePerYear,
      downPayment: working.downPayment,
      monthlyRate: working.monthlyRate,
      status: working.status || 'working',
      summary: working.summary || working.shortLabel,
    })
    : (offers[0] || null);

  const tracks = listCustomerVehicleTracks(lead).slice(0, 6).map((t) => ({
    id: t.id,
    modelKey: t.modelKey || null,
    modelLabel: t.modelLabel || t.label || null,
    status: t.status || null,
  }));

  const customerKnowledge = [
    ...(understanding?.verstaendnis?.labels || []).slice(0, 12),
    ...(understanding?.verstaendnis?.priorities || []).slice(0, 6),
  ].filter(Boolean);

  const docs = lead?.crm?.unterlagen || lead?.crm?.documents || null;
  const portfolio = lead?.crm?.customerOfferPortfolio || null;

  return {
    customer: {
      leadId: lead?.id || null,
      displayName: identity.kind === 'business'
        ? (identity.companyName || lead?.contact?.name || null)
        : ([identity.firstName, identity.lastName].filter(Boolean).join(' ') || lead?.contact?.name || null),
      salutation: identity.salutation || null,
      firstName: identity.firstName || null,
      lastName: identity.lastName || null,
      kind: identity.kind || 'private',
      hasEmail: Boolean(lead?.contact?.email),
      hasPhone: Boolean(lead?.contact?.phone),
    },
    currentInterest: {
      vehicleLabel: lead?.vehicle?.label || lead?.vehicle?.model || null,
      modelKey: lead?.vehicle?.modelKey || tracks[0]?.modelKey || null,
      paymentType: lead?.paymentType || wish.paymentType || need?.budget?.paymentType || null,
    },
    needProfile: {
      annualKm: need?.annualKm ?? wish.mileagePerYear ?? null,
      leaseDurationMonths: need?.leaseDurationMonths ?? wish.termMonths ?? null,
      maxMonthlyRate: need?.budget?.maxMonthlyRate ?? lead?.desiredRate ?? wish.desiredRate ?? null,
      downPayment: need?.budget?.downPayment ?? wish.downPayment ?? null,
      paymentType: need?.budget?.paymentType ?? wish.paymentType ?? lead?.paymentType ?? null,
    },
    conditions: {
      contractType: lead?.paymentType || wish.paymentType || need?.budget?.paymentType || null,
      durationMonths: wish.termMonths ?? need?.leaseDurationMonths ?? null,
      mileage: wish.mileagePerYear ?? need?.annualKm ?? null,
      downPayment: wish.downPayment ?? need?.budget?.downPayment ?? null,
      desiredRate: lead?.desiredRate ?? wish.desiredRate ?? need?.budget?.maxMonthlyRate ?? null,
    },
    customerKnowledge,
    currentOffers: offers.slice(0, 8),
    selectedOffer: currentOffer,
    vehicleTracks: tracks,
    documents: docs
      ? {
        status: docs.status || docs.summary || null,
        missingCount: Array.isArray(docs.missing) ? docs.missing.length : null,
      }
      : null,
    portal: portfolio
      ? {
        status: portfolio.status || null,
        url: portfolio.url || null,
        itemCount: Array.isArray(portfolio.items) ? portfolio.items.length : null,
      }
      : null,
    journey: {
      nextStepId: lead?.crm?.nextStepId || lead?.crm?.pipelineStatusId || null,
      pipelineStatusId: lead?.crm?.pipelineStatusId || null,
    },
  };
}

/**
 * Kompakte Prompt-Darstellung (kein Raw-Lead).
 */
export function formatCleverCustomerContextForPrompt(context = {}) {
  return JSON.stringify(context, null, 0);
}
