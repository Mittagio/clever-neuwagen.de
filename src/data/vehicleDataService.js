/**
 * Zentraler Fahrzeugdaten-Service – Clever-Neuwagen
 * Single Source of Truth für Stammdaten. Händler: nur lesen.
 */

import { sportage } from './kiaSportage.js';
import { brands, kiaModels } from './adminCatalog.js';

export const HEALTH_STATUS = {
  current: { emoji: '🟢', label: 'Aktuell', className: 'health-current' },
  review: { emoji: '🟡', label: 'Prüfen', className: 'health-review' },
  outdated: { emoji: '🔴', label: 'Veraltet', className: 'health-outdated' },
};

export const CHANGE_TYPES = {
  price: { label: 'Preisänderung', icon: '💶' },
  color: { label: 'Neue Farbe', icon: '🎨' },
  package: { label: 'Neues Paket', icon: '📦' },
  wltp: { label: 'WLTP-Änderung', icon: '⚡' },
  modelyear: { label: 'Modelljahreswechsel', icon: '📅' },
};

/** Modell-Status → Gesundheits-Ampel */
const STATUS_TO_HEALTH = {
  complete: 'current',
  review: 'review',
  outdated: 'outdated',
  draft: 'review',
};

export const DEALER_VEHICLE_NOTE =
  'Diese Fahrzeugdaten werden von Clever-Neuwagen gepflegt. Sie können sie einsehen, aber nicht bearbeiten.';

export const changeCenter = [
  {
    id: 'cc-001',
    type: 'price',
    date: '2025-05-29',
    title: 'Sportage Preisliste Q2/2025 übernommen',
    detail: '9 UPE-Kombinationen aktualisiert',
    brand: 'kia',
    model: 'sportage',
    status: 'published',
  },
  {
    id: 'cc-002',
    type: 'price',
    date: '2025-05-28',
    title: 'Vision DCT Preis angepasst',
    detail: 'Basispreis 35.990 € → 36.490 €',
    brand: 'kia',
    model: 'sportage',
    status: 'published',
  },
  {
    id: 'cc-003',
    type: 'color',
    date: '2025-05-27',
    title: 'Neue Farbe Runway Red ergänzt',
    detail: 'Premium Metallic, +850 €',
    brand: 'kia',
    model: 'sportage',
    status: 'published',
  },
  {
    id: 'cc-004',
    type: 'package',
    date: '2025-05-26',
    title: 'P4 Panorama-Glasschiebedach geprüft',
    detail: 'Komfort-Paket Abhängigkeit bestätigt',
    brand: 'kia',
    model: 'sportage',
    status: 'review',
  },
  {
    id: 'cc-005',
    type: 'wltp',
    date: '2025-05-20',
    title: 'WLTP Plug-in Hybrid aktualisiert',
    detail: 'CO₂ 29–41 g/km, E-Reichweite 58–67 km',
    brand: 'kia',
    model: 'sportage',
    status: 'published',
  },
  {
    id: 'cc-006',
    type: 'modelyear',
    date: '2025-04-15',
    title: 'Modelljahr 2025 freigeschaltet',
    detail: 'Sportage MJ 2025 für alle Händler aktiv',
    brand: 'kia',
    model: 'sportage',
    status: 'published',
  },
  {
    id: 'cc-007',
    type: 'price',
    date: '2025-03-10',
    title: 'Picanto Preisliste veraltet',
    detail: 'Keine Aktualisierung seit Q4/2024',
    brand: 'kia',
    model: 'picanto',
    status: 'review',
  },
];

export function getModelHealth(status) {
  return STATUS_TO_HEALTH[status] ?? 'review';
}

export function getModelDataStatus(modelId = 'sportage') {
  if (modelId !== 'sportage') {
    const model = kiaModels.find((m) => m.id === modelId);
    return {
      modelId,
      modelName: model?.name ?? modelId,
      lastUpdated: '–',
      updatedBy: '–',
      dataStand: '–',
      changeCount: 0,
      health: getModelHealth(model?.status ?? 'draft'),
      healthLabel: HEALTH_STATUS[getModelHealth(model?.status ?? 'draft')].label,
    };
  }

  const { admin, changeLog } = sportage;
  return {
    modelId: 'sportage',
    modelName: sportage.model,
    lastUpdated: admin.lastUpdated,
    updatedBy: admin.updatedBy,
    dataStand: admin.priceListDate,
    changeCount: changeLog.length,
    health: getModelHealth(admin.status),
    healthLabel: HEALTH_STATUS[getModelHealth(admin.status)].label,
  };
}

export function getBrandDashboard() {
  return brands.map((brand) => {
    if (brand.id !== 'kia') {
      return {
        ...brand,
        healthKey: brand.status === 'planned' ? 'review' : 'outdated',
        lastUpdated: '–',
        stats: { current: 0, review: 0, outdated: 0 },
      };
    }

    const stats = kiaModels.reduce(
      (acc, m) => {
        const h = getModelHealth(m.status);
        acc[h] += 1;
        return acc;
      },
      { current: 0, review: 0, outdated: 0 },
    );

    const healthKey =
      stats.outdated > 0 ? 'review' :
      stats.review > 2 ? 'review' : 'current';

    return {
      ...brand,
      healthKey,
      lastUpdated: sportage.admin.lastUpdated,
      stats,
    };
  });
}

export function getChangeCenter(filters = {}) {
  let items = [...changeCenter];

  if (filters.brand) {
    items = items.filter((i) => i.brand === filters.brand);
  }
  if (filters.model) {
    items = items.filter((i) => i.model === filters.model);
  }
  if (filters.type) {
    items = items.filter((i) => i.type === filters.type);
  }

  return items.sort((a, b) => b.date.localeCompare(a.date));
}

export function getChangeCenterByType() {
  const grouped = {};
  for (const type of Object.keys(CHANGE_TYPES)) {
    grouped[type] = changeCenter.filter((i) => i.type === type);
  }
  return grouped;
}

/** Was der Händler NICHT pflegt – nur CN */
export const CENTRAL_MAINTAINED_FIELDS = [
  'Preislisten (UPE)',
  'Farben & Lackpreise',
  'Ausstattungslinien',
  'Serienausstattung',
  'Pakete & Abhängigkeiten',
  'WLTP / Verbrauch',
  'Modellbilder',
  'Modelljahreswechsel',
];

/** Was der Händler selbst pflegt */
export const DEALER_MAINTAINED_FIELDS = [
  'Modelle & Aktivierung',
  'Rabatte je Modell',
  'Leasingfaktoren',
  'Finanzierung',
  'Lieferzeit & Verfügbarkeit',
  'Lager / Vorlauf',
  'Veröffentlichung / Sync',
];

export function getVehicleMasterSnapshot() {
  return {
    sportage,
    dataStatus: getModelDataStatus('sportage'),
    recentChanges: getChangeCenter({ model: 'sportage' }).slice(0, 5),
  };
}
