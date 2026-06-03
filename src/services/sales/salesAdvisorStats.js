const STATS_KEY = 'cn-smart-sales-stats';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readAll() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(STATS_KEY, JSON.stringify(data));
}

function ensureToday(data) {
  const key = todayKey();
  if (!data[key]) {
    data[key] = {
      advised: 0,
      sent: 0,
      qrCreated: 0,
      compareOpened: 0,
      offerViewed: 0,
      openReplies: 0,
    };
  }
  return data;
}

export function getSmartSalesStats() {
  const data = ensureToday(readAll());
  writeAll(data);
  return data[todayKey()];
}

export function incrementSmartSalesStat(field, amount = 1) {
  const data = ensureToday(readAll());
  const key = todayKey();
  data[key][field] = (data[key][field] ?? 0) + amount;
  writeAll(data);
  return data[key];
}

export function recordSmartSalesAdvised() {
  return incrementSmartSalesStat('advised');
}

export function recordSmartSalesSent() {
  return incrementSmartSalesStat('sent');
}

export function recordSmartSalesQr() {
  return incrementSmartSalesStat('qrCreated');
}

export function recordCompareOpened() {
  return incrementSmartSalesStat('compareOpened');
}

export function recordOfferViewed() {
  return incrementSmartSalesStat('offerViewed');
}

/** Demo-Wert – offene Rückmeldungen */
export function getOpenRepliesCount() {
  const stats = getSmartSalesStats();
  return stats.openReplies ?? 2;
}
