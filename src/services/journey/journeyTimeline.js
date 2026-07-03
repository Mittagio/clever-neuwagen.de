/**
 * Vereinheitlichte Verkäufer-Timeline aus vorhandenen Quellen.
 */
import { sortHistoryNewestFirst } from '../customerAkteHistory.js';
import { PORTAL_ACCESS_STATUS } from '../crm/customerPortalAccessService.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';

const TIMELINE_SOURCE = {
  HISTORY: 'history',
  INBOX: 'inbox',
  PORTAL: 'portal',
  OFFER: 'offer',
  DELIVERY: 'delivery',
};

function toTimelineEntry({
  id,
  at,
  text,
  source,
  type = 'activity',
  tone = 'neutral',
}) {
  if (!at || !text) return null;
  return {
    id: id ?? `tl-${source}-${at}`,
    at,
    text,
    source,
    type,
    tone,
  };
}

function portalEvents(portal = {}) {
  const events = [];
  if (portal.preparedAt) {
    events.push(toTimelineEntry({
      id: 'portal-prepared',
      at: portal.preparedAt,
      text: 'Kundenportal vorbereitet',
      source: TIMELINE_SOURCE.PORTAL,
      tone: 'info',
    }));
  }
  if (portal.sentAt) {
    events.push(toTimelineEntry({
      id: 'portal-sent',
      at: portal.sentAt,
      text: 'Kundenlink gesendet',
      source: TIMELINE_SOURCE.PORTAL,
      tone: 'info',
    }));
  }
  if (portal.openedAt) {
    events.push(toTimelineEntry({
      id: 'portal-opened',
      at: portal.openedAt,
      text: 'Kunde hat Portal geöffnet',
      source: TIMELINE_SOURCE.PORTAL,
      tone: 'highlight',
    }));
  }
  if (portal.viewedAt || portal.status === PORTAL_ACCESS_STATUS.VIEWED) {
    events.push(toTimelineEntry({
      id: 'portal-viewed',
      at: portal.viewedAt ?? portal.openedAt,
      text: 'Fahrzeugauswahl im Portal angesehen',
      source: TIMELINE_SOURCE.PORTAL,
      tone: 'highlight',
    }));
  }
  return events.filter(Boolean);
}

function offerTrackingEvents(cards = []) {
  const events = [];
  for (const card of cards) {
    const offer = card.vehicleOffer ?? card.offer ?? {};
    const label = [card.model ?? card.modelName, card.trim ?? card.trimLabel].filter(Boolean).join(' ');
    const prefix = label ? `${label}: ` : '';

    if (offer.sentAt) {
      events.push(toTimelineEntry({
        id: `offer-sent-${card.id}`,
        at: offer.sentAt,
        text: `${prefix}Angebot gesendet`,
        source: TIMELINE_SOURCE.OFFER,
        tone: 'info',
      }));
    }
    const openedAt = offer.tracking?.lastOpenedAt ?? offer.openedAt;
    if (openedAt) {
      events.push(toTimelineEntry({
        id: `offer-opened-${card.id}`,
        at: openedAt,
        text: `${prefix}Angebot geöffnet`,
        source: TIMELINE_SOURCE.OFFER,
        tone: 'highlight',
      }));
    }
    if (offer.status === VEHICLE_OFFER_STATUS.ACCEPTED) {
      events.push(toTimelineEntry({
        id: `offer-accepted-${card.id}`,
        at: offer.acceptedAt ?? openedAt ?? offer.sentAt,
        text: `${prefix}Interesse bestätigt`,
        source: TIMELINE_SOURCE.OFFER,
        tone: 'success',
      }));
    }
  }
  return events.filter(Boolean);
}

function inboxEvents(items = []) {
  return items
    .map((item) => toTimelineEntry({
      id: `inbox-${item.id}`,
      at: item.createdAt ?? item.updatedAt,
      text: item.title ?? item.summary ?? 'Kundenaktivität',
      source: TIMELINE_SOURCE.INBOX,
      type: item.type ?? 'inbox',
      tone: item.status === 'open' ? 'highlight' : 'neutral',
    }))
    .filter(Boolean);
}

function historyEvents(history = []) {
  return history
    .map((entry) => toTimelineEntry({
      id: entry.id ?? `hist-${entry.at}`,
      at: entry.at,
      text: entry.text ?? entry.label ?? '',
      source: TIMELINE_SOURCE.HISTORY,
      type: entry.type ?? 'history',
      tone: entry.customerFacing ? 'highlight' : 'neutral',
    }))
    .filter(Boolean);
}

function deliveryEvents(deliveryConfirmation = {}) {
  const events = [];
  if (deliveryConfirmation.sentAt) {
    events.push(toTimelineEntry({
      id: 'delivery-sent',
      at: deliveryConfirmation.sentAt,
      text: 'Auslieferungsbestätigung gesendet',
      source: TIMELINE_SOURCE.DELIVERY,
      tone: 'success',
    }));
  }
  if (deliveryConfirmation.confirmedAt) {
    events.push(toTimelineEntry({
      id: 'delivery-confirmed',
      at: deliveryConfirmation.confirmedAt,
      text: 'Auslieferung bestätigt',
      source: TIMELINE_SOURCE.DELIVERY,
      tone: 'success',
    }));
  }
  return events.filter(Boolean);
}

/**
 * Chronologische Verkäufer-Timeline (neueste zuerst).
 */
export function buildJourneyTimeline(signals = {}) {
  const merged = [
    ...historyEvents(signals.history ?? []),
    ...inboxEvents(signals.inboxItems ?? []),
    ...portalEvents(signals.portal ?? {}),
    ...offerTrackingEvents(signals.vehicleCards ?? []),
    ...deliveryEvents(signals.deliveryConfirmation ?? {}),
  ];

  const seen = new Set();
  const unique = [];

  for (const entry of sortHistoryNewestFirst(merged)) {
    const key = `${entry.at}|${entry.text}|${entry.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }

  return unique;
}

export { TIMELINE_SOURCE };
