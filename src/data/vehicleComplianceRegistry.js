/**
 * Zentrale Auflösung von Fahrzeug-Compliance-Daten (OEM only)
 */
import { kiaSportage } from './models/kia/sportage.js';
import { advisorCatalog } from './advisorCatalog.js';
import { COMPLIANCE_STATUS, createDefaultComplianceMeta } from './complianceSchema.js';

const SPORTAGE_COMPLIANCE = {
  source: kiaSportage.admin?.priceListSource ?? 'Kia Deutschland Preisliste 05/2026',
  sourceUrl: '',
  dataStandard: 'WLTP',
  verifiedBy: kiaSportage.admin?.updatedBy ?? 'Clever-Neuwagen Admin',
  verifiedAt: kiaSportage.admin?.lastUpdated ?? kiaSportage.updatedAt,
  status: COMPLIANCE_STATUS.verified,
  notes: [],
};

/** Zusätzliche Katalog-Fahrzeuge (EV / PHEV Demo) */
const EXTENDED_VEHICLES = {
  'ev3-long-range': {
    brand: 'Kia',
    model: 'EV3',
    variant: 'Long Range',
    engineId: 'ev3-long-range',
    fuelCategory: 'elektro',
    powertrainType: 'bev',
    label: 'Kia EV3 Long Range',
    compliance: {
      ...createDefaultComplianceMeta('Kia Preisliste 07/2026'),
      status: COMPLIANCE_STATUS.verified,
      verifiedBy: 'Admin',
      verifiedAt: '2026-06-01',
    },
    wltp: {
      fuel: 'Elektro',
      electricConsumptionCombined: '16,2 kWh/100 km',
      co2Combined: '0 g/km',
      co2Class: 'A',
      electricRange: '600 km',
      dataStandard: 'WLTP (EU)',
    },
  },
  'ev4-earth': {
    brand: 'Kia',
    model: 'EV4',
    variant: 'Earth Long Range',
    engineId: 'ev4-earth',
    fuelCategory: 'elektro',
    powertrainType: 'bev',
    label: 'Kia EV4 Earth Long Range',
    compliance: {
      ...createDefaultComplianceMeta('Kia Preisliste 07/2026'),
      status: COMPLIANCE_STATUS.needs_review,
      verifiedBy: '',
      verifiedAt: '',
      notes: ['WLTP-Freigabe durch Admin ausstehend'],
    },
    wltp: {
      fuel: 'Elektro',
      electricConsumptionCombined: '15,8 kWh/100 km',
      co2Combined: '0 g/km',
      co2Class: 'A',
      electricRange: '580 km',
      dataStandard: 'WLTP (EU)',
    },
  },
  'niro-phev': {
    brand: 'Kia',
    model: 'Niro',
    variant: 'Plug-in Hybrid',
    engineId: 'niro-phev',
    fuelCategory: 'hybrid',
    powertrainType: 'phev',
    label: 'Kia Niro Plug-in Hybrid',
    compliance: {
      ...createDefaultComplianceMeta('Kia Preisliste 05/2026'),
      status: COMPLIANCE_STATUS.verified,
      verifiedBy: 'Admin',
      verifiedAt: '2026-05-20',
    },
    wltp: {
      fuel: 'Plug-in-Hybrid (Benzin/Elektro)',
      weightedConsumptionCombined: '1,2 l/100 km',
      weightedElectricConsumption: '16,8 kWh/100 km',
      weightedCo2Combined: '28 g/km',
      co2Class: 'A+',
      depletedBatteryConsumption: '5,4 l/100 km',
      electricRange: '65 km',
      electricConsumptionCombined: '16,8 kWh/100 km',
      dataStandard: 'WLTP (EU)',
    },
  },
  'sportage-phev-missing-demo': {
    brand: 'Kia',
    model: 'Sportage',
    variant: 'PHEV (Demo – unvollständig)',
    engineId: 'sportage-phev-missing-demo',
    fuelCategory: 'hybrid',
    powertrainType: 'phev',
    label: 'Kia Sportage PHEV (Demo unvollständig)',
    compliance: {
      ...createDefaultComplianceMeta('Kia Preisliste – Entwurf'),
      status: COMPLIANCE_STATUS.missing,
      notes: ['PHEV-Pflichtfelder unvollständig'],
    },
    wltp: {
      fuel: 'Plug-in-Hybrid',
      co2Class: 'A',
      dataStandard: 'WLTP (EU)',
    },
  },
};

function detectPowertrainFromEngine(engine, fuelCategory) {
  if (engine?.powertrainType) return engine.powertrainType;
  const fuel = `${engine?.fuelType ?? ''} ${fuelCategory ?? ''}`.toLowerCase();
  if (/elektro|electric|bev|ev\b/.test(fuel) && !/plug|phev|hybrid/.test(fuel)) return 'bev';
  if (/plug|phev|plugin/.test(fuel)) return 'phev';
  if (/hybrid|mild/.test(fuel)) return 'hev';
  return 'ice';
}

function buildSportageWltpValues(engineId) {
  const engine = kiaSportage.engines.find((e) => e.id === engineId);
  const w = kiaSportage.wltp.find((x) => x.engineId === engineId);
  if (!engine && !w) return null;

  return {
    fuel: engine?.fuelType ?? null,
    consumptionCombined: w?.consumptionCombined ?? engine?.consumptionCombined ?? null,
    co2Combined: w?.co2 != null ? `${w.co2} g/km` : (engine?.co2 != null ? `${engine.co2} g/km` : null),
    co2Class: w?.co2Class ?? engine?.co2Class ?? w?.efficiencyClass ?? null,
    dataStandard: w || engine ? 'WLTP (EU)' : null,
  };
}

export function resolveVehicleComplianceProfile(input = {}) {
  const extKey = input.vehicleId ?? input.id ?? input.catalogId ?? input.engineId;
  if (extKey && EXTENDED_VEHICLES[extKey]) {
    const ext = EXTENDED_VEHICLES[extKey];
    return {
      ...ext,
      engineIds: input.engineIds ?? [ext.engineId],
    };
  }

  const engineId = input.engineId ?? input.engine?.id;
  if (engineId && kiaSportage.engines.some((e) => e.id === engineId)) {
    const engine = kiaSportage.engines.find((e) => e.id === engineId);
    const trim = input.trimId
      ? kiaSportage.trims.find((t) => t.id === input.trimId)
      : null;
    return {
      brand: kiaSportage.brand,
      model: kiaSportage.model,
      variant: trim?.name ?? input.variant ?? input.trim,
      engineId,
      engineIds: input.engineIds ?? [engineId],
      fuelCategory: input.fuelCategory ?? engine?.fuelType,
      powertrainType: detectPowertrainFromEngine(engine, input.fuelCategory),
      label: input.label ?? `${kiaSportage.brand} ${kiaSportage.model} · ${engine.name}${trim ? ` ${trim.name}` : ''}`,
      compliance: { ...SPORTAGE_COMPLIANCE, ...(input.compliance ?? {}) },
      wltp: buildSportageWltpValues(engineId),
    };
  }

  const catalogEntry = advisorCatalog.find(
    (v) => v.id === extKey || (v.model === input.model && v.variant === input.variant),
  );
  if (catalogEntry) {
    const ext = EXTENDED_VEHICLES[catalogEntry.id];
    if (ext) {
      return { ...ext, engineIds: [ext.engineId] };
    }
    return {
      brand: catalogEntry.brand,
      model: catalogEntry.model,
      variant: catalogEntry.variant,
      engineId: catalogEntry.id,
      engineIds: [catalogEntry.id],
      fuelCategory: catalogEntry.fuelCategory,
      powertrainType: catalogEntry.fuelCategory === 'elektro' ? 'bev' : 'ice',
      label: `${catalogEntry.brand} ${catalogEntry.model} ${catalogEntry.variant}`,
      compliance: {
        ...createDefaultComplianceMeta('Noch keine OEM-Freigabe'),
        status: COMPLIANCE_STATUS.missing,
        notes: ['Mock-Fahrzeug ohne WLTP-Freigabe'],
      },
      wltp: catalogEntry.fuelCategory === 'elektro' ? {
        fuel: 'Elektro',
        co2Combined: '0 g/km',
        co2Class: 'A',
        electricRange: catalogEntry.rangeKm ? `${catalogEntry.rangeKm} km` : null,
        dataStandard: null,
      } : null,
    };
  }

  return {
    brand: input.brand ?? 'Kia',
    model: input.model ?? 'Fahrzeug',
    variant: input.variant ?? '',
    engineId: engineId ?? null,
    engineIds: input.engineIds ?? (engineId ? [engineId] : []),
    label: input.label ?? 'Unbekanntes Fahrzeug',
    powertrainType: 'ice',
    compliance: createDefaultComplianceMeta(),
    wltp: null,
  };
}

export function listAllComplianceProfiles() {
  const sportageProfiles = kiaSportage.engines.map((engine) => resolveVehicleComplianceProfile({
    engineId: engine.id,
    vehicleLabel: `${kiaSportage.brand} ${kiaSportage.model} · ${engine.name}`,
  }));

  const extended = Object.keys(EXTENDED_VEHICLES).map((id) => resolveVehicleComplianceProfile({
    id,
    vehicleId: id,
  }));

  return [...sportageProfiles, ...extended];
}

export { EXTENDED_VEHICLES, SPORTAGE_COMPLIANCE };
