function isToday(iso) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function topEntry(entries) {
  if (!entries.length) return { label: '–', count: 0 };
  const [label, count] = entries[0];
  return { label, count };
}

function countBy(items, getter) {
  const map = new Map();
  items.forEach((item) => {
    const key = getter(item);
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function getConfigLabel(item) {
  if (item.configuration?.config) {
    const c = item.configuration.config;
    const parts = [c.trimId, c.engineId, c.colorId].filter(Boolean);
    if (parts.length) return parts.join(' · ');
  }
  if (item.configuration?.lines?.length) {
    const trim = item.configuration.lines.find((l) => l.startsWith('Ausstattung:'));
    const motor = item.configuration.lines.find((l) => l.startsWith('Motor:'));
    if (trim || motor) {
      return [motor?.replace('Motor: ', ''), trim?.replace('Ausstattung: ', '')]
        .filter(Boolean)
        .join(' · ');
    }
  }
  const v = item.vehicle;
  if (v?.trim && v?.engine) return `${v.trim} · ${v.engine}`;
  if (v?.label) return v.label;
  return null;
}

function collectRates(leads, offers) {
  const rates = [];
  leads.forEach((l) => {
    if (l.currentRate != null && l.paymentType !== 'cash') rates.push(l.currentRate);
    if (l.desiredRate != null) rates.push(l.desiredRate);
  });
  offers.forEach((o) => {
    if (o.pricing?.rate != null && o.pricing.paymentType !== 'cash') {
      rates.push(o.pricing.rate);
    }
  });
  return rates;
}

function modeRate(rates) {
  if (!rates.length) return null;
  const buckets = countBy(rates, (r) => `${Math.round(r / 10) * 10} €`);
  const top = topEntry(buckets);
  return top.label === '–' ? null : top.label;
}

export function computeDashboardMetrics(leads = [], offers = []) {
  const leadsToday = leads.filter((l) => isToday(l.createdAt)).length;

  const openOffers = offers.filter((o) => o.status === 'active').length
    + leads.filter((l) => l.status === 'angebotVersendet').length;

  const testDrives = leads.filter((l) => l.status === 'probefahrt').length;
  const orders = leads.filter((l) => l.status === 'bestellung').length
    + offers.filter((o) => o.status === 'reserved').length;
  const deliveries = leads.filter((l) => l.status === 'ausgeliefert').length;

  const totalLeads = leads.length;
  const won = leads.filter((l) => ['bestellung', 'ausgeliefert'].includes(l.status)).length;
  const lost = leads.filter((l) => l.status === 'verloren').length;
  const pipeline = totalLeads - lost;
  const conversionRate = pipeline > 0 ? Math.round((won / pipeline) * 100) : 0;

  const allItems = [...leads, ...offers];
  const vehicleCounts = countBy(allItems, (i) => i.vehicle?.label ?? i.vehicle?.model);
  const configCounts = countBy(allItems, getConfigLabel);
  const rates = collectRates(leads, offers);
  const popularRate = modeRate(rates);

  const topVehicle = topEntry(vehicleCounts);
  const topConfig = topEntry(configCounts);

  return {
    kpis: {
      leadsToday,
      openOffers,
      testDrives,
      orders,
      deliveries,
    },
    conversionRate,
    conversionDetail: { won, pipeline, lost, total: totalLeads },
    popular: {
      vehicle: topVehicle,
      configuration: topConfig,
      leasingRate: popularRate,
      vehicleBreakdown: vehicleCounts.slice(0, 4),
      configBreakdown: configCounts.slice(0, 4),
      rateSamples: rates.length,
    },
  };
}

export function formatKpi(value) {
  if (value == null) return '–';
  return new Intl.NumberFormat('de-DE').format(value);
}
