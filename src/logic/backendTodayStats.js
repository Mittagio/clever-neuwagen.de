import { countNeedsOfferLeads, OPEN_OFFER_STATUSES } from './backendKpiNavigation.js';

function countOpenedVehicleOffers(leads = []) {
  let count = 0;
  for (const lead of leads) {
    for (const vo of Object.values(lead.crm?.vehicleOffers ?? {})) {
      if (vo.status === 'opened') count += 1;
    }
  }
  return count;
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate()
  );
}

export function computeBackendTodayStats(leads = [], offers = []) {
  const newLeads = leads.filter((l) => l.status === 'neu');
  const newLeadsToday = newLeads.filter((l) => isToday(l.createdAt));

  const openOffers = offers.filter((o) => OPEN_OFFER_STATUSES.has(o.status));
  const openOffersToday = openOffers.filter(
    (o) => isToday(o.tracking?.sentAt) || isToday(o.createdAt),
  );

  const openedOffers = offers.filter((o) => o.status === 'geoeffnet').length
    + countOpenedVehicleOffers(leads);

  const needsOffer = countNeedsOfferLeads(leads, offers);

  const testDrives = leads.filter((l) => l.status === 'probefahrt');
  const deliveries = leads.filter(
    (l) => l.status === 'bestellung' || l.status === 'ausgeliefert',
  );

  const inProgress = leads.filter(
    (l) => l.status === 'inBearbeitung' || l.status === 'angebotVersendet',
  );

  return {
    newLeads: newLeads.length,
    newLeadsToday: newLeadsToday.length,
    openOffers: openOffers.length,
    openOffersToday: openOffersToday.length,
    needsOffer,
    openedOffers,
    testDrives: testDrives.length,
    deliveries: deliveries.length,
    inProgress: inProgress.length,
    totalLeads: leads.length,
  };
}
