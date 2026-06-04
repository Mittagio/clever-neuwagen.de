/**
 * Verkaufschance erst bei aktiver Kundenanfrage (Sprint 16 / 40)
 */

import { formatDealerInquiryBriefLines } from './dealerInquiryBrief.js';

function uid(prefix = 'lead') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function historyEntry(text, type = 'system') {
  return {
    id: uid('hist'),
    at: new Date().toISOString(),
    type,
    text,
  };
}

const ACTION_STATUS = {
  inquiry: 'neu',
  testdrive: 'probefahrt',
  contact: 'interessiert',
};

/**
 * @param {object} vehicle – MARKETPLACE_VEHICLES Eintrag
 * @param {'inquiry'|'testdrive'|'contact'} action
 * @param {{ name: string, email: string, phone?: string, message?: string }} contact
 * @param {{ pricing?: object, detailSelection?: object, inquiryBrief?: object, inquirySummary?: object }} context
 */
export function createLeadFromMarketplaceVehicle(vehicle, action, contact, context = {}) {
  const { pricing, detailSelection, inquiryBrief, inquirySummary } = context;
  const actionLabels = {
    inquiry: 'Anfrage gestartet',
    testdrive: 'Probefahrt angefragt',
    contact: 'Händler kontaktiert',
  };

  const paymentType = pricing?.payment ?? detailSelection?.paymentMode ?? detailSelection?.payment ?? 'leasing';
  const desiredRate = pricing?.amount ?? vehicle.monthlyRate;
  const budgetMax = inquiryBrief?.budget?.maxMonthly ?? null;
  const cleverQuotePercent = inquiryBrief?.cleverQuotePercent ?? null;

  const briefLines = inquiryBrief ? formatDealerInquiryBriefLines(inquiryBrief) : [];
  const legacyLines = inquirySummary?.lines ?? [];
  const summaryLines = briefLines.length ? briefLines : legacyLines;

  const vehicleLabel = inquiryBrief?.recommended?.title ?? vehicle.title;

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: ACTION_STATUS[action] ?? 'neu',
    source: 'marketplace',
    dealerId: vehicle.dealerSlug ?? 'autohaus-trinkle',
    marketplaceSlug: vehicle.slug,
    contact: {
      name: contact.name?.trim() ?? inquiryBrief?.customerName ?? '',
      phone: contact.phone?.trim() ?? '',
      email: contact.email?.trim() ?? '',
    },
    vehicle: {
      brand: vehicle.brand,
      model: vehicle.model,
      label: vehicleLabel,
    },
    paymentType,
    desiredRate,
    currentRate: desiredRate,
    budgetMax,
    cleverQuotePercent,
    detailSelection: detailSelection ?? null,
    inquiryBrief: inquiryBrief ?? null,
    inquirySummary: inquirySummary ?? null,
    notes: summaryLines.join('\n'),
    history: [
      historyEntry(`Kundenanfrage über Fahrzeugseite /fahrzeug/${vehicle.slug}`),
      historyEntry(actionLabels[action] ?? 'Anfrage', 'note'),
      ...(summaryLines.length
        ? [historyEntry('Strukturierte Anfrage übermittelt', 'note')]
        : []),
      ...(contact.message
        ? [historyEntry(`Nachricht: ${contact.message}`, 'note')]
        : []),
    ],
  };
}
