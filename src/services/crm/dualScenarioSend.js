/**
 * Dual-Send: beide scenario-gebundenen Angebote als Workspace-/Portfolio-Paket.
 */
import {
  areAllScenarioOffersReady,
  formatCommercialScenarioConditionsLine,
  formatCommercialScenarioTypeLabel,
  listCommercialScenarios,
} from './commercialScenarios.js';
import {
  listCustomerVehicleTracks,
  listScenarioOfferSlots,
} from './vehicleTrack.js';
import { appendOfferCardsToThread, buildOfferReadyIntroText } from './sharedWorkspaceService.js';
import { markOfferSent } from '../vehicleOffer.js';

function formatRateLine(slot) {
  if (slot.monthlyRate == null || !Number.isFinite(Number(slot.monthlyRate))) return null;
  return `${Number(slot.monthlyRate).toLocaleString('de-DE')} €/Monat`;
}

/**
 * Portfolio-/Thread-Items aus scenario slots (rate-first, keine Bankdetails).
 */
export function buildDualScenarioSendItems(lead = {}, trackId = null) {
  const tracks = listCustomerVehicleTracks(lead);
  const track = trackId
    ? tracks.find((t) => t.id === trackId)
    : tracks.find((t) => t.hasMultipleScenarios) ?? tracks[0];
  if (!track) return [];

  const slots = track.scenarioSlots?.length
    ? track.scenarioSlots
    : listScenarioOfferSlots(lead, track.id);

  return slots.filter((slot) => slot.ready).map((slot) => {
    const rateLine = formatRateLine(slot);
    const typeLabel = slot.typeLabel || formatCommercialScenarioTypeLabel(slot.type);
    return {
      id: slot.offerId || `pu-${slot.scenarioId}`,
      vehicleCardId: track.id,
      offerId: slot.offerId,
      commercialScenarioId: slot.scenarioId,
      modelLabel: track.displayName || track.modelLabel,
      trimLabel: track.config?.trimLabel ?? null,
      title: `${track.modelLabel} · ${typeLabel}`,
      roleLabel: typeLabel,
      paymentType: slot.type,
      conditionsLine: slot.conditionsLine
        || formatCommercialScenarioConditionsLine(slot.scenario),
      rateLine,
      priceLine: rateLine,
      displayFormatted: rateLine,
      summaryLine: [typeLabel, rateLine].filter(Boolean).join(' · '),
      requiresPdf: true,
      pdfFileName: slot.pdf?.fileName ?? null,
      pdfDataUrl: slot.pdf?.dataUrl ?? null,
      sourceType: 'commercial_scenario',
    };
  });
}

/**
 * Beide (oder alle bereiten) Szenario-Angebote in den Kunden-Thread legen.
 */
export function sendBothScenarioOffers({
  lead,
  trackId = null,
  createdByName = 'Verkäufer',
  firstName = null,
  markSent = true,
} = {}) {
  if (!lead?.id) return { ok: false, error: 'no_lead', lead };

  const items = buildDualScenarioSendItems(lead, trackId);
  if (!items.length) {
    return { ok: false, error: 'no_ready_offers', lead, items: [] };
  }

  const tracks = listCustomerVehicleTracks(lead);
  const track = trackId
    ? tracks.find((t) => t.id === trackId)
    : tracks.find((t) => t.hasMultipleScenarios) ?? tracks[0];
  const slots = track ? listScenarioOfferSlots(lead, track.id) : [];
  const allReady = areAllScenarioOffersReady(slots);

  const introName = firstName
    || String(lead.contact?.name || lead.name || '').split(/\s+/)[0]
    || null;
  const introText = buildOfferReadyIntroText({
    firstName: introName,
    itemCount: items.length,
  });

  const appended = appendOfferCardsToThread({
    lead,
    items,
    introText,
    firstName,
    createdByName,
    ctaLabel: 'Angebot ansehen',
  });

  let nextLead = appended.lead;
  if (markSent && appended.ok) {
    const offers = { ...(nextLead.crm?.vehicleOffers ?? {}) };
    for (const item of items) {
      const key = item.offerId;
      if (!key || !offers[key]) continue;
      offers[key] = markOfferSent(offers[key], 'clever');
    }
    nextLead = {
      ...nextLead,
      crm: {
        ...(nextLead.crm ?? {}),
        vehicleOffers: offers,
      },
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    ok: appended.ok,
    lead: nextLead,
    messages: appended.messages ?? [],
    items,
    itemCount: items.length,
    allReady,
    dualSend: items.length > 1,
    scenarioCount: listCommercialScenarios(lead).length,
  };
}

export function canSendBothScenarioOffers(lead = {}, trackId = null) {
  const items = buildDualScenarioSendItems(lead, trackId);
  return items.length >= 2;
}
