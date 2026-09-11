/**
 * Slim Application-Prepare-Handoff nach NBA application_prepare.
 * Keine Bank-API / keine Fake-Submit – Presenter für den Abschlussmoment.
 *
 * @see docs/CLEVER_UX_MANIFEST_V1.md
 */

import {
  findSendableVehicleOffer,
  hasCustomerOfferCommitment,
  resolvePostCommitOpenWork,
} from './determineNextBestSellerAction.js';
import { listStoredVehicleOffers, resolveSourceOfferDraftId } from '../vehicleOffer.js';

function formatRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toLocaleString('de-DE')} €/Monat`;
}

function resolveCommittedOfferSummary(lead = {}) {
  const offers = listStoredVehicleOffers(lead) || [];
  const accepted = offers.find((o) => String(o?.status || '').toLowerCase() === 'accepted')
    || offers[0]
    || null;
  const sendable = findSendableVehicleOffer(lead);
  const offer = accepted || sendable?.offer || null;
  if (!offer) return null;

  const model = offer.modelLabel
    || offer.model
    || offer.boardOffer?.modelLabel
    || offer.trimLabel
    || lead?.crm?.needProfile?.selectedModelKey
    || null;
  const trim = offer.trimLabel || offer.trim || offer.boardOffer?.trimLabel || null;
  const vehicle = [model, trim].filter(Boolean).join(' ').trim() || 'Fahrzeug';
  const rate = formatRate(
    offer.monthlyRate
    ?? offer.boardOffer?.payment?.monthlyRate
    ?? null,
  );
  const term = offer.termMonths ?? offer.boardOffer?.payment?.termMonths ?? lead?.wish?.termMonths;
  const km = offer.mileagePerYear
    ?? offer.annualMileage
    ?? offer.boardOffer?.payment?.mileagePerYear
    ?? lead?.wish?.mileagePerYear;
  const parts = [];
  if (rate) parts.push(rate);
  if (term != null) parts.push(`${term} Monate`);
  if (km != null) {
    const n = Number(km);
    parts.push(`${Number.isFinite(n) ? n.toLocaleString('de-DE') : km} km/Jahr`);
  }

  return {
    vehicleLabel: vehicle,
    conditionsLine: parts.length ? parts.join(' · ') : null,
    offerDraftId: resolveSourceOfferDraftId(offer) || offer.offerDraftId || null,
    cardId: offer.id || offer.vehicleCardId || sendable?.cardId || null,
    monthlyRate: offer.monthlyRate ?? null,
  };
}

/**
 * @param {{ lead?: object|null }} params
 * @returns {object|null} Universal-Review-kompatibles Slim-Model
 */
export function buildApplicationPrepareHandoffModel({ lead = null } = {}) {
  if (!lead || !hasCustomerOfferCommitment(lead)) return null;

  const openWork = resolvePostCommitOpenWork(lead);
  if (openWork.documentsIncomplete || openWork.selfDisclosureIncomplete) {
    return null;
  }

  const offer = resolveCommittedOfferSummary(lead);
  const customerName = lead?.contact?.name || lead?.name || 'Kunde';
  const vehicleBit = offer?.vehicleLabel ? ` (${offer.vehicleLabel})` : '';

  return {
    reviewType: 'application_prepare_handoff',
    compactUi: true,
    hideGlobalAccept: true,
    briefingPresenter: true,
    summaryLine: 'Antrag vorbereiten',
    offerDraftId: offer?.offerDraftId || null,
    applicationPrepare: {
      dealStatus: 'Kunde hat zugesagt',
      documentsStatus: 'Unterlagen vollständig',
      selfDisclosureStatus: 'Selbstauskunft vollständig',
      vehicleLabel: offer?.vehicleLabel || null,
      conditionsLine: offer?.conditionsLine || null,
    },
    offerReview: {
      vehicleLabel: offer?.vehicleLabel || 'Antrag vorbereiten',
      heroLine: 'Kunde hat zugesagt',
      conditionsLine: [
        'Unterlagen vollständig',
        'Selbstauskunft vollständig',
        offer?.conditionsLine,
      ].filter(Boolean).join(' · '),
      openLine: null,
      inCustomerAkte: true,
      conflict: null,
      localClarify: null,
    },
    groups: [],
    collapsedContext: null,
    conflictBox: null,
    actionSections: [{
      id: 'application_prepare_handoff',
      kind: 'application_prepare_handoff',
      title: 'Antrag vorbereiten',
      headline: 'Kunde hat zugesagt',
      line: [
        'Unterlagen vollständig',
        'Selbstauskunft vollständig',
        offer?.vehicleLabel,
        offer?.conditionsLine,
      ].filter(Boolean).join(' · '),
      clarifyPrompt: null,
      sellerSummary: `${customerName}${vehicleBit}: Unterlagen und Selbstauskunft sind vollständig. Als Nächstes den Antrag vorbereiten.`,
      primaryActions: [{
        id: 'seed_application_prepare',
        label: 'Antrag im Composer vorbereiten',
        action: 'seed_application_prepare',
        tone: 'primary',
        seedDraft: offer?.vehicleLabel
          ? `Bereite den Leasingantrag für ${offer.vehicleLabel} vor.`
          : 'Bereite den Leasingantrag vor.',
        offerDraftId: offer?.offerDraftId || null,
        cardId: offer?.cardId || null,
      }],
      secondaryActions: [{
        id: 'open_unterlagen',
        label: 'Unterlagen ansehen',
        action: 'open_unterlagen',
        tone: 'secondary',
      }],
      complete: false,
    }],
  };
}
