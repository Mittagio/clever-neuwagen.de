const OPEN_OFFER_STATUSES = new Set(['entwurf', 'versendet', 'geoeffnet']);

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
    testDrives: testDrives.length,
    deliveries: deliveries.length,
    inProgress: inProgress.length,
    totalLeads: leads.length,
  };
}
