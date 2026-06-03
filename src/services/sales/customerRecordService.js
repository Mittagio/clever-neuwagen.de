const RECORDS_KEY = 'cn-conversation-records';

function readRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records.slice(0, 100)));
}

export function saveCustomerRecord(record) {
  const records = readRecords();
  const entry = {
    id: record.id ?? `beratung-${Date.now()}`,
    savedAt: Date.now(),
    ...record,
  };
  records.unshift(entry);
  writeRecords(records);
  return entry;
}

export function loadCustomerRecords(limit = 20) {
  return readRecords().slice(0, limit);
}

export function getCustomerRecord(id) {
  return readRecords().find((r) => r.id === id) ?? null;
}

export function buildCustomerRecordPayload({
  customer,
  chipIds = [],
  wishLabels = [],
  selectedMatches = [],
  sentVia = [],
  shareUrl = '',
  sellerName = '',
  dealerName = '',
  nextStep = 'Rückmeldung abwarten',
}) {
  return {
    customer,
    chipIds,
    wishLabels,
    selectedVehicles: selectedMatches.map((m) => ({
      title: m.model ?? m.title,
      slug: m.slug,
      cleverQuote: m.cleverQuote?.percent,
    })),
    sentVia,
    shareUrl,
    sellerName,
    dealerName,
    nextStep,
  };
}
