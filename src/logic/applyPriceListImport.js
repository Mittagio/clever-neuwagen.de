import { applyCatalogChanges, getDealerSyncInfo } from '../data/vehicleCatalogStore.js';

/**
 * Nach Admin-Freigabe: zentraler Katalog + automatische Händler-Synchronisation
 */
export function applyApprovedPriceListImport(importRecord) {
  const { dealerSync } = applyCatalogChanges(importRecord);

  return {
    ok: true,
    dealerCount: dealerSync.dealerCount,
    syncedAt: dealerSync.lastAt,
    message: `Fahrzeugdaten für ${importRecord.brand} ${importRecord.model} wurden übernommen. `
      + `${dealerSync.dealerCount} Händler erhalten automatisch den neuen Datenstand – `
      + 'keine manuelle Preislistenpflege nötig.',
  };
}

export function getLastDealerSyncLabel() {
  const info = getDealerSyncInfo();
  if (!info.lastAt) return null;
  return {
    count: info.dealerCount,
    at: info.lastAt,
    label: info.label,
  };
}
