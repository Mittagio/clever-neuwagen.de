/**
 * Backend-Startseite: KPI-Kacheln → gefilterte Zielansichten
 */

export const OPEN_OFFER_STATUSES = new Set(['entwurf', 'versendet', 'geoeffnet']);

const CLOSED_LEAD_STATUSES = new Set([
  'bestellung',
  'ausgeliefert',
  'auslieferung_bestaetigt',
  'verloren',
]);

const ACTIVE_VEHICLE_OFFER_STATUSES = new Set([
  'pdf_uploaded',
  'link_ready',
  'sent',
  'opened',
  'accepted',
]);

const ACTIVE_LINKED_OFFER_STATUSES = new Set([
  'entwurf',
  'versendet',
  'geoeffnet',
  'interessiert',
  'verhandlung',
  'bestellung',
  'ausgeliefert',
]);

export const KPI_TILES = [
  {
    key: 'newLeads',
    label: 'Neue Anfragen',
    hint: 'Von Landingpage & Assistent',
    to: '/backend/neue-anfragen',
    ariaLabel: 'Neue Anfragen öffnen',
    accent: '#2563eb',
    listTitle: 'Neue Anfragen',
    listSubtitle: 'Von Landingpage & Assistent',
  },
  {
    key: 'needsOffer',
    label: 'Angebot vorbereiten',
    hint: 'Chancen ohne Angebot',
    to: '/backend/angebot-vorbereiten',
    ariaLabel: 'Angebot vorbereiten öffnen',
    accent: '#7c3aed',
    listTitle: 'Angebot vorbereiten',
    listSubtitle: 'Diese Chancen warten auf ein Angebot.',
  },
  {
    key: 'followUp',
    label: 'Nachfassen',
    hint: 'Heute heiß',
    to: '/backend/verkaufschancen?filter=followup',
    ariaLabel: 'Nachfassen öffnen',
    accent: '#0d9488',
    listTitle: 'Nachfassen',
    listSubtitle: 'Heute heiß',
  },
  {
    key: 'openedOffers',
    label: 'Angebote geöffnet',
    hint: 'Jetzt guter Moment',
    to: '/backend/angebote?filter=opened&sort=lastOpenedDesc',
    ariaLabel: 'Geöffnete Angebote öffnen',
    accent: '#16a34a',
    listTitle: 'Angebote geöffnet',
    listSubtitle: 'Kunden haben reingeschaut',
  },
];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  return startOfDay(d).getTime() === startOfDay(new Date()).getTime();
}

export function getDueTodayLeadIds(dueToday = []) {
  return new Set(dueToday.map((r) => r.leadId).filter(Boolean));
}

export function matchesNewRequestsView(lead = {}) {
  return lead.status === 'neu';
}

export function hasVehicleOnTable(lead = {}) {
  if (lead.vehicle?.model?.trim()) return true;
  if ((lead.crm?.reservedModels ?? []).length > 0) return true;
  return false;
}

export function hasPreparedOffer(lead = {}, linkedOffers = []) {
  const crm = lead.crm ?? {};
  const vehicleOffers = Object.values(crm.vehicleOffers ?? {});

  if (vehicleOffers.some((vo) => ACTIVE_VEHICLE_OFFER_STATUSES.has(vo.status))) {
    return true;
  }
  if (vehicleOffers.some((vo) => vo.pdf || vo.onlineLink)) {
    return true;
  }

  const crmOffers = crm.offers ?? [];
  if (crmOffers.some((o) => o.code || o.id)) {
    return true;
  }

  const code = lead.offerCode?.toUpperCase();
  const linked = linkedOffers.filter(
    (o) => o.leadId === lead.id || (code && o.code?.toUpperCase() === code),
  );

  return linked.some((o) => ACTIVE_LINKED_OFFER_STATUSES.has(o.status));
}

export function matchesNeedsOfferView(lead = {}, linkedOffers = []) {
  if (CLOSED_LEAD_STATUSES.has(lead.status)) return false;
  if (lead.status === 'angebotVersendet') return false;
  if (!hasVehicleOnTable(lead)) return false;
  if (hasPreparedOffer(lead, linkedOffers)) return false;
  return true;
}

export function countNeedsOfferLeads(leads = [], linkedOffers = []) {
  return leads.filter((lead) => matchesNeedsOfferView(lead, linkedOffers)).length;
}

export function matchesFollowUpView(lead = {}, dueTodayLeadIds = new Set()) {
  if (dueTodayLeadIds.has(lead.id)) return true;

  const crm = lead.crm ?? {};
  if (crm.pipelineStatusId === 'nachfassen') return true;
  if (crm.nextStepId === 'call_today' || crm.nextStepId === 'reminder') return true;
  if (crm.followUpAt && isToday(crm.followUpAt)) return true;

  if (lead.status === 'angebotVersendet' || lead.status === 'rueckfrageOffen') {
    return true;
  }

  const vehicleOffers = Object.values(crm.vehicleOffers ?? {});
  return vehicleOffers.some((vo) => ['sent', 'opened', 'link_ready'].includes(vo.status));
}

export function filterSalesChances(leads = [], viewFilter = null, dueToday = [], linkedOffers = []) {
  const dueTodayLeadIds = getDueTodayLeadIds(dueToday);

  if (viewFilter === 'new' || viewFilter === 'new-requests') {
    return leads.filter((lead) => matchesNewRequestsView(lead));
  }

  if (viewFilter === 'followup') {
    return leads.filter((lead) => matchesFollowUpView(lead, dueTodayLeadIds));
  }

  if (viewFilter === 'needs-offer') {
    return leads.filter((lead) => matchesNeedsOfferView(lead, linkedOffers));
  }

  return leads;
}

export function getSalesChanceViewMeta(viewFilter) {
  if (viewFilter === 'new' || viewFilter === 'new-requests') {
    return { title: 'Neue Anfragen', subtitle: 'Von Landingpage & Assistent' };
  }
  if (viewFilter === 'followup') {
    return { title: 'Nachfassen', subtitle: 'Heute heiß' };
  }
  if (viewFilter === 'needs-offer') {
    return { title: 'Angebot vorbereiten', subtitle: 'Chancen ohne Angebot' };
  }
  return null;
}

export function filterOffersList(offers = [], viewFilter = null, sortParam = null) {
  let list = [...offers];

  if (viewFilter === 'open') {
    list = list.filter((o) => OPEN_OFFER_STATUSES.has(o.status));
  } else if (viewFilter === 'opened' || viewFilter === 'geoeffnet') {
    list = list.filter((o) => o.status === 'geoeffnet');
  }

  const sortOpened = sortParam === 'lastOpenedDesc' || viewFilter === 'opened' || viewFilter === 'geoeffnet';

  if (sortOpened) {
    list.sort((a, b) => {
      const aOpen = a.tracking?.openedAt ?? a.tracking?.lastOpenedAt ?? a.updatedAt ?? 0;
      const bOpen = b.tracking?.openedAt ?? b.tracking?.lastOpenedAt ?? b.updatedAt ?? 0;
      return new Date(bOpen) - new Date(aOpen);
    });
  } else {
    list.sort((a, b) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0));
  }

  return list;
}

export function getOffersViewMeta(viewFilter) {
  if (viewFilter === 'open') {
    return { title: 'Offene Angebote', subtitle: 'Entwurf · gesendet · geöffnet' };
  }
  if (viewFilter === 'opened' || viewFilter === 'geoeffnet') {
    return { title: 'Angebote geöffnet', subtitle: 'Kunden haben reingeschaut' };
  }
  return null;
}

export function normalizeSalesChanceViewFilter(raw) {
  if (!raw) return null;
  if (raw === 'neu') return 'new';
  return raw;
}
