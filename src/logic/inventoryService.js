import { sportage } from '../data/kiaSportage.js';
import { INVENTORY_TYPES, LEGACY_STATUS_MAP } from '../data/inventoryTypes.js';

export function formatEta(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getColorName(colorId) {
  return sportage.colors.find((c) => c.id === colorId)?.name ?? colorId;
}

export function getTrimName(trimId) {
  return sportage.trims.find((t) => t.id === trimId)?.name ?? trimId;
}

export function getEngineName(engineId) {
  return sportage.engines.find((e) => e.id === engineId)?.name ?? engineId;
}

/**
 * Migriert altes stock-Format in inventory.
 */
export function migrateLegacyStock(stock = []) {
  return stock.map((item) => {
    const type =
      LEGACY_STATUS_MAP[item.status] ??
      (item.type && INVENTORY_TYPES[item.type] ? item.type : 'konfigurierbar');

    return {
      id: item.id,
      type,
      model: item.model ?? 'Sportage',
      engineId: item.engineId,
      trimId: item.trimId,
      colorId: item.colorId,
      color: item.color ?? getColorName(item.colorId),
      equipment: item.equipment ?? getTrimName(item.trimId),
      vin: item.vin ?? '',
      eta: item.eta ?? item.availableFrom ?? null,
      location: item.location ?? 'Heilbronn',
    };
  });
}

export function createEmptyInventoryItem() {
  return {
    id: `inv-${Date.now()}`,
    type: 'lager',
    model: 'Sportage',
    engineId: sportage.engines[0]?.id ?? '',
    trimId: sportage.trims[0]?.id ?? '',
    colorId: sportage.colors[0]?.id ?? '',
    color: getColorName(sportage.colors[0]?.id),
    equipment: getTrimName(sportage.trims[0]?.id),
    vin: '',
    eta: '',
    location: 'Heilbronn Ausstellung',
  };
}

export function getCustomerAvailabilityLabel(item) {
  const typeConfig = INVENTORY_TYPES[item.type] ?? INVENTORY_TYPES.konfigurierbar;

  if (item.type === 'vorlauf' && item.eta) {
    return `${typeConfig.emoji} ${typeConfig.customerLabel} ${formatEta(item.eta)}`;
  }

  return `${typeConfig.emoji} ${typeConfig.customerLabel}`;
}

export function findMatchingInventory(config, inventory = []) {
  if (!inventory.length) return null;

  const exact = inventory.find(
    (i) =>
      i.engineId === config.engineId &&
      i.trimId === config.trimId &&
      i.colorId === config.colorId,
  );
  if (exact) return exact;

  return (
    inventory.find(
      (i) => i.engineId === config.engineId && i.trimId === config.trimId,
    ) ?? null
  );
}

/**
 * Ermittelt Verfügbarkeit & Lieferzeit für eine Konfiguration.
 */
export function resolveAvailability(config, inventory = [], fallbackDeliveryTime = '4–6 Wochen') {
  const match = findMatchingInventory(config, inventory);

  if (match) {
    return {
      type: match.type,
      label: getCustomerAvailabilityLabel(match),
      match,
      deliveryTime: getCustomerAvailabilityLabel(match),
      fallbackText: null,
      isAuto: true,
    };
  }

  const konfigLabel = getCustomerAvailabilityLabel({ type: 'konfigurierbar' });
  return {
    type: 'konfigurierbar',
    label: konfigLabel,
    match: null,
    deliveryTime: `${konfigLabel} · ${fallbackDeliveryTime}`,
    fallbackText: fallbackDeliveryTime,
    isAuto: true,
  };
}

/**
 * Zusammenfassung für Landingpage – bestes Angebot + Highlights.
 */
export function getDealerAvailabilitySummary(inventory = []) {
  if (!inventory.length) {
    return {
      primary: resolveAvailability({}, [], '4–6 Wochen'),
      highlights: [],
      counts: { lager: 0, vorlauf: 0, bestellt: 0, konfigurierbar: 0 },
    };
  }

  const counts = inventory.reduce(
    (acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + 1;
      return acc;
    },
    { lager: 0, vorlauf: 0, bestellt: 0, konfigurierbar: 0 },
  );

  const sorted = [...inventory].sort(
    (a, b) =>
      (INVENTORY_TYPES[a.type]?.priority ?? 99) -
      (INVENTORY_TYPES[b.type]?.priority ?? 99),
  );

  const primaryItem = sorted[0];
  const primary = {
    type: primaryItem.type,
    label: getCustomerAvailabilityLabel(primaryItem),
    match: primaryItem,
    deliveryTime: getCustomerAvailabilityLabel(primaryItem),
  };

  const highlights = sorted.slice(0, 4).map((item) => ({
    id: item.id,
    type: item.type,
    label: getCustomerAvailabilityLabel(item),
    equipment: item.equipment,
    color: item.color,
    location: item.location,
    eta: item.eta ? formatEta(item.eta) : null,
  }));

  return { primary, highlights, counts };
}

export function normalizeInventoryItem(item) {
  return {
    ...item,
    color: item.color || getColorName(item.colorId),
    equipment: item.equipment || getTrimName(item.trimId),
  };
}
