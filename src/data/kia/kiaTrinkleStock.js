/**
 * Autohaus Trinkle – Pilot-Bestand aus PDF-Preislisten + Registry (alle Kia-Modelllinien)
 */
import { buildKiaDealerStock, getKiaDealerStockStats } from './buildKiaDealerStock.js';

/** @type {import('../marketplaceVehicles.js').MarketplaceVehicle[]} */
export const KIA_TRINKLE_PILOT_STOCK = buildKiaDealerStock();

export function getKiaTrinklePilotStock() {
  return KIA_TRINKLE_PILOT_STOCK;
}

export function getKiaTrinkleStockStats() {
  return getKiaDealerStockStats(KIA_TRINKLE_PILOT_STOCK);
}
